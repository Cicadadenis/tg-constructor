/**
 * @deprecated Use runStrictExecutionCompilerGate from core/compiler/strictExecutionCompilerGate.mjs.
 * Kept: resolveExecutionContractForFlowNode (IR build) only.
 */

import { runStrictExecutionCompilerGate } from '../compiler/strictExecutionCompilerGate.mjs';
import { getNodeManifestRegistry } from './nodeManifestRegistry.mjs';
import {
  assertValidExecutionContract,
  ExecutionContractValidationError,
} from './executionContract.mjs';
import {
  isNonExecutableFlowNode,
  resolveManifestBlockTypeForFlowNode,
} from './resolveManifestForFlowNode.mjs';

/**
 * @deprecated Superseded by runStrictExecutionCompilerGate — do not call from compiler pipeline.
 */
export function validateFlowGraphExecutionContracts(flowGraph) {
  return runStrictExecutionCompilerGate(flowGraph);
}

/**
 * Resolve frozen contract for a flow node (IR build — gate must have run first).
 * @param {object} node
 */
export function resolveExecutionContractForFlowNode(node) {
  const nodeId = String(node?.id ?? 'unknown');
  const manifestType = resolveManifestBlockTypeForFlowNode(node);
  if (!manifestType) {
    throw new ExecutionContractValidationError(
      `Node ${nodeId}: no ExecutionContract for non-executable node`,
      { nodeId, type: String(node?.type) },
    );
  }
  const manifest = getNodeManifestRegistry().get(manifestType, { nodeId });
  return Object.freeze({
    contract: assertValidExecutionContract(manifest.executionContract, {
      nodeId,
      type: manifestType,
    }),
    manifestBlockType: manifestType,
  });
}

/**
 * @deprecated Post-plan check removed — gate validates contracts before IR build.
 */
export function validateExecutionIrPlanContracts() {
  return { ok: true };
}
