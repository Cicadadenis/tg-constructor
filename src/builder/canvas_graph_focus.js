/**
 * Focus canvas after graph mutations (import, drop, AI) — fit viewport + select primary node.
 */

import { computeViewportForNodes } from '../constructor/graph_document/graph_viewport.js';
import {
  pickPrimaryCanvasNodeId,
  shouldShowCanvasOnboardingOverlay,
} from '../constructor/graph_document/graph_canvas_state.js';

/**
 * @param {object} graph — graph editor API
 * @param {{ width?: number, height?: number }} [dims]
 * @param {{ onLayout?: () => void, onSelectNode?: (id: string) => void }} [hooks]
 */
export function focusCanvasAfterGraphMutation(graph, dims = {}, hooks = {}) {
  const doc = graph.getGraphDocument();
  if (shouldShowCanvasOnboardingOverlay(doc)) return null;

  hooks.onLayout?.();
  const nodes = Object.values(doc.nodes || {});
  if (!nodes.length) return null;

  const vp = computeViewportForNodes(nodes, dims);
  graph.setViewport(vp);
  const primaryId = pickPrimaryCanvasNodeId(doc);
  if (primaryId) hooks.onSelectNode?.(primaryId);
  return primaryId;
}

/**
 * rAF-scheduled focus (after projection / layout commit).
 */
export function scheduleCanvasFocusAfterMutation(graph, dims = {}, hooks = {}) {
  if (typeof requestAnimationFrame !== 'function') {
    return focusCanvasAfterGraphMutation(graph, dims, hooks);
  }
  requestAnimationFrame(() => {
    focusCanvasAfterGraphMutation(graph, dims, hooks);
  });
  return null;
}
