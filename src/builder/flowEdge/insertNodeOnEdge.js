/**
 * Insert a node on an existing flow edge (split edge + auto-reconnect).
 */

import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import { createOperation } from '../../constructor/graph_document/graph_operations.js';
import { applyOperation } from '../../constructor/graph_document/graph_operations.js';
import {
  canConnect,
  getNodePortDescriptors,
  validateGraphSemantics,
} from '../../constructor/graph_document/operation_registry.js';
import { graphResolveNodeType } from '../../constructor/graph_document/graph_node_payload.js';
import { getChainStepBelow } from '../blockLayout.js';

/**
 * @param {string} sourceType
 * @param {string} targetType
 */
function choosePortsByTypes(sourceType, targetType) {
  const srcDesc = getNodePortDescriptors(sourceType);
  const tgtDesc = getNodePortDescriptors(targetType);
  const outs = (srcDesc.outputs || []).slice();
  const ins = (tgtDesc.inputs || []).slice();
  const sortPorts = (a, b) => {
    const pa = a.transport === 'flow' ? 0 : 1;
    const pb = b.transport === 'flow' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return String(a.id || '').localeCompare(String(b.id || ''));
  };
  outs.sort(sortPorts);
  ins.sort(sortPorts);
  for (const o of outs) {
    for (const i of ins) {
      const verdict = canConnect(sourceType, targetType, o.id, i.id);
      if (verdict?.ok) return { sourcePort: o.id, targetPort: i.id };
    }
  }
  return null;
}

/**
 * Prefer ports from the edge being split when still compatible.
 * @param {string} sourceType
 * @param {string} newType
 * @param {string} targetType
 * @param {{ sourcePort?: string, targetPort?: string }} edge
 */
function choosePortsForEdgeSplit(sourceType, newType, targetType, edge) {
  let parentToNew = choosePortsByTypes(sourceType, newType);
  const srcPort = edge.sourcePort || 'flow';
  if (srcPort) {
    const ins = getNodePortDescriptors(newType).inputs || [];
    const matchIn = ins.find((i) => canConnect(sourceType, newType, srcPort, i.id)?.ok);
    if (matchIn) parentToNew = { sourcePort: srcPort, targetPort: matchIn.id };
  }

  let newToTarget = choosePortsByTypes(newType, targetType);
  const tgtPort = edge.targetPort || 'flow';
  if (tgtPort) {
    const outs = getNodePortDescriptors(newType).outputs || [];
    const matchOut = outs.find((o) => canConnect(newType, targetType, o.id, tgtPort)?.ok);
    if (matchOut) newToTarget = { sourcePort: matchOut.id, targetPort: tgtPort };
  }

  return { parentToNew, newToTarget };
}

/** @param {object} doc */
function isSplittableFlowEdge(doc, edge) {
  if (!edge?.source || !edge?.target) return false;
  const sp = edge.sourcePort || 'flow';
  const tp = edge.targetPort || 'flow';
  if (sp === 'keyboard' || tp === 'keyboard') return false;
  const source = doc.nodes[edge.source];
  const target = doc.nodes[edge.target];
  if (!source || !target) return false;
  const sourceType = graphResolveNodeType(source);
  const targetType = graphResolveNodeType(target);
  return Boolean(canConnect(sourceType, targetType, sp, tp)?.ok);
}

/**
 * Plan graph operations to insert a node on an edge.
 * @param {object} document
 * @param {string} edgeId
 * @param {string} nodeId
 * @param {string} type
 * @param {object} props
 * @returns {{ ok: boolean, operations?: object[], nodeId?: string, layoutFrom?: string, error?: string }}
 */
export function planInsertNodeOnEdge(document, edgeId, nodeId, type, props) {
  const doc = createGraphDocument(document);
  const edge = doc.edges[edgeId];
  if (!edge) return { ok: false, error: 'Unknown edge' };
  if (!isSplittableFlowEdge(doc, edge)) {
    return { ok: false, error: 'Edge cannot be split' };
  }

  const sourceNode = doc.nodes[edge.source];
  const targetNode = doc.nodes[edge.target];
  if (!sourceNode || !targetNode) return { ok: false, error: 'Edge endpoints missing' };

  const sourceType = graphResolveNodeType(sourceNode);
  const targetType = graphResolveNodeType(targetNode);
  const { parentToNew, newToTarget } = choosePortsForEdgeSplit(
    sourceType,
    type,
    targetType,
    edge,
  );

  if (!parentToNew || !newToTarget) {
    return { ok: false, error: 'No compatible ports for insertion' };
  }

  const newPos = {
    x: Number(sourceNode.position?.x ?? 0),
    y: Number(sourceNode.position?.y ?? 0) + getChainStepBelow(sourceNode, doc),
  };

  const edgeId1 = `edge_${edge.source}_${nodeId}_${Date.now()}`;
  const edgeId2 = `edge_${nodeId}_${edge.target}_${Date.now() + 1}`;

  const simDoc = {
    nodes: { ...doc.nodes, [nodeId]: { id: nodeId, type, position: newPos, data: props } },
    edges: { ...doc.edges },
    metadata: doc.metadata,
    viewport: doc.viewport,
    ui_state: doc.ui_state,
  };
  delete simDoc.edges[edge.id];
  simDoc.edges[edgeId1] = {
    id: edgeId1,
    source: edge.source,
    target: nodeId,
    sourcePort: parentToNew.sourcePort,
    targetPort: parentToNew.targetPort,
  };
  simDoc.edges[edgeId2] = {
    id: edgeId2,
    source: nodeId,
    target: edge.target,
    sourcePort: newToTarget.sourcePort,
    targetPort: newToTarget.targetPort,
    label: edge.label,
    condition: edge.condition,
  };

  const semantics = validateGraphSemantics(simDoc);
  if (!semantics.ok) {
    const first = semantics.issues?.[0] || semantics.errors?.[0];
    return { ok: false, error: first?.message || first?.code || 'Insertion validation failed' };
  }

  const operations = [
    createOperation('AddNode', { nodeId, type, position: newPos, data: props }),
    createOperation('AddEdge', {
      edgeId: edgeId1,
      source: edge.source,
      target: nodeId,
      sourcePort: parentToNew.sourcePort,
      targetPort: parentToNew.targetPort,
    }),
    createOperation('RemoveEdge', { edgeId: edge.id }),
    createOperation('AddEdge', {
      edgeId: edgeId2,
      source: nodeId,
      target: edge.target,
      sourcePort: newToTarget.sourcePort,
      targetPort: newToTarget.targetPort,
      label: edge.label,
      condition: edge.condition,
    }),
  ];

  return {
    ok: true,
    operations,
    nodeId,
    layoutFrom: edge.source,
  };
}

/**
 * Apply insertion plan to a live graph document (for tests).
 * @param {object} document
 * @param {object[]} operations
 */
export function applyInsertNodeOnEdgePlan(document, operations) {
  let doc = createGraphDocument(document);
  const applied = [];
  for (const op of operations) {
    const result = applyOperation(doc, op);
    if (!result.ok) return { document: doc, ok: false, applied, error: result.error };
    doc = result.document;
    applied.push(op);
  }
  return { document: doc, ok: true, applied };
}

export { isSplittableFlowEdge };
