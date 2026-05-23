/**
 * Graph hydration — load GraphDocument from persisted blob or cloud project.
 * Validates before hydrating; no stack intermediate.
 */

import { migrateGraphDocument } from '../../constructor/graph_document/graph_migration.js';
import { validateGraphDocumentForEditor } from '../../constructor/graph_document/graph_validate.js';
import { validateGraph } from '../../constructor/graph_document/validate_graph.js';
import { clearGraph } from '../../constructor/graph_document/graph_ui_orchestrator.js';
import { normalizeGraphError } from '../../builder/graph_error_messages.js';
import { computeViewportForNodes } from '../../constructor/graph_document/graph_viewport.js';
import { shouldAutoClearCorruptedGraph } from '../../constructor/graph_document/graph_canvas_state.js';

/**
 * Hydrate graph editor with a loaded canvas blob.
 * Validates the document, migrates if needed, sets viewport.
 * @param {object} graph — graph editor API
 * @param {object} blob — raw persisted canvas data
 * @param {{ document: object, viewport?: object }} loaded — parsed from loadPersistedCanvasBlob
 * @returns {{ ok: boolean, error?: string }}
 */
export function hydrateGraphFromBlob(graph, loaded) {
  if (!loaded?.document) {
    clearGraph(graph);
    graph.setViewport({ x: 0, y: 0, zoom: 1 });
    return { ok: true };
  }

  if (shouldAutoClearCorruptedGraph(loaded.document)) {
    clearGraph(graph);
    graph.setViewport({ x: 0, y: 0, zoom: 1 });
    return { ok: true, clearedCorruption: true };
  }

  const validation = validateGraph(loaded.document);
  if (!validation.ok) {
    clearGraph(graph);
    graph.setViewport({ x: 0, y: 0, zoom: 1 });
    const ux = normalizeGraphError(validation.issues[0] || { code: 'import_failed' }, { lang: 'ru' });
    return { ok: false, error: ux.fix, errorDetail: ux };
  }

  const migrated = migrateGraphDocument(graph, loaded.document);
  if (!migrated?.ok) {
    clearGraph(graph);
    graph.setViewport({ x: 0, y: 0, zoom: 1 });
    return { ok: false, error: migrated?.error || 'Migration failed' };
  }

  const vp = loaded.viewport;
  if (vp && Number.isFinite(vp.x) && Number.isFinite(vp.y) && Number.isFinite(vp.zoom)) {
    graph.setViewport(vp);
  }

  return { ok: true };
}

/**
 * Fit viewport to all current nodes after hydration.
 * @param {object} graph — graph editor API
 * @param {{ width?: number, height?: number }} [dims]
 */
export function fitViewportToNodes(graph, dims = {}) {
  const nodes = Object.values(graph.getGraphDocument().nodes || {});
  if (!nodes.length) return;
  const vp = computeViewportForNodes(nodes, {
    width: dims.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1280),
    height: dims.height ?? (typeof window !== 'undefined' ? window.innerHeight : 720),
  });
  graph.setViewport(vp);
}

export { validateGraphDocumentForEditor, validateGraph, migrateGraphDocument, clearGraph };
