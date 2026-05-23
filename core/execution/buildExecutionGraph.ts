import { CURRENT_VERSION } from "./version";
import type {
  ExecutionEdge,
  ExecutionGraph,
  ExecutionNode,
  ExecutionTrigger,
} from "./executionContract";

function inferTrigger(source: ExecutionNode): ExecutionTrigger {
  if (source.type === "fsm") return "state";
  if (source.type === "callback") return "callback";
  return "next";
}

function toExecutionNode(node: any): ExecutionNode {
  return {
    id: node.id,
    type: node.type,
    data: (node.data && typeof node.data === "object" ? node.data : {}) as Record<
      string,
      unknown
    >,
  };
}

export function buildExecutionGraph(
  nodes: any[],
  edges: any[],
  version = CURRENT_VERSION,
): ExecutionGraph {
  const executionNodes = nodes.map(toExecutionNode);
  const nodeById = new Map(executionNodes.map((n) => [n.id, n]));

  const executionEdges: ExecutionEdge[] = [];

  for (const edge of edges) {
    const source = nodeById.get(edge.source);
    if (!source) continue;

    const trigger = inferTrigger(source);
    const executionEdge: ExecutionEdge = {
      from: edge.source,
      to: edge.target,
      trigger,
    };

    if (trigger === "callback") {
      const callback = String(source.data?.callback ?? source.data?.data ?? "");
      if (callback) executionEdge.condition = callback;
    }

    if (trigger === "state") {
      const state = String(source.data?.state ?? "");
      if (state) executionEdge.condition = state;
    }

    executionEdges.push(executionEdge);
  }

  return {
    version,
    nodes: executionNodes,
    edges: executionEdges,
  };
}
