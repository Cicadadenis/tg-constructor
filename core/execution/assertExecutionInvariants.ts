import type { ExecutionGraph } from "./executionContract";
import { getNextTargets, sortCallbackRoutes, sortFsmTransitions } from "./executionContract";
import { buildFSM, projectFsmFromExecution } from "./buildFSM";
import {
  buildCallbackRoutes,
  projectCallbackRoutesFromExecution,
} from "./buildCallbackRoutes";

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Fail build if ExecutionGraph and derived projections diverge (split-brain guard).
 */
export function assertExecutionInvariants(execution: ExecutionGraph): void {
  for (const node of execution.nodes) {
    if (Object.prototype.hasOwnProperty.call(node, "next")) {
      throw new Error(
        `Execution invariant failed: node "${node.id}" must not carry node.next`,
      );
    }
  }

  const fsmBuilt = sortFsmTransitions(buildFSM(execution));
  const fsmProjected = sortFsmTransitions(projectFsmFromExecution(execution));

  if (!jsonEqual(fsmBuilt, fsmProjected)) {
    throw new Error(
      "Execution invariant failed: FSM projection does not match ExecutionGraph state edges",
    );
  }

  const callbacksBuilt = sortCallbackRoutes(buildCallbackRoutes(execution));
  const callbacksProjected = sortCallbackRoutes(
    projectCallbackRoutesFromExecution(execution),
  );

  if (!jsonEqual(callbacksBuilt, callbacksProjected)) {
    throw new Error(
      "Execution invariant failed: Callback projection does not match ExecutionGraph edges",
    );
  }

  for (const node of execution.nodes) {
    const fromEdges = getNextTargets(execution, node.id);
    const legacyNext = execution.edges
      .filter((e) => e.from === node.id && e.trigger === "next")
      .map((e) => e.to);

    if (!jsonEqual(fromEdges, legacyNext)) {
      throw new Error(
        `Execution invariant failed: next adjacency mismatch for node "${node.id}"`,
      );
    }
  }
}
