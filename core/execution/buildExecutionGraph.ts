export function buildExecutionGraph(nodes: any[], edges: any[]) {
  const graph: Record<string, any> = {};

  for (const node of nodes) {
    graph[node.id] = {
      ...node,
      next: [],
    };
  }

  for (const edge of edges) {
    if (graph[edge.source]) {
      graph[edge.source].next.push(edge.target);
    }
  }

  return graph;
}
