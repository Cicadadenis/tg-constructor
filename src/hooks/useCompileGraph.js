import { reactFlowToGraph } from "../../core/mappers/reactFlowToGraph.ts";
import { compileBot } from "../api/compileGraph.js";

export function useCompileGraph(nodes, edges) {
  const graph = reactFlowToGraph(nodes, edges);

  return compileBot(graph);
}
