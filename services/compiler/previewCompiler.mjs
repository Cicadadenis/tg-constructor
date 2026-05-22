import { compileGraph } from "../../core/compiler/codegen.ts";

export async function compilePreview(graph) {
  const result = await compileGraph(graph);

  return {
    success: true,
    python: result.python,
    runtime: result.runtime,
    resolved: result.resolved,
  };
}
