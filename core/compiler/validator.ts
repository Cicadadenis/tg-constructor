export function validateGraph(ast: any) {
  const ids = new Set();

  for (const node of ast.nodes) {
    if (ids.has(node.id)) {
      throw new Error("Duplicate node id: " + node.id);
    }

    ids.add(node.id);
  }

  return true;
}
