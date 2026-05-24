/**
 * Shared node hit-area / layout metrics for flow node cards + canvas projection.
 */

export {
  NODE_CARD_WIDTH,
  BLOCK_W,
  getFlowNodeCardLayout,
  getCicadaNodeLayout,
} from './nodeCard/nodeCardLayout.js';

/** Movement below this (px) counts as click, not drag (matches React Flow nodeDragThreshold). */
export const NODE_CLICK_DRAG_THRESHOLD_PX = 5;

/**
 * Classify pointer movement as click vs drag.
 * @param {number} dx
 * @param {number} dy
 * @param {number} [threshold]
 */
export function isPointerClickNotDrag(dx, dy, threshold = NODE_CLICK_DRAG_THRESHOLD_PX) {
  return Math.hypot(dx, dy) < threshold;
}
