/**
 * Graph mutation VM — EXECUTION LAYER ONLY (applyOperation + inverses).
 * UI must not import this module; compile in graph_ui_compositions, apply via graph_operation_client.
 */

import { createGraphDocument, withGraphDocumentRevision } from './graph_document.js';
import { markDanglingEdgesInMap } from './graph_edge_repair.js';
import { mergeNodeDataUpdate } from './graph_data_merge.js';
import {
  GRAPH_OPERATION_TYPES,
  normalizeMetadata,
  normalizeOperationType,
  normalizeUiState,
} from './graph_schema.js';
import { VM_LAYER } from './graph_compiler_vm_contract.js';
import { assertNodeTypeInRegistry, normalizeGraphNodePayload } from './graph_node_payload.js';

export { VM_LAYER };

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function fail(document, reason, extra = {}) {
  return { ok: false, document: createGraphDocument(document), error: reason, ...extra };
}

function ok(document, inverse, meta = {}) {
  return {
    ok: true,
    document: withGraphDocumentRevision(document),
    inverse,
    meta,
  };
}

export function createOperation(type, payload = {}, meta = {}) {
  const canonical = normalizeOperationType(type);
  if (!GRAPH_OPERATION_TYPES.includes(canonical)) {
    throw new Error(`Unknown graph operation: ${type}`);
  }
  return Object.freeze({
    id: meta.id || uid('op'),
    type: canonical,
    payload: Object.freeze({ ...payload }),
    timestamp: meta.timestamp ?? Date.now(),
    actorId: meta.actorId ?? null,
    baseRevision: meta.baseRevision ?? null,
  });
}

function applyAddNode(doc, payload, operation) {
  const normalized = normalizeGraphNodePayload(payload);
  const nodeId = normalized.nodeId || uid('node');
  if (doc.nodes[nodeId]) return fail(doc, `Node already exists: ${nodeId}`);
  const node = {
    id: nodeId,
    type: normalized.type,
    position: normalized.position || { x: 260, y: 160 },
    data: { ...normalized.data },
    meta: normalized.meta || {},
  };
  assertNodeTypeInRegistry(node);
  const nodes = { ...doc.nodes, [nodeId]: node };
  return ok(
    { ...doc, nodes },
    createOperation('RemoveNode', { nodeId }, { id: `${operation.id}:inv` }),
    { nodeId },
  );
}

function applyRemoveNode(doc, payload, operation) {
  const nodeId = payload.nodeId;
  const existing = doc.nodes[nodeId];
  if (!existing) return fail(doc, `Unknown node: ${nodeId}`);
  const removedEdges = Object.values(doc.edges).filter(
    (e) => e.source === nodeId || e.target === nodeId,
  );
  const nodes = { ...doc.nodes };
  delete nodes[nodeId];
  const nodeIds = new Set(Object.keys(nodes));
  const edges = {};
  for (const [id, edge] of Object.entries(doc.edges)) {
    if (edge.source === nodeId || edge.target === nodeId) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    const { invalid, invalidReason, ...clean } = edge;
    edges[id] = clean;
  }
  return ok(
    { ...doc, nodes, edges },
    createOperation(
      'AddNode',
      {
        nodeId,
        type: existing.type,
        position: existing.position,
        data: existing.data,
        meta: existing.meta,
        restoreEdges: removedEdges,
      },
      { id: `${operation.id}:inv` },
    ),
    { nodeId, removedEdges },
  );
}

function applyMoveNode(doc, payload, operation) {
  const nodeId = payload.nodeId;
  const existing = doc.nodes[nodeId];
  if (!existing) return fail(doc, `Unknown node: ${nodeId}`);
  const prev = existing.position;
  const nodes = {
    ...doc.nodes,
    [nodeId]: { ...existing, position: { ...payload.position } },
  };
  return ok(
    { ...doc, nodes },
    createOperation('MoveNode', { nodeId, position: prev }, { id: `${operation.id}:inv` }),
    { nodeId },
  );
}

function applyAddEdge(doc, payload, operation) {
  const edgeId = payload.edgeId || uid('edge');
  if (doc.edges[edgeId]) return fail(doc, `Edge already exists: ${edgeId}`);
  const source = payload.source ?? payload.sourceNodeId;
  const target = payload.target ?? payload.targetNodeId;
  if (!doc.nodes[source] || !doc.nodes[target]) {
    return fail(doc, `Edge endpoints must exist (source=${source}, target=${target})`);
  }
  if (source === target) return fail(doc, 'Self-loops are not allowed');
  const edge = {
    id: edgeId,
    source: String(source),
    target: String(target),
    sourcePort: payload.sourcePort || 'flow',
    targetPort: payload.targetPort || 'flow',
    label: payload.label || '',
    condition: payload.condition ?? payload.label ?? '',
  };
  const duplicate = Object.values(doc.edges).some(
    (e) => e.source === edge.source
      && e.target === edge.target
      && e.sourcePort === edge.sourcePort
      && e.targetPort === edge.targetPort,
  );
  if (duplicate) return fail(doc, 'Duplicate edge');
  const edges = { ...doc.edges, [edgeId]: edge };
  return ok(
    { ...doc, edges },
    createOperation('RemoveEdge', { edgeId }, { id: `${operation.id}:inv` }),
    { edgeId },
  );
}

function applyRemoveEdge(doc, payload, operation) {
  const edgeId = payload.edgeId;
  const existing = doc.edges[edgeId];
  if (!existing) return fail(doc, `Unknown edge: ${edgeId}`);
  const edges = { ...doc.edges };
  delete edges[edgeId];
  return ok(
    { ...doc, edges },
    createOperation(
      'AddEdge',
      {
        edgeId,
        source: existing.source,
        target: existing.target,
        sourcePort: existing.sourcePort,
        targetPort: existing.targetPort,
        label: existing.label,
        condition: existing.condition,
      },
      { id: `${operation.id}:inv` },
    ),
    { edgeId },
  );
}

function applyUpdateNodeData(doc, payload, operation) {
  const nodeId = payload.nodeId;
  const existing = doc.nodes[nodeId];
  if (!existing) return fail(doc, `Unknown node: ${nodeId}`);
  const prevData = { ...existing.data };
  const prevMeta = existing.meta != null ? { ...existing.meta } : {};
  const nextData = mergeNodeDataUpdate(existing.data, {
    data: payload.data,
    patch: payload.patch,
  });
  const restoreMetaSnapshot = String(operation.id || '').endsWith(':inv') && payload.meta != null;
  const nodes = {
    ...doc.nodes,
    [nodeId]: {
      ...existing,
      data: nextData,
      meta: payload.meta != null
        ? (restoreMetaSnapshot ? { ...payload.meta } : { ...existing.meta, ...payload.meta })
        : existing.meta,
    },
  };
  return ok(
    { ...doc, nodes },
    createOperation(
      'UpdateNodeData',
      { nodeId, data: prevData, meta: prevMeta },
      { id: `${operation.id}:inv` },
    ),
    { nodeId },
  );
}

function applyUpdateEdge(doc, payload, operation) {
  const edgeId = payload.edgeId;
  const existing = doc.edges[edgeId];
  if (!existing) return fail(doc, `Unknown edge: ${edgeId}`);
  const prev = {
    condition: existing.condition,
    label: existing.label,
    sourcePort: existing.sourcePort,
    targetPort: existing.targetPort,
  };
  const edges = {
    ...doc.edges,
    [edgeId]: {
      ...existing,
      condition: payload.condition != null ? String(payload.condition) : existing.condition,
      label: payload.label != null ? String(payload.label) : existing.label,
      sourcePort: payload.sourcePort != null ? String(payload.sourcePort) : existing.sourcePort,
      targetPort: payload.targetPort != null ? String(payload.targetPort) : existing.targetPort,
    },
  };
  return ok(
    { ...doc, edges },
    createOperation(
      'UpdateEdge',
      { edgeId, ...prev },
      { id: `${operation.id}:inv` },
    ),
    { edgeId },
  );
}

export function applyOperation(document, operation) {
  const doc = createGraphDocument(document);
  const type = normalizeOperationType(operation?.type);
  const payload = operation?.payload || {};
  if (!GRAPH_OPERATION_TYPES.includes(type)) {
    return fail(doc, `Unsupported operation: ${type || 'unknown'}`);
  }

  switch (type) {
    case 'AddNode':
      return applyAddNode(doc, payload, operation);
    case 'RemoveNode':
      return applyRemoveNode(doc, payload, operation);
    case 'MoveNode':
      return applyMoveNode(doc, payload, operation);
    case 'AddEdge':
      return applyAddEdge(doc, payload, operation);
    case 'RemoveEdge':
      return applyRemoveEdge(doc, payload, operation);
    case 'UpdateNodeData':
      return applyUpdateNodeData(doc, payload, operation);
    case 'UpdateEdge':
      return applyUpdateEdge(doc, payload, operation);
    case 'GroupSelection': {
      if (payload.remove) {
        const ui_state = { ...doc.ui_state, groups: [...(payload.restore || [])] };
        return ok(
          { ...doc, ui_state },
          createOperation('GroupSelection', { groupId: payload.groupId, nodeIds: [] }),
          { groupId: payload.groupId },
        );
      }
      const nodeIds = (payload.nodeIds || []).map(String);
      const missing = nodeIds.filter((id) => !doc.nodes[id]);
      if (missing.length) return fail(doc, `Unknown nodes in selection: ${missing.join(', ')}`);
      const groupId = payload.groupId || uid('group');
      const prevGroups = [...(doc.ui_state?.groups || [])];
      const groups = [
        ...prevGroups.filter((g) => g.id !== groupId),
        { id: groupId, label: payload.label || 'Group', nodeIds },
      ];
      const ui_state = { ...doc.ui_state, groups };
      return ok(
        { ...doc, ui_state },
        createOperation(
          'GroupSelection',
          { groupId, remove: true, restore: prevGroups },
          { id: `${operation.id}:inv` },
        ),
        { groupId },
      );
    }
    case 'UpdateViewport': {
      const viewport = {
        x: Number(payload.x ?? doc.viewport?.x ?? 0),
        y: Number(payload.y ?? doc.viewport?.y ?? 0),
        zoom: Number(payload.zoom ?? doc.viewport?.zoom ?? 1),
      };
      const prev = { ...doc.viewport };
      const unchanged =
        Math.abs((prev.x ?? 0) - viewport.x) < 0.01
        && Math.abs((prev.y ?? 0) - viewport.y) < 0.01
        && Math.abs((prev.zoom ?? 1) - viewport.zoom) < 0.0001;
      if (unchanged) {
        return {
          ok: true,
          document: doc,
          inverse: createOperation('UpdateViewport', prev, { id: `${operation.id}:inv` }),
        };
      }
      return ok(
        { ...doc, viewport },
        createOperation('UpdateViewport', prev, { id: `${operation.id}:inv` }),
      );
    }
    case 'UpdateUiState': {
      const prev = normalizeUiState(doc.ui_state);
      const ui_state = normalizeUiState(payload.ui_state ?? {
        ...prev,
        ...(payload.selection != null ? { selection: payload.selection } : {}),
        ...(payload.collapsed != null ? { collapsed: payload.collapsed } : {}),
        ...(payload.groups != null ? { groups: payload.groups } : {}),
      });
      return ok(
        { ...doc, ui_state },
        createOperation('UpdateUiState', { ui_state: prev }, { id: `${operation.id}:inv` }),
      );
    }
    case 'PatchMetadata': {
      const prev = { ...(doc.metadata || {}) };
      const metadata = normalizeMetadata({
        ...prev,
        ...(payload.patch || {}),
        ...(payload.clearHydration ? { hydrationDiagnostics: null } : {}),
      });
      return ok(
        { ...doc, metadata },
        createOperation('PatchMetadata', { patch: prev }, { id: `${operation.id}:inv` }),
      );
    }
    default:
      return fail(doc, `Unhandled operation: ${type}`);
  }
}

/**
 * Atomic edge restore — rolls back to snapshot if any restore step fails.
 */
export function applyOperationWithRestores(document, operation) {
  const snapshot = createGraphDocument(document);
  const result = applyOperation(document, operation);
  if (!result.ok) return result;

  const restoreEdges = operation.type === 'AddNode'
    ? operation.payload?.restoreEdges
    : null;
  if (!Array.isArray(restoreEdges) || restoreEdges.length === 0) {
    return result;
  }

  let nextDoc = result.document;
  const restoredIds = [];
  try {
    for (const edge of restoreEdges) {
      const existing = nextDoc.edges[edge.id];
      const endpointsOk = nextDoc.nodes[edge.source] && nextDoc.nodes[edge.target];
      if (existing?.invalid && endpointsOk) {
        const healed = { ...existing, ...edge, invalid: false };
        delete healed.invalidReason;
        const edges = { ...nextDoc.edges, [edge.id]: healed };
        nextDoc = withGraphDocumentRevision({ ...nextDoc, edges });
        restoredIds.push(edge.id);
        continue;
      }
      if (existing && !existing.invalid) {
        restoredIds.push(edge.id);
        continue;
      }
      const r = applyOperation(nextDoc, createOperation('AddEdge', {
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        sourcePort: edge.sourcePort,
        targetPort: edge.targetPort,
        label: edge.label,
        condition: edge.condition,
      }));
      if (!r.ok) {
        throw new Error(r.error || `Failed to restore edge ${edge.id}`);
      }
      nextDoc = r.document;
      restoredIds.push(edge.id);
    }
  } catch (err) {
    return {
      ok: false,
      document: snapshot,
      error: `Transactional edge restore failed: ${err?.message || String(err)}`,
      meta: { partialRestore: restoredIds, compensatingRollback: true },
    };
  }

  return { ...result, document: nextDoc, meta: { ...(result.meta || {}), restoredEdges: restoredIds } };
}

export { GRAPH_OPERATION_TYPES };
