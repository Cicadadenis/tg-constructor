/**
 * Canvas autosave — localStorage persistence for GraphDocument.
 * Uses only GraphDocument format; no legacy stack blobs.
 */

import {
  persistCanvasBlob,
  loadPersistedCanvasBlob,
} from '../../constructor/graph_document/persist_bridge.js';

export function canvasKeyForUser(user) {
  if (user?.id != null) return `cicada_canvas_u_${user.id}`;
  return 'cicada_canvas';
}

export function loadCanvasForKey(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveCanvasForKey(key, graph) {
  try {
    const vp = graph.getCanvasProjection().viewport;
    const blob = persistCanvasBlob(graph.getGraphDocument());
    blob.viewport = { x: vp.x, y: vp.y, zoom: vp.zoom };
    localStorage.setItem(key, JSON.stringify(blob));
  } catch {
    /* ignore storage errors */
  }
}

export { loadPersistedCanvasBlob };
