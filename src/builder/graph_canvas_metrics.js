/**
 * Shared node hit-area / layout metrics for CicadaNode + canvas projection.
 */

import {
  BLOCK_W,
  TAB_OVERLAP,
  getBlockVisualMetrics,
} from './blockLayout.js';

/** Horizontal padding around puzzle shape for easier clicks. */
export const NODE_HIT_PAD_X = 10;

/** Vertical padding (top/bottom) for hit target. */
export const NODE_HIT_PAD_Y = 8;

/** Movement below this (px) counts as click, not drag (matches React Flow nodeDragThreshold). */
export const NODE_CLICK_DRAG_THRESHOLD_PX = 5;

/**
 * @param {string} type
 * @param {boolean} isChainRoot
 * @param {boolean} [canStack]
 * @param {number} [extraBodyH] — e.g. multi-line keyboard preview
 */
export function getCicadaNodeLayout(type, isChainRoot, canStack = true, extraBodyH = 0) {
  const metrics = getBlockVisualMetrics(type, isChainRoot, canStack);
  const bodyH = metrics.height + Math.max(0, extraBodyH);
  const tabH = metrics.hasBottomTab ? TAB_OVERLAP : 0;
  const hitW = BLOCK_W + NODE_HIT_PAD_X * 2;
  const hitH = bodyH + NODE_HIT_PAD_Y * 2 + tabH;
  return {
    ...metrics,
    bodyH,
    tabH,
    hitW,
    hitH,
    outerWidth: hitW,
    outerHeight: hitH,
    contentOffsetX: NODE_HIT_PAD_X,
    contentOffsetY: NODE_HIT_PAD_Y,
  };
}

/**
 * Classify pointer movement as click vs drag.
 * @param {number} dx
 * @param {number} dy
 * @param {number} [threshold]
 */
export function isPointerClickNotDrag(dx, dy, threshold = NODE_CLICK_DRAG_THRESHOLD_PX) {
  return Math.hypot(dx, dy) < threshold;
}
