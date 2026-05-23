import { parseGraph } from "./parser";
import { normalizeAst } from "./normalizer";
import { validateGraph } from "./validator";
import { buildExecutionGraph } from "../execution/buildExecutionGraph";
import { assertExecutionInvariants } from "../execution/assertExecutionInvariants";
import {
  DEFAULT_EXECUTION_POLICY,
  prepareExecutionGraph,
  resolveExecutionPolicy,
  type ExecutionPolicy,
  type PreparedExecutionGraphResult,
} from "../execution/prepareExecutionGraph";
import { buildFSM } from "../execution/buildFSM";
import { buildCallbackRoutes } from "../execution/buildCallbackRoutes";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";
import { logStep } from "../debug/compilerLogger";
import { CURRENT_VERSION } from "../execution/version";
import type { ExecutionGraph } from "../execution/executionContract";

export interface CompileGraphOptions {
  /** Skip build/migrate/validate when middleware already prepared the graph. */
  prepared?: PreparedExecutionGraphResult;
  policy?: ExecutionPolicy;
  /**
   * UI preview: allow graphs with no execution edges yet (start-only drafts).
   * API / strict compile must leave this false.
   */
  allowIncomplete?: boolean;
}

function compileGraphImpl(graph: any, options: CompileGraphOptions = {}) {
  const policy = resolveExecutionPolicy(
    options.prepared?.policy ?? options.policy ?? DEFAULT_EXECUTION_POLICY,
  );

  logStep("parse");

  const parsed = parseGraph(graph);

  logStep("normalize");

  const normalized = normalizeAst(parsed);

  logStep("validate");

  validateGraph(normalized);

  logStep("execution");

  const built = buildExecutionGraph(
    normalized.nodes,
    normalized.edges,
    normalized.version ?? graph.version ?? "1.0",
  );

  if (options.allowIncomplete && built.edges.length === 0) {
    return {
      success: false,
      python: "",
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
        callbacks: {},
      },
      empty: true,
    };
  }

  const prepared =
    options.prepared ?? prepareExecutionGraph(built, CURRENT_VERSION, policy);

  const { execution, compatibilityWarnings, migration } = prepared;
  assertExecutionInvariants(execution);

  const fsm = buildFSM(execution);
  const callbacks = buildCallbackRoutes(execution);

  logStep("generate aiogram");

  const python = generateAiogramBot(execution, prepared.policy);

  return {
    success: true,
    python,
    execution,
    policy: prepared.policy,
    compatibilityWarnings,
    migration,
    runtime: {
      execution,
      fsm,
      callbacks,
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
};
