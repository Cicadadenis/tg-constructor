/**
 * Flow node card dimensions — delegates to visual editor layout (300px cards).
 */
export {
  NODE_CARD_WIDTH,
  VISUAL_NODE_CARD_WIDTH,
  getVisualNodeLayout as getFlowNodeCardLayout,
  visualCardBodyHeight as cardBodyHeight,
} from '../visualNodes/visualNodeLayout.js';

import {
  getVisualNodeLayout,
  NODE_CARD_WIDTH,
} from '../visualNodes/visualNodeLayout.js';

/** @deprecated canvas alias */
export function getCicadaNodeLayout(type, isChainRoot, canStack = true, extraBodyH = 0) {
  const bodyLineCount = Math.max(1, Math.ceil(extraBodyH / 22) + 1);
  return getVisualNodeLayout({ isChainRoot, bodyLineCount });
}

export const BLOCK_W = NODE_CARD_WIDTH;
