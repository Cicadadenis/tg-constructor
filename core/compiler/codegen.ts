import { parseGraph } from "./parser";
import { normalizeAst } from "./normalizer";
import { validateGraph as validateExecutionAst } from "./validator";
import {
  buildExecutionGraph,
  buildExecutionGraphFromBotIR,
} from "../execution/buildExecutionGraph";
import { assertExecutionInvariants } from "../execution/assertExecutionInvariants";
import { graphToBotIR, type GraphDocumentInput } from "../ir/bot_ir";
import {
  compileGraphDocumentToPython,
  lowerGraphDocumentToExecution,
  type UnifiedCompileOptions,
  type UnifiedCompileResult,
} from "./unifiedCompilePipeline";
import { buildExecutionPlan } from "../runtime/executionPlan";
import { isGraphDocumentShape } from "../../src/constructor/graph_document/graph_schema.js";
import {
  DEFAULT_EXECUTION_POLICY,
  prepareExecutionGraph,
  resolveExecutionPolicy,
  type ExecutionPolicy,
  type PreparedExecutionGraphResult,
} from "../execution/prepareExecutionGraph";
import { buildFSM, buildFsmGraph } from "../execution/buildFSM";
import { buildCallbackRoutes } from "../execution/buildCallbackRoutes";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";
import { buildVisualDbGraphFromBotNodes } from "../db/visual_db_ir";
import { logStep } from "../debug/compilerLogger";
import { CURRENT_VERSION } from "../execution/version";
import type { ExecutionGraph } from "../execution/executionContract";

function visualDbFromExecution(execution: ExecutionGraph) {
  return buildVisualDbGraphFromBotNodes(
    execution.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      payload:
        node.data && typeof node.data === "object"
          ? { ...(node.data as Record<string, unknown>) }
          : {},
    })),
  );
}

export interface CompileGraphOptions extends UnifiedCompileOptions {
  /** Skip build/migrate/validate when middleware already prepared the graph. */
  prepared?: PreparedExecutionGraphResult;
  policy?: ExecutionPolicy;
  /**
   * UI preview: allow graphs with no execution edges yet (start-only drafts).
   * API / strict compile must leave this false.
   */
  allowIncomplete?: boolean;
  /** Canonical GraphDocument input (Visual Graph). */
  graphDocument?: GraphDocumentInput;
}

function isGraphDocumentInput(value: unknown): value is GraphDocumentInput {
  return isGraphDocumentShape(value);
}

function compileGraphImpl(graph: any, options: CompileGraphOptions = {}) {
  if (options.graphDocument || isGraphDocumentInput(graph)) {
    return compileGraphDocumentToPython(
      (options.graphDocument ?? graph) as GraphDocumentInput,
      options,
    );
  }

  const policy = resolveExecutionPolicy(
    options.prepared?.policy ?? options.policy ?? DEFAULT_EXECUTION_POLICY,
  );

  logStep("parse");

  const parsed = parseGraph(graph);

  logStep("normalize");

  const normalized = normalizeAst(parsed);

  logStep("validate");

  validateExecutionAst(normalized);

  logStep("bot_ir");

  const botIr = graphToBotIR({
    schema_version: 2,
    nodes: normalized.nodes,
    edges: normalized.edges,
    metadata: { generatedFrom: "legacy_flow" },
  });

  logStep("execution");

  const built = buildExecutionGraphFromBotIR(
    botIr,
    normalized.version ?? graph.version ?? CURRENT_VERSION,
  );

  if (options.allowIncomplete && built.edges.length === 0) {
    return {
      success: false,
      python: "",
      botIr,
      executionPlan: buildExecutionPlan(botIr),
      execution: built,
      policy,
      compatibilityWarnings: [],
      migration: {
        migratedFrom: built.version,
        migratedTo: built.version,
        stepsApplied: [],
      },
      runtime: {
        execution: built,
        fsm: {},
        fsmGraph: buildFsmGraph(built),
        callbacks: {},
        visualDb: botIr.visualDb,
      },
      empty: true,
    };
  }

  const prepared =
    options.prepared ?? prepareExecutionGraph(built, CURRENT_VERSION, policy);

  const { execution, compatibilityWarnings, migration } = prepared;
  assertExecutionInvariants(execution);

  const fsmGraph = buildFsmGraph(execution);
  const fsm = buildFSM(execution);
  const callbacks = buildCallbackRoutes(execution);
  const visualDb = visualDbFromExecution(execution);

  logStep("generate aiogram");

  const python = generateAiogramBot(execution, prepared.policy);

  return {
    success: true,
    python,
    botIr,
    executionPlan: buildExecutionPlan(botIr),
    execution,
    policy: prepared.policy,
    compatibilityWarnings,
    migration,
    runtime: {
      execution,
      fsm,
      fsmGraph,
      callbacks,
      visualDb: botIr.visualDb,
    },
  };
}

/** Sync compile for UI preview (useMemo). */
export function compileGraphSync(graph: any, options?: CompileGraphOptions) {
  return compileGraphImpl(graph, options);
}

export async function compileGraph(graph: any, options?: CompileGraphOptions) {
  return compileGraphImpl(graph, options);
}

export type {
  ExecutionGraph,
  ExecutionPolicy,
  PreparedExecutionGraphResult,
  CompileGraphOptions,
  UnifiedCompileOptions,
  UnifiedCompileResult,
};

export {
  compileGraphDocumentToPython,
  lowerGraphDocumentToExecution,
};
