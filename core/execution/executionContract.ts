export type ExecutionTrigger = "next" | "callback" | "state";

export interface ExecutionEdge {
  from: string;
  to: string;
  trigger: ExecutionTrigger;
  condition?: string;
}

export interface ExecutionNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ExecutionGraph {
  version: string;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
}

export interface FsmTransition {
  from: string;
  to: string;
}

export interface CallbackRoute {
  nodeId: string;
  callback: string;
  next: string[];
}

export function getNodeById(
  execution: ExecutionGraph,
  nodeId: string,
): ExecutionNode | undefined {
  return execution.nodes.find((n) => n.id === nodeId);
}

export function getOutgoingEdges(
  execution: ExecutionGraph,
  nodeId: string,
  triggers?: ExecutionTrigger[],
): ExecutionEdge[] {
  return execution.edges.filter(
    (e) =>
      e.from === nodeId &&
      (!triggers || triggers.length === 0 || triggers.includes(e.trigger)),
  );
}

/** Derived adjacency — never stored on nodes. */
export function getNextTargets(
  execution: ExecutionGraph,
  nodeId: string,
): string[] {
  return getOutgoingEdges(execution, nodeId, ["next"]).map((e) => e.to);
}

export function sortEdges(edges: ExecutionEdge[]): ExecutionEdge[] {
  return [...edges].sort((a, b) => {
    const ka = `${a.from}\0${a.trigger}\0${a.to}\0${a.condition ?? ""}`;
    const kb = `${b.from}\0${b.trigger}\0${b.to}\0${b.condition ?? ""}`;
    return ka.localeCompare(kb);
  });
}

export function sortFsmTransitions(
  transitions: FsmTransition[],
): FsmTransition[] {
  return [...transitions].sort((a, b) => {
    const ka = `${a.from}\0${a.to}`;
    const kb = `${b.from}\0${b.to}`;
    return ka.localeCompare(kb);
  });
}

export function sortCallbackRoutes(
  routes: CallbackRoute[],
): CallbackRoute[] {
  return [...routes].sort((a, b) => {
    const ka = `${a.nodeId}\0${a.callback}\0${a.next.join(",")}`;
    const kb = `${b.nodeId}\0${b.callback}\0${b.next.join(",")}`;
    return ka.localeCompare(kb);
  });
}
