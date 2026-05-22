import { reactFlowToGraph } from "./reactFlowToGraph.ts";
import { compileGraph } from "../compiler/codegen.ts";

/**
 * React Flow / project flow → Python via graph compiler.
 * @param {{ nodes: any[], edges: any[] }} flow
 */
export function compileFlowToPython(flow) {
  const botGraph = reactFlowToGraph(flow?.nodes || [], flow?.edges || []);
  const result = compileGraph(botGraph);
  return {
    code: result.python || "",
    python: result.python || "",
    compileErrors: [],
    compileWarnings: [],
    transpileTrace: [],
    empty: !result.python,
    resolved: result.resolved,
    success: result.success,
  };
}
