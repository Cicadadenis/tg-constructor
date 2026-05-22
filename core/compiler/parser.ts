import type { BotGraph } from "../../schemas/graph/graph.schema";

export function parseGraph(graph: BotGraph) {
  return {
    version: graph.version,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}
