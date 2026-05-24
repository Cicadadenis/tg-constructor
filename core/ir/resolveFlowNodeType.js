/**
 * Canonical block type for flow / ReactFlow / GraphDocument nodes.
 * node.type is the single source of truth; deprecated data.type is never preferred.
 */

import {
  coerceLegacyBlockType,
  stripTypeFieldsFromData,
} from '../../src/constructor/graph_document/graph_node_payload.js';

/**
 * @param {{ id?: string, type?: string, data?: object, props?: object }} node
 * @returns {string}
 */
export function resolveFlowNodeType(node) {
  return coerceLegacyBlockType({
    id: node?.id,
    type: node?.type,
    data: node?.data,
  });
}

/**
 * Props-only payload (no type / blockType mirrors).
 * @param {{ data?: object, props?: object }} node
 * @returns {Record<string, unknown>}
 */
export function resolveFlowNodeProps(node) {
  const data = node?.data && typeof node.data === 'object' ? node.data : {};
  const props = node?.props && typeof node.props === 'object' ? node.props : {};
  return { ...stripTypeFieldsFromData(data), ...stripTypeFieldsFromData(props) };
}

/**
 * @param {{ data?: object, props?: object, label?: string }} node
 * @param {string} [type]
 */
export function resolveFlowNodeLabel(node, type) {
  const t = type ?? resolveFlowNodeType(node);
  const props = resolveFlowNodeProps(node);
  return String(props.label ?? node?.label ?? t);
}
