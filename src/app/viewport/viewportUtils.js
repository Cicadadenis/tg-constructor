/**
 * Viewport utilities — fit/compute viewport from GraphDocument nodes.
 * No stack-based viewport calculation.
 */

export { computeViewportForNodes } from '../../constructor/graph_document/graph_viewport.js';

/**
 * Get canvas center position in flow coordinates from stored viewport.
 * @param {object} graph — graph editor API
 * @param {{ width: number, height: number }} canvasDimensions
 * @returns {{ x: number, y: number }}
 */
export function getCanvasCenterInFlowCoords(graph, canvasDimensions) {
  const vp = graph.getCanvasProjection().viewport;
  const w = canvasDimensions?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const h = canvasDimensions?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 720);
  return {
    x: (w / 2 - vp.x) / vp.zoom,
    y: (h / 2 - vp.y) / vp.zoom,
  };
}
