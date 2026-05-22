export function resolveDependencies(ast: any) {
  const map = new Map();

  for (const node of ast.nodes) {
    map.set(node.id, {
      ...node,
      dependencies: [],
    });
  }

  for (const edge of ast.edges) {
    const source = map.get(edge.source);

    if (source) {
      source.dependencies.push(edge.target);
    }
  }

  return [...map.values()];
}
