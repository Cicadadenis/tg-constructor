/**
 * Map Flow Graph / Execution IR nodes → NodeManifest block types.
 */

import { STRUCTURAL_ACTION_TYPES } from '../runtime/execution/validateExecutionIR.mjs';

const EXECUTION_TYPE_TO_MANIFEST = Object.freeze({
  message: 'message',
  input: 'ask',
  button: 'inline',
  condition: 'condition',
});

const PLANNER_ACTION_TO_MANIFEST = Object.freeze({
  remember: 'remember',
  persist: 'save',
  load: 'get',
  send_file: 'send_file',
  terminal: 'stop',
  delegate: 'goto',
  notify: 'message',
  present: 'message',
  route_inline: 'inline',
});

/**
 * Nodes that do not produce capability execution steps (structural only).
 * @param {object} node
 */
export function isNonExecutableFlowNode(node) {
  const planner = String(node?.payload?._plannerType || node?.type || '').trim();
  if (STRUCTURAL_ACTION_TYPES.has(planner)) return true;
  if (node?.type === 'action' && node?.payload?.structuralType) {
    return STRUCTURAL_ACTION_TYPES.has(String(node.payload.structuralType));
  }
  return false;
}

/**
 * @param {object} node — normalized flow graph node
 * @returns {string | null} manifest block type or null when non-executable
 */
export function resolveManifestBlockTypeForFlowNode(node) {
  if (isNonExecutableFlowNode(node)) {
    return null;
  }

  const executionType = String(node?.type || '').trim();
  const planner = String(node?.payload?._plannerType || '').trim();

  if (executionType === 'action') {
    if (node?.payload?.halt || planner === 'terminal') return 'stop';
    if (PLANNER_ACTION_TO_MANIFEST[planner]) {
      return PLANNER_ACTION_TO_MANIFEST[planner];
    }
    return 'message';
  }

  return EXECUTION_TYPE_TO_MANIFEST[executionType] || null;
}
