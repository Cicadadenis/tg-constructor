/**
 * Dangling edge repair — remove or reconnect broken graph connections.
 */

import { createGraphDocument } from './graph_document.js';
import { createOperation, applyOperation } from './graph_operations.js';

function activeEdges(document) {
  return Object.values(document?.edges || {}).filter((e) => !e.invalid);
}

/**
 * @param {object} document
 * @returns {{ dangling: object[], valid: object[] }}
 */
export function listDanglingEdges(document) {
  const dangling = [];
  const valid = [];
  for (const edge of Object.values(document?.edges || {})) {
    if (edge.invalid) dangling.push(edge);
    else valid.push(edge);
  }
  return { dangling, valid };
}

/**
 * Remove all invalid/dangling edges from the document.
 * @param {object} document
 * @returns {{ document: object, removed: string[], operations: object[] }}
 */
export function repairDanglingEdges(document, options = {}) {
  const mode = options.mode || 'remove';
  if (mode !== 'remove') {
    throw new Error(`Unsupported repair mode: ${mode}`);
  }
  const { dangling } = listDanglingEdges(document);
  if (!dangling.length) {
    return { document: createGraphDocument(document), removed: [], operations: [] };
  }
  let doc = createGraphDocument({
    ...document,
    nodes: Object.values(document?.nodes || {}),
    edges: Object.values(document?.edges || {}),
    metadata: {
      ...(document?.metadata || {}),
      hydrationDiagnostics: null,
    },
  });
  const removed = [];
  const operations = [];
  for (const edge of dangling) {
    if (!doc.edges[edge.id]) {
      removed.push(edge.id);
      continue;
    }
    const op = createOperation('RemoveEdge', { edgeId: edge.id });
    const result = applyOperation(doc, op);
    if (!result.ok) continue;
    doc = result.document;
    removed.push(edge.id);
    operations.push(op);
  }
  return { document: doc, removed, operations };
}

/**
 * Mark edges invalid when endpoints are missing (post node-delete).
 * @param {object} edges
 * @param {Set<string>} nodeIds
 */
export function markDanglingEdgesInMap(edges, nodeIds) {
  const next = { ...edges };
  for (const [id, edge] of Object.entries(next)) {
    const missingSource = !nodeIds.has(edge.source);
    const missingTarget = !nodeIds.has(edge.target);
    if (!missingSource && !missingTarget) {
      if (edge.invalid) {
        const { invalid, invalidReason, ...clean } = edge;
        next[id] = clean;
      }
      continue;
    }
    const invalidReason = missingSource && missingTarget
      ? 'dangling_both'
      : (missingSource ? 'dangling_source' : 'dangling_target');
    next[id] = { ...edge, invalid: true, invalidReason };
  }
  return next;
}

export function graphHasDanglingEdges(document) {
  return Object.values(document?.edges || {}).some((e) => e.invalid);
}

export function graphHasActiveFlow(document) {
  return activeEdges(document).length > 0;
}

function edgeConnectionKey(edge) {
  return `${edge.source}|${edge.target}|${edge.sourcePort || 'flow'}|${edge.targetPort || 'flow'}`;
}

/**
 * Remove duplicate edges (keeps first occurrence per source/target/port key).
 * @param {object} document
 */
export function repairDuplicateEdges(document) {
  const seen = new Map();
  const toRemove = [];
  for (const edge of Object.values(document?.edges || {})) {
    if (edge.invalid) continue;
    const key = edgeConnectionKey(edge);
    if (seen.has(key)) toRemove.push(edge.id);
    else seen.set(key, edge.id);
  }
  if (!toRemove.length) {
    return { document: createGraphDocument(document), removed: [], operations: [] };
  }
  let doc = createGraphDocument(document);
  const removed = [];
  const operations = [];
  for (const edgeId of toRemove) {
    if (!doc.edges[edgeId]) continue;
    const op = createOperation('RemoveEdge', { edgeId });
    const result = applyOperation(doc, op);
    if (!result.ok) continue;
    doc = result.document;
    removed.push(edgeId);
    operations.push(op);
  }
  return { document: doc, removed, operations };
}

/**
 * Remove self-loop edges.
 * @param {object} document
 */
export function repairSelfLoopEdges(document) {
  const toRemove = Object.values(document?.edges || {})
    .filter((e) => !e.invalid && e.source === e.target)
    .map((e) => e.id);
  if (!toRemove.length) {
    return { document: createGraphDocument(document), removed: [], operations: [] };
  }
  let doc = createGraphDocument(document);
  const removed = [];
  const operations = [];
  for (const edgeId of toRemove) {
    const op = createOperation('RemoveEdge', { edgeId });
    const result = applyOperation(doc, op);
    if (!result.ok) continue;
    doc = result.document;
    removed.push(edgeId);
    operations.push(op);
  }
  return { document: doc, removed, operations };
}

/**
 * Remove edges that fail connection validation (invalid ports / incompatible types).
 * @param {object} document
 * @param {typeof import('./operation_registry.js').validateConnection} validateConnection
 */
export function repairInvalidConnectionEdges(document, validateConnection) {
  const toRemove = [];
  for (const edge of Object.values(document?.edges || {})) {
    if (edge.invalid) continue;
    const v = validateConnection(document, {
      source: edge.source,
      target: edge.target,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      ignoreEdgeId: edge.id,
    });
    if (!v.ok) toRemove.push(edge.id);
  }
  if (!toRemove.length) {
    return { document: createGraphDocument(document), removed: [], operations: [] };
  }
  let doc = createGraphDocument(document);
  const removed = [];
  const operations = [];
  for (const edgeId of toRemove) {
    const op = createOperation('RemoveEdge', { edgeId });
    const result = applyOperation(doc, op);
    if (!result.ok) continue;
    doc = result.document;
    removed.push(edgeId);
    operations.push(op);
  }
  return { document: doc, removed, operations };
}
