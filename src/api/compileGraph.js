import { compileGraph } from "../../core/compiler/codegen.ts";

export async function compileBot(graph) {
  return await compileGraph(graph);
}
