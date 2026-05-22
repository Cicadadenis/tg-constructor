const graphs = new Map<string, unknown>();

export function registerGraph(id: string, graph: unknown) {
  graphs.set(id, graph);
}

export function getGraph(id: string) {
  return graphs.get(id);
}
