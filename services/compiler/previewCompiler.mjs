import { compileGraph } from "../../core/compiler/codegen.ts";

export async function compilePreview(graph, options = {}) {
  const result = await compileGraph(graph, options);

  return {
    success: true,
    python: result.python,
    execution: result.execution,
    compatibilityWarnings: result.compatibilityWarnings,
    migration: result.migration,
    runtime: result.runtime,
  };
}
