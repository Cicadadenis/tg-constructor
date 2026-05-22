import type { CallbackRoute, ExecutionGraph } from "./executionContract";
import { getOutgoingEdges, sortCallbackRoutes } from "./executionContract";

/** Derived callback routing — nodes + outgoing flow edges only. */
export function buildCallbackRoutes(execution: ExecutionGraph): CallbackRoute[] {
  const routes: CallbackRoute[] = [];

  for (const node of execution.nodes) {
    if (node.type !== "callback") continue;

    const callback = String(node.data?.callback ?? node.data?.data ?? "");
    const next = getOutgoingEdges(execution, node.id, ["next", "callback"]).map(
      (e) => e.to,
    );

    routes.push({
      nodeId: node.id,
      callback,
      next,
    });
  }

  return sortCallbackRoutes(routes);
}

/** Independent projection for invariant checks. */
export function projectCallbackRoutesFromExecution(
  execution: ExecutionGraph,
): CallbackRoute[] {
  const routes: CallbackRoute[] = [];

  for (const node of execution.nodes) {
    if (node.type !== "callback") continue;

    const callback = String(node.data?.callback ?? node.data?.data ?? "");
    const next = execution.edges
      .filter(
        (e) =>
          e.from === node.id &&
          (e.trigger === "next" || e.trigger === "callback"),
      )
      .map((e) => e.to);

    routes.push({ nodeId: node.id, callback, next });
  }

  return sortCallbackRoutes(routes);
}
