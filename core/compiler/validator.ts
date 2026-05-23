export function validateGraph(ast: any) {
  const ids = new Set<string>();

  for (const node of ast.nodes || []) {
    if (!node?.id) {
      throw new Error("ExecutionGraph node is missing id");
    }
    if (ids.has(node.id)) {
      throw new Error("Duplicate node id: " + node.id);
    }

    ids.add(node.id);
  }

  return true;
}
