/**
 * Runtime / execution node registry — scenario is NOT a runtime node.
 */

import { blockCapabilitiesByType } from '../../registry/blockCapabilities.js';
import {
  ALLOWED_FLOW_GRAPH_NODE_TYPES,
  INTENT_ONLY_NODE_TYPES,
  isIntentOnlyNodeType,
} from './executionNodeTypes.mjs';

/** Block types with capability maps that may participate in execution graphs. */
export const RUNTIME_CAPABLE_BLOCK_TYPES = Object.freeze(
  new Set(Object.keys(blockCapabilitiesByType)),
);

export function isRuntimeExecutionBlockType(type) {
  const t = String(type || '').trim();
  if (!t || isIntentOnlyNodeType(t)) return false;
  return RUNTIME_CAPABLE_BLOCK_TYPES.has(t);
}

export function assertNotIntentOnlyRuntimeType(type, context = {}) {
  if (isIntentOnlyNodeType(type)) {
    const label = context.nodeId ? `node "${context.nodeId}"` : 'node';
    throw new Error(
      `${label}: type "${type}" is intent-only and cannot be registered as runtime execution node`,
    );
  }
}

export function listAllowedFlowGraphTypes() {
  return [...ALLOWED_FLOW_GRAPH_NODE_TYPES].sort();
}

export function listIntentOnlyTypes() {
  return [...INTENT_ONLY_NODE_TYPES].sort();
}
