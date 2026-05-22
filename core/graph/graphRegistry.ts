export const GRAPH_NODE_REGISTRY = {
  command: {
    color: "#3b82f6",
    category: "handlers",
  },

  message: {
    color: "#22c55e",
    category: "actions",
  },

  callback: {
    color: "#f59e0b",
    category: "callbacks",
  },

  fsm: {
    color: "#ec4899",
    category: "state",
  },
};

const graphs = new Map<string, unknown>();

export function registerGraph(id: string, graph: unknown) {
  graphs.set(id, graph);
}

export function getGraph(id: string) {
  return graphs.get(id);
}
