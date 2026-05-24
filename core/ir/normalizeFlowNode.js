/**
 * Normalizes React Flow / GraphDocument nodes to IR shape { id, type, props [, semanticId] }.
 * Block type is always resolved via canonical `node.type` (RF: `data.canvasBlockType`).
 */

import {
  resolveCanonicalNodeType,
  stripTypeFieldsFromData,
  UnknownBlockTypeError,
} from '../../src/constructor/graph_document/graph_node_payload.js';

/**
 * @param {unknown} node
 * @returns {{ id: string, type: string, props: Record<string, unknown>, semanticId?: string }}
 */
export function normalizeFlowNode(node) {
  if (!node || typeof node !== 'object') {
    throw new UnknownBlockTypeError('normalizeFlowNode: node is required');
  }
  const id = String(node.id || 'n');
  const data = node.data && typeof node.data === 'object' ? node.data : {};
  const projectedType = String(data.canvasBlockType ?? '').trim();
  const isCanvasProjection = projectedType.length > 0;
  const blockType = resolveCanonicalNodeType({
    id,
    type: isCanvasProjection ? projectedType : node.type,
    data: isCanvasProjection
      ? (data.props && typeof data.props === 'object' ? data.props : {})
      : data,
  });
  const props = stripTypeFieldsFromData(
    isCanvasProjection
      ? (data.props && typeof data.props === 'object' ? data.props : {})
      : data,
  );
  return {
    id,
    type: blockType,
    props,
    semanticId: data.semanticId || data.id || id,
  };
}
