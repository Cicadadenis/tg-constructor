export function inspectGraph(graph) {
  console.table(
    graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
    })),
  );
}
