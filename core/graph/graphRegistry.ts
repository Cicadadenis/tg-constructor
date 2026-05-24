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

  "fsm.state": {
    color: "#ec4899",
    category: "state",
  },

  "fsm.input": {
    color: "#f472b6",
    category: "state",
  },

  "fsm.transition": {
    color: "#db2777",
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
