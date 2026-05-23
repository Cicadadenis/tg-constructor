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
import type { ExecutionGraph } from "../execution/executionContract";
import { CURRENT_VERSION } from "../execution/version";

export interface GraphExecutionResult {
  execution: ExecutionGraph;
  policy: ExecutionPolicy;
  compatibilityWarnings: string[];
  migration: PreparedExecutionGraphResult["migration"];
  fsm: ReturnType<typeof buildFSM>;
  callbacks: ReturnType<typeof buildCallbackRoutes>;
}

export interface ExecuteGraphOptions {
  policy?: ExecutionPolicy;
}

export function executeGraph(
  graph: {
    nodes: any[];
    edges: any[];
    version?: string;
  },
  options: ExecuteGraphOptions = {},
): GraphExecutionResult {
  const policy = resolveExecutionPolicy(options.policy ?? DEFAULT_EXECUTION_POLICY);
  const prepared = prepareExecutionGraph(
    buildExecutionGraph(
      graph.nodes,
      graph.edges,
      graph.version ?? "1.0",
    ),
    CURRENT_VERSION,
    policy,
  );

  assertExecutionInvariants(prepared.execution);

  return {
    execution: prepared.execution,
    policy: prepared.policy,
    compatibilityWarnings: prepared.compatibilityWarnings,
    migration: prepared.migration,
    fsm: buildFSM(prepared.execution),
    callbacks: buildCallbackRoutes(prepared.execution),
  };
}
