/**
 * Flow Graph → Execution IR compiler (execution layer only).
 * Pipeline: Flow Graph → strictExecutionCompilerGate → Execution IR
 */

import { buildExecutionIrFromFlowGraph } from '../runtime/execution/buildExecutionIr.mjs';
import { withExecutionIrCompileGate } from '../runtime/legacyExecutionPolicy.mjs';
import { runStrictExecutionCompilerGate } from '../compiler/strictExecutionCompilerGate.mjs';

/**
 * @param {object} flowGraph — from synthesizeFlowGraph()
 */
export function compileFlowGraphToExecutionIr(flowGraph) {
  return withExecutionIrCompileGate(() => {
    const validated = runStrictExecutionCompilerGate(flowGraph);
    return buildExecutionIrFromFlowGraph(validated);
  });
}
