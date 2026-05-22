/**
 * Import composed graph fragment into live editor without full document replace.
 */

import { documentToBootstrapOperations } from './graph_import.js';
import { createGraphDocument } from './graph_document.js';

/**
 * Dispatch bootstrap ops for a fragment onto existing graph (no clear).
 * @param {object} graph — editor API with dispatch()
 * @param {import('./graph_document.js').GraphDocument} fragmentDocument
 */
export function importGraphFragment(graph, fragmentDocument) {
  const base = graph.getGraphDocument?.() || null;
  const baseIds = new Set([
    ...Object.keys(base?.nodes || {}),
    ...Object.keys(base?.edges || {}),
  ]);

  const doc = createGraphDocument(fragmentDocument);
  const ops = documentToBootstrapOperations(doc);
  const filtered = ops.filter((op) => {
    if (op.type === 'AddNode') return !baseIds.has(op.payload.nodeId);
    if (op.type === 'AddEdge') return !baseIds.has(op.payload.edgeId);
    return true;
  });

  let last = { ok: true };
  for (const op of filtered) {
    last = graph.dispatch(op);
    if (!last?.ok) return last;
  }
  return { ok: true, applied: filtered.length };
}

/**
 * Merge composed modules into editor: import only nodes/edges not already present.
 * @param {object} graph
 * @param {import('./graph_document.js').GraphDocument} composedDocument — full target after merge
 */
export function importComposedGraph(graph, composedDocument) {
  const current = graph.getGraphDocument?.();
  const currentIds = new Set([
    ...Object.keys(current?.nodes || {}),
    ...Object.keys(current?.edges || {}),
  ]);
  const targetIds = new Set([
    ...Object.keys(composedDocument?.nodes || {}),
    ...Object.keys(composedDocument?.edges || {}),
  ]);

  const isEmpty = currentIds.size === 0;
  if (isEmpty) {
    const ops = documentToBootstrapOperations(composedDocument);
    let last = { ok: true };
    for (const op of ops) {
      last = graph.dispatch(op);
      if (!last?.ok) return last;
    }
    return last;
  }

  const toAddNodes = Object.values(composedDocument.nodes || {}).filter((n) => !currentIds.has(n.id));
  const toAddEdges = Object.values(composedDocument.edges || {}).filter((e) => !currentIds.has(e.id));

  const partial = createGraphDocument({
    schema_version: 1,
    nodes: toAddNodes,
    edges: toAddEdges,
    metadata: composedDocument.metadata,
  });

  return importGraphFragment(graph, partial);
}
