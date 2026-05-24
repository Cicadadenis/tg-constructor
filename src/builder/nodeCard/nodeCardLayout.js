/**
 * Flow node card dimensions (replaces puzzle-block metrics on canvas).
 */

import { blockHasBottomTab } from '../blockLayout.js';

export const NODE_CARD_WIDTH = 268;
const HEADER_H = 44;
const META_H = 34;
const BODY_LINE_H = 20;
const BODY_PAD = 20;
const BODY_MIN = 52;
const NODE_HIT_PAD_X = 12;
const NODE_HIT_PAD_Y = 10;

/**
 * @param {number} bodyLineCount
 */
export function cardBodyHeight(bodyLineCount = 1) {
  const lines = Math.max(1, bodyLineCount);
  return Math.max(BODY_MIN, lines * BODY_LINE_H + BODY_PAD);
}

/**
 * @param {object} opts
 * @param {string} opts.type
 * @param {boolean} opts.isChainRoot
 * @param {number} [opts.bodyLineCount]
 * @param {boolean} [opts.canStack]
 * @param {readonly { id: string }[]} [opts.outputPorts]
 */
export function getFlowNodeCardLayout(opts) {
  const {
    type,
    isChainRoot,
    bodyLineCount = 1,
    canStack = true,
    outputPorts = [],
  } = opts;

  const bodyH = cardBodyHeight(bodyLineCount);
  const cardH = HEADER_H + bodyH + META_H;
  const hasTopSocket = !isChainRoot;
  const hasBottomTab = blockHasBottomTab(type, canStack);
  const tabH = hasBottomTab ? 0 : 0;
  const outputs = outputPorts.length
    ? outputPorts
    : [{ id: 'flow', label: null }];

  const hitW = NODE_CARD_WIDTH + NODE_HIT_PAD_X * 2;
  const hitH = cardH + NODE_HIT_PAD_Y * 2 + tabH;

  return {
    width: NODE_CARD_WIDTH,
    height: cardH,
    bodyH,
    headerH: HEADER_H,
    metaH: META_H,
    outerHeight: hitH,
    outerWidth: hitW,
    hitW,
    hitH,
    contentOffsetX: NODE_HIT_PAD_X,
    contentOffsetY: NODE_HIT_PAD_Y,
    hasTopSocket,
    hasBottomTab,
    outputPorts: outputs,
    chainStepY: cardH + 24,
  };
}

/** @deprecated canvas alias */
export function getCicadaNodeLayout(type, isChainRoot, canStack = true, extraBodyH = 0) {
  const bodyLineCount = Math.max(1, Math.ceil(extraBodyH / BODY_LINE_H) + 1);
  return getFlowNodeCardLayout({ type, isChainRoot, bodyLineCount, canStack });
}

export const BLOCK_W = NODE_CARD_WIDTH;
