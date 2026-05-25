/**
 * Apply AI assist results to graph editor.
 */

import { addNode as graphAddNode, addEdge as graphAddEdge } from '../constructor/graph_document/graph_operation_client.js';
import { createStudioBlockNode } from '../builder/BuilderComponents.jsx';

/**
 * Insert suggested node after anchor.
 * @param {object} graph
 * @param {string | null} anchorId
 * @param {{ type: string, props?: object }} suggestion
 */
export function insertSuggestedNode(graph, anchorId, suggestion) {
  if (!suggestion?.type) return null;
  const node = createStudioBlockNode(suggestion.type, suggestion.props || {});
  const result = graphAddNode(graph, {
    nodeId: node.id,
    type: suggestion.type,
    data: suggestion.props || {},
    position: nextPosition(graph, anchorId),
  });
  if (!result.ok) return null;

  if (anchorId) {
    graphAddEdge(graph, {
      edgeId: `edge_ai_${anchorId}_${node.id}`,
      source: anchorId,
      target: node.id,
      sourcePort: 'flow',
      targetPort: 'flow',
    });
  }
  return node.id;
}

/**
 * Apply repair operations from AI repair assist.
 * @param {object} graph
 * @param {object} repair
 */
export function applyRepairOperations(graph, repair) {
  const ops = repair?.operations || [];
  if (graph.dispatchBatch && ops.length) {
    return graph.dispatchBatch(ops.map((op) => ({
      type: op.type,
      payload: op.payload,
      meta: op.meta,
    })));
  }
  for (const op of ops) {
    graph.dispatch(op.type, op.payload, op.meta);
  }
  return { ok: true };
}

function nextPosition(graph, anchorId) {
  const doc = graph.getGraphDocument();
  if (anchorId && doc.nodes[anchorId]) {
    const p = doc.nodes[anchorId].position || { x: 0, y: 0 };
    return { x: p.x, y: p.y + 140 };
  }
  const nodes = Object.values(doc.nodes || {});
  if (!nodes.length) return { x: 120, y: 120 };
  const maxY = Math.max(...nodes.map((n) => (n.position?.y || 0) + 120));
  return { x: 120, y: maxY };
}
