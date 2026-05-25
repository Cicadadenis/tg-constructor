/**
 * Visual node card dimensions — larger, content-first (ManyChat-style).
 */

export const VISUAL_NODE_CARD_WIDTH = 300;
const HEADER_H = 52;
const META_H = 40;
const BODY_LINE_H = 22;
const BODY_PAD = 24;
const BODY_MIN = 64;
const HIT_PAD_X = 14;
const HIT_PAD_Y = 12;

/**
 * @param {number} bodyLineCount
 */
export function visualCardBodyHeight(bodyLineCount = 1) {
  const lines = Math.max(1, bodyLineCount);
  return Math.max(BODY_MIN, lines * BODY_LINE_H + BODY_PAD);
}

/**
 * @param {object} opts
 * @param {boolean} opts.isChainRoot
 * @param {number} [opts.bodyLineCount]
 * @param {readonly { id: string }[]} [opts.outputPorts]
 */
export function getVisualNodeLayout(opts) {
  const { isChainRoot, bodyLineCount = 1, outputPorts = [] } = opts;
  const bodyH = visualCardBodyHeight(bodyLineCount);
  const cardH = HEADER_H + bodyH + META_H;
  const outputs = outputPorts.length ? outputPorts : [{ id: 'flow' }];
  const hitW = VISUAL_NODE_CARD_WIDTH + HIT_PAD_X * 2;
  const hitH = cardH + HIT_PAD_Y * 2;

  return {
    width: VISUAL_NODE_CARD_WIDTH,
    height: cardH,
    bodyH,
    headerH: HEADER_H,
    metaH: META_H,
    outerHeight: hitH,
    outerWidth: hitW,
    hitW,
    hitH,
    contentOffsetX: HIT_PAD_X,
    contentOffsetY: HIT_PAD_Y,
    hasTopSocket: !isChainRoot,
    outputPorts: outputs,
  };
}

/** @deprecated use VISUAL_NODE_CARD_WIDTH */
export const NODE_CARD_WIDTH = VISUAL_NODE_CARD_WIDTH;

export const BLOCK_W = VISUAL_NODE_CARD_WIDTH;
