/**
 * Strict validation pipeline — registry enforcement, fail-fast, no "unknown" fallbacks.
 *
 * 1. validateGraph()   — GraphDocument node types + structural pipeline
 * 2. validateBotIR()   — Bot IR node types + edge integrity
 * 3. validateCompile() — graph + Bot IR + compile gate (pre-codegen)
 */

import { createGraphDocument } from "../../src/constructor/graph_document/graph_document.js";
import {
  assertRegisteredBlockType,
  LEGACY_WRAPPER_TYPES,
  UnknownBlockTypeError,
} from "../../src/constructor/graph_document/graph_node_payload.js";
import {
  hasOperationContract,
  validateGraph as validateRegistryGraph,
} from "../../src/constructor/graph_document/operation_registry.js";
import { collectRegistryViolations } from "./registryEnforce.js";
import {
  runGraphValidationPipeline,
  strictCompileValidation,
} from "../../src/constructor/graph_document/graph_validation_pipeline.js";
import { VALIDATION_STAGE } from "../../src/constructor/graph_document/validation_stages.js";
import { blockRegistry } from "../blockRegistry.js";
import { assertBlockCapabilitiesRegistered } from "../registry/blockCapabilities.js";
import { graphToBotIR, type BotIRGraph, type GraphDocumentInput } from "../ir/bot_ir.js";
import {
  StrictValidationError,
  type StrictValidationIssue,
  type StrictValidationStage,
} from "./strictValidationError.js";

export type { StrictValidationIssue, StrictValidationStage };
export { StrictValidationError };

export interface StrictValidationOptions {
  /** Stop on first error (default true). */
  failFast?: boolean;
  /** Include callback handler checks in graph pipeline (default true for compile). */
  includeCallbacks?: boolean;
}

export interface StrictValidationResult {
  ok: boolean;
  stage: StrictValidationStage;
  errors: StrictValidationIssue[];
  warnings: StrictValidationIssue[];
  failFastStopped?: boolean;
  document?: ReturnType<typeof createGraphDocument>;
  botIr?: BotIRGraph;
}

function issue(
  stage: StrictValidationStage,
  code: string,
  message: string,
  extra: Partial<StrictValidationIssue> = {},
): StrictValidationIssue {
  return { stage, code, message, ...extra };
}

function pushOrThrow(
  errors: StrictValidationIssue[],
  next: StrictValidationIssue,
  failFast: boolean,
): boolean {
  errors.push(next);
  if (failFast) {
    throw new StrictValidationError(next);
  }
  return true;
}

function fromUnknownBlockTypeError(
  stage: StrictValidationStage,
  err: UnknownBlockTypeError,
): StrictValidationIssue {
  return issue(stage, "unknown_block_type", err.message, {
    nodeId: err.nodeId ?? undefined,
    type: err.type ?? undefined,
  });
}

function applyRegistryViolations(
  nodes: Record<string, { id?: string; type?: string; data?: object }>,
  stage: StrictValidationStage,
  errors: StrictValidationIssue[],
  failFast: boolean,
): void {
  for (const v of collectRegistryViolations(nodes)) {
    pushOrThrow(
      errors,
      issue(stage, v.code, v.message, {
        nodeId: v.nodeId,
        type: v.type,
      }),
      failFast,
    );
  }
}

export { collectRegistryViolations, enforceRegistryNodeTypes } from "./registryEnforce.js";

/**
 * 1. validateGraph — strict GraphDocument validation (registry + pipeline).
 */
export function validateGraph(
  graphOrDocument: GraphDocumentInput | Record<string, unknown>,
  options: StrictValidationOptions = {},
): StrictValidationResult {
  const failFast = options.failFast !== false;
  const errors: StrictValidationIssue[] = [];
  const warnings: StrictValidationIssue[] = [];

  let document: ReturnType<typeof createGraphDocument>;
  try {
    document = createGraphDocument(graphOrDocument);
  } catch (err) {
    if (err instanceof UnknownBlockTypeError) {
      const registryIssue = fromUnknownBlockTypeError("graph", err);
      errors.push(registryIssue);
      if (failFast) {
        throw new StrictValidationError(registryIssue);
      }
      return {
        ok: false,
        stage: "graph",
        errors,
        warnings,
        failFastStopped: false,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    pushOrThrow(
      errors,
      issue("graph", "invalid_document", message),
      failFast,
    );
    return { ok: false, stage: "graph", errors, warnings, failFastStopped: failFast };
  }

  try {
    applyRegistryViolations(document.nodes, "graph", errors, failFast);
  } catch (e) {
    if (e instanceof StrictValidationError) {
      return {
        ok: false,
        stage: "graph",
        errors: [e.issue],
        warnings,
        failFastStopped: true,
        document,
      };
    }
    throw e;
  }

  const registry = validateRegistryGraph(document);
  for (const msg of registry.errors || []) {
    const code = msg.includes("unknown type") ? "unknown_block_type" : "registry_semantic";
    try {
      pushOrThrow(errors, issue("graph", code, msg), failFast);
    } catch (e) {
      if (e instanceof StrictValidationError) {
        return {
          ok: false,
          stage: "graph",
          errors: [e.issue],
          warnings,
          failFastStopped: true,
          document,
        };
      }
      throw e;
    }
  }
  for (const msg of registry.warnings || []) {
    warnings.push(issue("graph", "registry_semantic", msg));
  }

  const pipeline = runGraphValidationPipeline(document, {
    strict: true,
    validationStage: VALIDATION_STAGE.COMPILE,
    allowMissingCallbackHandlers: false,
    includeCallbacks: options.includeCallbacks !== false,
  });

  for (const d of pipeline.errors || []) {
    try {
      pushOrThrow(
        errors,
        issue("graph", d.code || "validation_error", d.message, {
          nodeId: d.nodeId ?? undefined,
          edgeId: d.edgeId ?? undefined,
        }),
        failFast,
      );
    } catch (e) {
      if (e instanceof StrictValidationError) {
        return {
          ok: false,
          stage: "graph",
          errors: [e.issue, ...errors],
          warnings,
          failFastStopped: true,
          document: pipeline.document,
        };
      }
      throw e;
    }
  }

  for (const d of pipeline.warnings || []) {
    warnings.push(
      issue("graph", d.code || "validation_warning", d.message, {
        nodeId: d.nodeId ?? undefined,
        edgeId: d.edgeId ?? undefined,
      }),
    );
  }

  const graphResult = {
    ok: errors.length === 0,
    stage: "graph" as const,
    errors,
    warnings,
    document: pipeline.document,
  };
  if (failFast && errors.length > 0) {
    throw new StrictValidationError(errors[0]);
  }
  return graphResult;
}

/**
 * 2. validateBotIR — strict Bot IR node registry enforcement.
 */
export function validateBotIR(
  botIr: BotIRGraph,
  options: StrictValidationOptions = {},
): StrictValidationResult {
  const failFast = options.failFast !== false;
  const errors: StrictValidationIssue[] = [];
  const warnings: StrictValidationIssue[] = [];

  if (!botIr || !Array.isArray(botIr.nodes)) {
    pushOrThrow(
      errors,
      issue("bot_ir", "invalid_bot_ir", "Bot IR graph is missing nodes"),
      failFast,
    );
    return { ok: false, stage: "bot_ir", errors, warnings, failFastStopped: failFast };
  }

  const nodeIds = new Set<string>();

  for (const node of botIr.nodes) {
    const nodeId = String(node.id || "").trim();
    const rawType = String(node.type || "").trim();

    if (!nodeId) {
      pushOrThrow(
        errors,
        issue("bot_ir", "missing_node_id", "Bot IR node is missing id"),
        failFast,
      );
      continue;
    }

    if (nodeIds.has(nodeId)) {
      pushOrThrow(
        errors,
        issue("bot_ir", "duplicate_node_id", `Duplicate Bot IR node id "${nodeId}"`, {
          nodeId,
        }),
        failFast,
      );
    }
    nodeIds.add(nodeId);

    if (LEGACY_WRAPPER_TYPES.has(rawType) || rawType === "unknown") {
      pushOrThrow(
        errors,
        issue(
          "bot_ir",
          "unknown_block_type",
          `Bot IR node "${nodeId}": type "${rawType || "∅"}" is not allowed`,
          { nodeId, type: rawType || "unknown" },
        ),
        failFast,
      );
      continue;
    }

    try {
      assertRegisteredBlockType(rawType, { nodeId });
      assertBlockCapabilitiesRegistered(rawType);
    } catch (err) {
      if (err instanceof UnknownBlockTypeError) {
        pushOrThrow(errors, fromUnknownBlockTypeError("bot_ir", err), failFast);
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      pushOrThrow(
        errors,
        issue("bot_ir", "unregistered_capability", message, { nodeId, type: rawType }),
        failFast,
      );
      continue;
    }

    if (!blockRegistry[rawType]) {
      pushOrThrow(
        errors,
        issue(
          "bot_ir",
          "unregistered_block_type",
          `Bot IR node "${nodeId}": type "${rawType}" not in blockRegistry`,
          { nodeId, type: rawType },
        ),
        failFast,
      );
    }

    if (!hasOperationContract(rawType)) {
      pushOrThrow(
        errors,
        issue(
          "bot_ir",
          "unregistered_block_type",
          `Bot IR node "${nodeId}": type "${rawType}" not in operation registry`,
          { nodeId, type: rawType },
        ),
        failFast,
      );
    }
  }

  for (const edge of botIr.edges || []) {
    if (!nodeIds.has(edge.source)) {
      pushOrThrow(
        errors,
        issue(
          "bot_ir",
          "dangling_edge",
          `Bot IR edge "${edge.id}": unknown source "${edge.source}"`,
          { edgeId: edge.id },
        ),
        failFast,
      );
    }
    if (!nodeIds.has(edge.target)) {
      pushOrThrow(
        errors,
        issue(
          "bot_ir",
          "dangling_edge",
          `Bot IR edge "${edge.id}": unknown target "${edge.target}"`,
          { edgeId: edge.id },
        ),
        failFast,
      );
    }
  }

  const irResult = { ok: errors.length === 0, stage: "bot_ir" as const, errors, warnings, botIr };
  if (failFast && errors.length > 0) {
    throw new StrictValidationError(errors[0]);
  }
  return irResult;
}

/**
 * 3. validateCompile — full pre-codegen gate (graph → Bot IR → compile validation).
 */
export function validateCompile(
  graphOrDocument: GraphDocumentInput | Record<string, unknown>,
  options: StrictValidationOptions = {},
): StrictValidationResult {
  const failFast = options.failFast !== false;
  const errors: StrictValidationIssue[] = [];
  const warnings: StrictValidationIssue[] = [];

  let graphResult: StrictValidationResult;
  try {
    graphResult = validateGraph(graphOrDocument, {
      ...options,
      failFast,
      includeCallbacks: options.includeCallbacks !== false,
    });
  } catch (e) {
    if (e instanceof StrictValidationError) {
      return {
        ok: false,
        stage: "compile",
        errors: [e.issue],
        warnings,
        failFastStopped: true,
      };
    }
    throw e;
  }

  errors.push(...graphResult.errors);
  warnings.push(...graphResult.warnings);
  if (!graphResult.ok) {
    return {
      ok: false,
      stage: "compile",
      errors,
      warnings,
      document: graphResult.document,
      failFastStopped: graphResult.failFastStopped,
    };
  }

  const document = graphResult.document!;
  let botIr: BotIRGraph;
  try {
    botIr = graphToBotIR(document);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (failFast) {
      throw new StrictValidationError(
        issue("compile", "bot_ir_build_failed", message),
      );
    }
    errors.push(issue("compile", "bot_ir_build_failed", message));
    return { ok: false, stage: "compile", errors, warnings, document };
  }

  let irResult: StrictValidationResult;
  try {
    irResult = validateBotIR(botIr, { ...options, failFast });
  } catch (e) {
    if (e instanceof StrictValidationError) {
      return {
        ok: false,
        stage: "compile",
        errors: [...errors, e.issue],
        warnings,
        document,
        botIr,
        failFastStopped: true,
      };
    }
    throw e;
  }

  errors.push(...irResult.errors);
  warnings.push(...irResult.warnings);
  if (!irResult.ok) {
    return {
      ok: false,
      stage: "compile",
      errors,
      warnings,
      document,
      botIr,
      failFastStopped: irResult.failFastStopped,
    };
  }

  const gate = strictCompileValidation(document, {
    strict: true,
    validationStage: VALIDATION_STAGE.COMPILE,
    includeCallbacks: options.includeCallbacks !== false,
  });

  const blocking = gate.blocking?.length ? gate.blocking : gate.errors || [];
  for (const d of blocking) {
    try {
      pushOrThrow(
        errors,
        issue("compile", d.code || "compile_gate", d.message, {
          nodeId: d.nodeId ?? undefined,
          edgeId: d.edgeId ?? undefined,
        }),
        failFast,
      );
    } catch (e) {
      if (e instanceof StrictValidationError) {
        return {
          ok: false,
          stage: "compile",
          errors: [...errors, e.issue],
          warnings,
          document,
          botIr,
          failFastStopped: true,
        };
      }
      throw e;
    }
  }

  for (const d of gate.warnings || []) {
    warnings.push(
      issue("compile", d.code || "compile_warning", d.message, {
        nodeId: d.nodeId ?? undefined,
        edgeId: d.edgeId ?? undefined,
      }),
    );
  }

  const compileResult = {
    ok: errors.length === 0 && gate.ok,
    stage: "compile" as const,
    errors,
    warnings,
    document,
    botIr,
  };
  if (failFast && errors.length > 0) {
    throw new StrictValidationError(errors[0]);
  }
  return compileResult;
}

/** Assert compile-ready graph; throws StrictValidationError on failure. */
export function assertCompileReady(
  graphOrDocument: GraphDocumentInput | Record<string, unknown>,
  options?: StrictValidationOptions,
): StrictValidationResult {
  const result = validateCompile(graphOrDocument, { ...options, failFast: true });
  if (!result.ok) {
    const first = result.errors[0];
    throw new StrictValidationError(
      first ?? issue("compile", "compile_validation_failed", "Compile validation failed"),
    );
  }
  return result;
}
