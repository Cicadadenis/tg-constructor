export function inspectGraph(graph) {
  const rows = (graph?.nodes || [])
    .filter((n) => n?.id)
    .map((n) => ({
      id: n.id,
      type: n.type,
    }));
  if (rows.length) console.table(rows);
}
