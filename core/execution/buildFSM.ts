import type { ExecutionGraph, FsmTransition } from "./executionContract";
import { sortFsmTransitions } from "./executionContract";
import {
  buildFsmGraph,
  fsmTransitionsFromGraph,
  type FsmGraph,
} from "./fsmGraph";

export type { FsmGraph } from "./fsmGraph";
export { buildFsmGraph } from "./fsmGraph";

/** Derived FSM view — transition edges from graph-based FSM model. */
export function buildFSM(execution: ExecutionGraph): FsmTransition[] {
  const graph = buildFsmGraph(execution);
  return sortFsmTransitions(fsmTransitionsFromGraph(graph));
}

/** Independent projection for invariant checks. */
export function projectFsmFromExecution(
  execution: ExecutionGraph,
): FsmTransition[] {
  return buildFSM(execution);
}
