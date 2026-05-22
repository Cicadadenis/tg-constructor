import { compileGraph } from "../../core/compiler/codegen.ts";

export function compilePreview(graph) {
  const result = compileGraph(graph);

  return {
    success: true,
    python: result.python,
  };
}
