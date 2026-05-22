import { buildExecutionGraph } from "../execution/buildExecutionGraph";
import { assertExecutionInvariants } from "../execution/assertExecutionInvariants";
import { buildFSM } from "../execution/buildFSM";
import { buildCallbackRoutes } from "../execution/buildCallbackRoutes";
import type { ExecutionGraph } from "../execution/executionContract";

export interface GraphExecutionResult {
  execution: ExecutionGraph;
  fsm: ReturnType<typeof buildFSM>;
  callbacks: ReturnType<typeof buildCallbackRoutes>;
}

export function executeGraph(graph: {
  nodes: any[];
  edges: any[];
  version?: string;
}): GraphExecutionResult {
  const execution = buildExecutionGraph(
    graph.nodes,
    graph.edges,
    graph.version ?? "1.0",
  );

  assertExecutionInvariants(execution);

  return {
    execution,
    fsm: buildFSM(execution),
    callbacks: buildCallbackRoutes(execution),
  };
}
