import { z } from "zod";

import { checkCycles, formatCycleDebugTrace } from "./checkCycles";
import type { ExecutionGraph, NodeId } from "./executionContract";
import { sortEdges } from "./executionContract";
import {
  checkVersionCompatibility,
  CURRENT_VERSION,
  isDevEnvironment,
} from "./version";
import {
  DEFAULT_EXECUTION_POLICY,
  type ExecutionPolicy,
} from "./executionPolicy";
import { validateExecutionGraphRegistry } from "./validateExecutionGraphRegistry.js";
import {
  executionGraphSchema,
  type ExecutionGraphInput,
} from "../../schemas/execution/executionGraph.schema";

export type ExecutionGraphValidationCode =
  | "INVALID_SCHEMA"
  | "INCOMPATIBLE_VERSION"
  | "MISSING_EDGES"
  | "ORPHAN_NODES"
  | "CYCLE_DETECTED"
  | "UNKNOWN_EDGE_NODE"
  | "UNKNOWN_NODE_TYPE"
  | "UNREGISTERED_CAPABILITY";

export class ExecutionGraphValidationError extends Error {
  readonly code: ExecutionGraphValidationCode;
  readonly details?: unknown;

  constructor(
    code: ExecutionGraphValidationCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ExecutionGraphValidationError";
    this.code = code;
    this.details = details;
  }
}

export interface ExecutionGraphValidationResult {
  execution: ExecutionGraph;
  compatibilityWarnings: string[];
}

function findOrphanNodes(execution: ExecutionGraph): NodeId[] {
  const connected = new Set<NodeId>();

  for (const edge of execution.edges) {
    connected.add(edge.from);
    connected.add(edge.to);
  }

  return execution.nodes
    .map((node) => node.id)
    .filter((nodeId) => !connected.has(nodeId));
}

function findUnknownEdgeNodes(execution: ExecutionGraph): string[] {
  const nodeIds = new Set(execution.nodes.map((node) => node.id));
  const unknown: string[] = [];

  for (const edge of execution.edges) {
    if (!nodeIds.has(edge.from)) {
      unknown.push(`edge.from "${edge.from}"`);
    }
    if (!nodeIds.has(edge.to)) {
      unknown.push(`edge.to "${edge.to}"`);
    }
  }

  return [...new Set(unknown)];
}

function resolveVersionCompatibility(version: string): string[] {
  const compatibility = checkVersionCompatibility(version);
  if (!compatibility.compatible) {
    throw new ExecutionGraphValidationError(
      "INCOMPATIBLE_VERSION",
      `ExecutionGraph version "${version}" is not compatible with runtime ${CURRENT_VERSION} (major mismatch)`,
      { version, currentVersion: CURRENT_VERSION },
    );
  }

  if (compatibility.warnings.length > 0 && isDevEnvironment()) {
    for (const warning of compatibility.warnings) {
      console.warn("[ExecutionGraph]", warning);
    }
  }

  return compatibility.warnings;
}

function assertMissingEdges(execution: ExecutionGraph): void {
  if (execution.edges.length === 0) {
    throw new ExecutionGraphValidationError(
      "MISSING_EDGES",
      "ExecutionGraph must contain at least one edge",
    );
  }
}

function assertEdgeNodeReferences(execution: ExecutionGraph): void {
  const unknownEdgeNodes = findUnknownEdgeNodes(execution);
  if (unknownEdgeNodes.length === 0) return;

  throw new ExecutionGraphValidationError(
    "UNKNOWN_EDGE_NODE",
    `ExecutionGraph edge references unknown node(s): ${unknownEdgeNodes.join(", ")}`,
    unknownEdgeNodes,
  );
}

function assertNoOrphanNodes(execution: ExecutionGraph): void {
  const orphanNodes = findOrphanNodes(execution);
  if (orphanNodes.length === 0) return;

  throw new ExecutionGraphValidationError(
    "ORPHAN_NODES",
    `ExecutionGraph contains orphan node(s): ${orphanNodes.join(", ")}`,
    orphanNodes,
  );
}

function assertNoCycles(execution: ExecutionGraph): void {
  const cycleCheck = checkCycles(execution);
  if (!cycleCheck.hasCycle) return;

  throw new ExecutionGraphValidationError(
    "CYCLE_DETECTED",
    [
      "ExecutionGraph contains cyclic execution flow",
      formatCycleDebugTrace(cycleCheck.cycles, cycleCheck.edgeChains),
    ].join("\n"),
    cycleCheck,
  );
}

export function parseExecutionGraph(input: unknown): ExecutionGraphInput {
  const parsed = executionGraphSchema.safeParse(input);
  if (!parsed.success) {
    throw new ExecutionGraphValidationError(
      "INVALID_SCHEMA",
      "ExecutionGraph schema validation failed",
      z.treeifyError(parsed.error),
    );
  }
  return parsed.data;
}

function normalizeExecutionGraph(parsed: ExecutionGraphInput): ExecutionGraph {
  return {
    version: parsed.version,
    nodes: parsed.nodes,
    edges: sortEdges(parsed.edges),
  };
}

/**
 * Single source of truth for ExecutionGraph validation rules.
 * Schema, version compatibility, edge endpoints, missing edges, orphans, cycles.
 */
export function validateExecutionGraphCore(
  input: unknown,
  _policy: ExecutionPolicy = DEFAULT_EXECUTION_POLICY,
): ExecutionGraphValidationResult {
  const parsed = parseExecutionGraph(input);
  const compatibilityWarnings = resolveVersionCompatibility(parsed.version);
  const execution = normalizeExecutionGraph(parsed);

  validateExecutionGraphRegistry(execution);

  assertMissingEdges(execution);
  assertEdgeNodeReferences(execution);
  assertNoOrphanNodes(execution);
  assertNoCycles(execution);

  return { execution, compatibilityWarnings };
}
