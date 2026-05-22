import { buildExecutionGraph } from "../execution/buildExecutionGraph";
import { resolveFSMTransitions } from "../execution/fsmTransitions";
import { resolveCallbackRoutes } from "../execution/callbackRoutes";

export function executeGraph(graph: { nodes: any[]; edges: any[] }) {
  const execution = buildExecutionGraph(graph.nodes, graph.edges);

  const fsm = resolveFSMTransitions(execution);

  const callbacks = resolveCallbackRoutes(execution);

  return {
    execution,
    fsm,
    callbacks,
  };
}
