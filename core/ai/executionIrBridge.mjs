/**
 * Bridge: semantic flow graph / Bot IR → immutable Execution IR (runtime plan).
 * Bot IR (Canonical AI IR) stays semantic; Execution IR is the executable layer.
 */

import { compileFlowGraphToExecutionIr } from './executionGraphCompiler.mjs';

/**
 * @param {object} flowGraph — from synthesizeFlowGraph()
 */
export function buildExecutionIrFromSemanticFlowGraph(flowGraph) {
  return compileFlowGraphToExecutionIr({
    version: flowGraph?.version,
    nodes: flowGraph?.nodes || [],
    edges: flowGraph?.edges || [],
    capabilities: flowGraph?.capabilities,
    nonLinear: flowGraph?.nonLinear,
    metadata: {
      source: 'semantic_capability_planner',
      taskSubgraphs: flowGraph?.taskSubgraphs,
    },
  });
}
