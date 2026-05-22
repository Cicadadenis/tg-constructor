/**
 * One-time migration utilities — replay bootstrap operations via dispatch only.
 * Not part of useGraphEditor public API.
 */

import { documentToBootstrapOperations } from './graph_import.js';
import { clearGraph } from './graph_ui_orchestrator.js';

export function replayBootstrapOperations(graph, operations) {
  let last = { ok: true };
  for (const op of operations) {
    last = graph.dispatch(op);
    if (!last.ok) return last;
  }
  return last;
}

/** Replace runtime graph from canonical GraphDocument (load / migration). */
export function migrateGraphDocument(graph, document, { clear = true } = {}) {
  if (clear) {
    const cleared = clearGraph(graph);
    if (!cleared.ok) return cleared;
  }
  return replayBootstrapOperations(graph, documentToBootstrapOperations(document));
}

