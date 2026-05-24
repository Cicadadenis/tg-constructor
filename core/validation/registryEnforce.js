/**
 * Registry enforcement — fail-fast on unknown / wrapper node types (shared by pipeline stages).
 */

import {
  assertRegisteredBlockType,
  coerceLegacyBlockType,
  LEGACY_WRAPPER_TYPES,
  UnknownBlockTypeError,
} from '../../src/constructor/graph_document/graph_node_payload.js';
import { getNodeManifestRegistry } from '../node_manifest/nodeManifestRegistry.mjs';

/**
 * @typedef {object} RegistryViolation
 * @property {string} code
 * @property {string} message
 * @property {string} [nodeId]
 * @property {string} [type]
 */

/**
 * @param {Record<string, { id?: string, type?: string, data?: object }> | Array<{ id: string, type?: string, data?: object }>} nodes
 * @returns {RegistryViolation[]}
 */
export function collectRegistryViolations(nodes) {
  /** @type {RegistryViolation[]} */
  const violations = [];
  const list = Array.isArray(nodes)
    ? nodes
    : Object.entries(nodes || {}).map(([id, node]) => ({
        id: node?.id ?? id,
        type: node?.type,
        data: node?.data,
      }));

  for (const node of list) {
    const nodeId = String(node.id || '').trim();
    const rawType = String(node.type ?? '').trim();

    if (!nodeId) {
      violations.push({ code: 'missing_node_id', message: 'Graph node is missing id' });
      continue;
    }

    if (LEGACY_WRAPPER_TYPES.has(rawType) || rawType === 'unknown') {
      violations.push({
        code: 'unknown_block_type',
        message: `Node "${nodeId}": type "${rawType || '∅'}" is not allowed (registry required)`,
        nodeId,
        type: rawType || 'unknown',
      });
      continue;
    }

    try {
      const resolved = coerceLegacyBlockType(node);
      assertRegisteredBlockType(resolved, { nodeId });
      if (!getNodeManifestRegistry().has(resolved)) {
        violations.push({
          code: 'unregistered_block_type',
          message: `Node "${nodeId}": type "${resolved}" is not in NodeManifestRegistry`,
          nodeId,
          type: resolved,
        });
      }
    } catch (err) {
      if (err instanceof UnknownBlockTypeError) {
        violations.push({
          code: 'unknown_block_type',
          message: err.message,
          nodeId: err.nodeId ?? nodeId,
          type: err.type ?? rawType,
        });
        continue;
      }
      throw err;
    }
  }

  return violations;
}

/**
 * @param {Record<string, { id?: string, type?: string, data?: object }>} nodes
 * @param {{ failFast?: boolean }} [options]
 * @returns {RegistryViolation[]}
 */
export function enforceRegistryNodeTypes(nodes, options = {}) {
  const violations = collectRegistryViolations(nodes);
  if (options.failFast && violations.length > 0) {
    const first = violations[0];
    const err = new Error(first.message);
    err.name = 'RegistryEnforcementError';
    err.code = first.code;
    err.nodeId = first.nodeId;
    err.type = first.type;
    throw err;
  }
  return violations;
}
