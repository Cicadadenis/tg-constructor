import { getNodePortDescriptors, canConnect } from '../../constructor/graph_document/operation_registry.js';
import { VISUAL_NODE_CARD_WIDTH as NODE_CARD_WIDTH } from '../visualNodes/visualNodeLayout.js';

const CARD_H_ESTIMATE = 130;

/**
 * Estimate handle center in flow coordinates.
 * @param {import('@xyflow/react').Node} node
 * @param {'target' | 'source'} handleType
 * @param {string | null} handleId
 */
export function estimateHandleCenter(node, handleType, handleId) {
  const x = node.position.x + NODE_CARD_WIDTH / 2;
  if (handleType === 'target') {
    return { x, y: node.position.y + 8 };
  }
  const blockType = node.data?.canvasBlockType || node.type;
  const outs = getNodePortDescriptors(blockType).outputs || [];
  const idx = outs.findIndex((p) => (p.id || 'flow') === (handleId || 'flow'));
  const count = Math.max(outs.length, 1);
  const slot = idx >= 0 ? idx : 0;
  const pct = (slot + 1) / (count + 1);
  return {
    x: node.position.x + NODE_CARD_WIDTH * pct,
    y: node.position.y + CARD_H_ESTIMATE,
  };
}

/**
 * Find nearest compatible target handle for magnetic auto-connect.
 * @param {object} doc — GraphDocument
 * @param {import('@xyflow/react').Node[]} rfNodes
 * @param {{ x: number, y: number }} point — flow coords
 * @param {string} sourceNodeId
 * @param {string} sourceHandleId
 * @param {number} radius
 */
export function findNearestCompatibleTarget(doc, rfNodes, point, sourceNodeId, sourceHandleId, radius) {
  const source = doc.nodes[sourceNodeId];
  if (!source) return null;

  let best = null;
  let bestDist = radius;

  for (const n of rfNodes) {
    if (n.id === sourceNodeId) continue;
    const target = doc.nodes[n.id];
    if (!target) continue;
    const inputs = getNodePortDescriptors(target.type).inputs || [];
    for (const port of inputs) {
      const handleId = port.id || 'flow';
      const compat = canConnect(source.type, target.type, sourceHandleId, handleId);
      if (!compat.ok) continue;
      const center = estimateHandleCenter(n, 'target', handleId);
      const dist = Math.hypot(center.x - point.x, center.y - point.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { nodeId: n.id, handleId };
      }
    }
  }

  return best;
}
