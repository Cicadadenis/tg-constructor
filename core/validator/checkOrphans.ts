export function checkOrphans(graph: { nodes: any[]; edges: any[] }) {
  const connected = new Set<string>();

  for (const edge of graph.edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }

  return graph.nodes.filter((node) => !connected.has(node.id));
}
