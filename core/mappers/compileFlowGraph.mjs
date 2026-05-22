import { reactFlowToGraph } from "./reactFlowToGraph.ts";
import { compileGraphSync } from "../compiler/codegen.ts";

/**
 * React Flow / project flow → Python via graph compiler (sync, for UI preview).
 * @param {{ nodes: any[], edges: any[] }} flow
 */
export function compileFlowToPython(flow) {
  const botGraph = reactFlowToGraph(flow?.nodes || [], flow?.edges || []);
  const result = compileGraphSync(botGraph);
  return {
    code: result.python || "",
    python: result.python || "",
    compileErrors: [],
    compileWarnings: [],
    transpileTrace: [],
    empty: !result.python,
    resolved: result.resolved,
    runtime: result.runtime,
    success: result.success,
  };
}
