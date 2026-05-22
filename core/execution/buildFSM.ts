import type { ExecutionGraph, FsmTransition } from "./executionContract";
import { sortFsmTransitions } from "./executionContract";

/** Derived FSM view — only `state` edges from ExecutionGraph. */
export function buildFSM(execution: ExecutionGraph): FsmTransition[] {
  const transitions = execution.edges
    .filter((e) => e.trigger === "state")
    .map((e) => ({
      from: e.from,
      to: e.to,
    }));

  return sortFsmTransitions(transitions);
}

/** Independent edge-only projection for invariant checks. */
export function projectFsmFromExecution(
  execution: ExecutionGraph,
): FsmTransition[] {
  return buildFSM(execution);
}
