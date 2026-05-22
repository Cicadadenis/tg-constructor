/**
 * Node delete helpers — connection summary, downstream chain, batch remove.
 */

import { createGraphDocument } from '../constructor/graph_document/graph_document.js';
import { createOperation, applyOperation } from '../constructor/graph_document/graph_operations.js';
import { getBlockDef, getPaletteBlockTypes } from '../constructor/block_catalog.js';

const FLOW_PORTS = new Set(['flow', 'scenario_flow']);

function uid(prefix = 'n') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(2, 6)}`;
}

/**
 * Edges incident on node.
 * @param {object} document
 * @param {string} nodeId
 */
export function getIncidentEdges(document, nodeId) {
  return Object.values(document?.edges || {}).filter(
    (e) => e.source === nodeId || e.target === nodeId,
  );
}

/**
 * Downstream nodes reachable via flow/scenario_flow edges (not including start).
 * @param {object} document
 * @param {string} startId
 */
export function collectDownstreamFlowChain(document, startId) {
  const doc = createGraphDocument(document);
  const chain = [];
  const visited = new Set([startId]);
  const queue = [startId];

  while (queue.length) {
    const id = queue.shift();
    for (const edge of Object.values(doc.edges || {})) {
      if (edge.source !== id) continue;
      const port = String(edge.sourcePort || 'flow').trim();
      if (!FLOW_PORTS.has(port)) continue;
      const target = edge.target;
      if (!target || visited.has(target)) continue;
      visited.add(target);
      chain.push(target);
      queue.push(target);
    }
  }
  return chain;
}

/**
 * @param {object} document
 * @param {string} nodeId
 */
export function getNodeDeleteSummary(document, nodeId) {
  const doc = createGraphDocument(document);
  const node = doc.nodes[nodeId];
  const incident = getIncidentEdges(doc, nodeId);
  const downstreamChain = collectDownstreamFlowChain(doc, nodeId);
  const def = node ? getBlockDef(node.type, getPaletteBlockTypes()) : null;
  return {
    nodeId,
    node,
    label: def?.label || node?.type || nodeId,
    edgeCount: incident.length,
    flowEdgeCount: incident.filter((e) => (
      FLOW_PORTS.has(String(e.sourcePort || 'flow'))
      || FLOW_PORTS.has(String(e.targetPort || 'flow'))
    )).length,
    downstreamChain,
    needsConfirm: incident.length > 0,
    canDeleteChain: downstreamChain.length > 0,
  };
}

/**
 * Remove one or more nodes (and incident edges per RemoveNode).
 * @returns {{ document: object, operations: object[], ok: boolean }}
 */
export function removeGraphNodes(document, nodeIds) {
  const ids = [...new Set((nodeIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) {
    return { document: createGraphDocument(document), operations: [], ok: false };
  }

  let doc = createGraphDocument(document);
  const operations = [];

  for (const nodeId of ids) {
    const op = createOperation('RemoveNode', { nodeId });
    const result = applyOperation(doc, op);
    if (!result.ok) {
      return { document: doc, operations, ok: false, failedAt: nodeId };
    }
    doc = result.document;
    operations.push(op);
  }

  return { document: doc, operations, ok: true };
}

/**
 * Duplicate node (data clone, offset position). Does not copy edges.
 */
export function duplicateGraphNode(document, nodeId) {
  const doc = createGraphDocument(document);
  const source = doc.nodes[nodeId];
  if (!source) {
    return { document: doc, operations: [], ok: false, newNodeId: null };
  }

  const newNodeId = uid('dup');
  const op = createOperation('AddNode', {
    nodeId: newNodeId,
    type: source.type,
    position: {
      x: Number(source.position?.x ?? 0) + 28,
      y: Number(source.position?.y ?? 0) + 24,
    },
    data: JSON.parse(JSON.stringify(source.data || {})),
    meta: JSON.parse(JSON.stringify(source.meta || {})),
  });
  const result = applyOperation(doc, op);
  if (!result.ok) {
    return { document: doc, operations: [], ok: false, newNodeId: null };
  }
  return {
    document: result.document,
    operations: [op],
    ok: true,
    newNodeId,
  };
}
