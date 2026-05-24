/**
 * Vertical puzzle-block layout metrics (shared by stack UI + layoutChain).
 * Canvas nodes use nodeCard/nodeCardLayout.js for card dimensions.
 */

import { getFlowNodeCardLayout } from './nodeCard/nodeCardLayout.js';
import { graphResolveNodeType } from '../constructor/graph_document/graph_node_payload.js';

export const BLOCK_W = 200;
export const BLOCK_H = 36;
export const ROOT_H = 42;
export const TAB_OVERLAP = 8;

const NO_BOTTOM_TAB = new Set(['stop', 'goto', 'bot', 'version', 'global', 'commands']);

/** @param {boolean} [canStack] */
export function blockHasBottomTab(type, canStack = true) {
  return Boolean(canStack) && !NO_BOTTOM_TAB.has(type);
}

/**
 * @param {string} type
 * @param {boolean} isChainRoot — no incoming flow edge
 * @param {boolean} [canStack]
 */
export function getBlockVisualMetrics(type, isChainRoot, canStack = true) {
  const hasTopSocket = !isChainRoot;
  const hasBottomTab = blockHasBottomTab(type, canStack);
  const h = isChainRoot ? ROOT_H : BLOCK_H;
  return {
    width: BLOCK_W,
    height: h,
    outerHeight: h + (hasBottomTab ? TAB_OVERLAP : 0),
    hasTopSocket,
    hasBottomTab,
    chainStepY: h,
  };
}

export function puzzlePath(w, h, hasTopSocket, hasBottomTab) {
  const R = 6;
  const TW = 10;
  const TH = 8;
  const TX = 22;

  let top = `M ${R} 0`;
  if (hasTopSocket) {
    top += ` L ${TX} 0 C ${TX} -${TH} ${TX + TW} -${TH} ${TX + TW} 0`;
  }
  top += ` L ${w - R} 0 Q ${w} 0 ${w} ${R}`;

  const right = `L ${w} ${h - R} Q ${w} ${h} ${w - R} ${h}`;

  let bottom;
  if (hasBottomTab) {
    bottom = `L ${TX + TW} ${h} C ${TX + TW} ${h + TH} ${TX} ${h + TH} ${TX} ${h} L ${R} ${h} Q 0 ${h} 0 ${h - R}`;
  } else {
    bottom = `L ${R} ${h} Q 0 ${h} 0 ${h - R}`;
  }

  const left = `L 0 ${R} Q 0 0 ${R} 0`;
  return `${top} ${right} ${bottom} ${left} Z`;
}

export function darken(hex, amt = 40) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `rgb(${r},${g},${b})`;
}

/** True when node has an incoming primary-flow edge. */
export function hasIncomingFlowEdge(doc, nodeId) {
  return Object.values(doc.edges || {}).some((e) => {
    if (e.target !== nodeId) return false;
    const port = e.targetPort || 'flow';
    return port === 'flow' || port === 'scenario_flow';
  });
}

/**
 * Y offset from parent to child in a vertical chain.
 * @param {object} parentNode — GraphDocument node
 * @param {object} doc
 */
export function getChainStepBelow(parentNode, doc) {
  if (!parentNode) return 120;
  const isRoot = !hasIncomingFlowEdge(doc, parentNode.id);
  const type = graphResolveNodeType(parentNode);
  return getFlowNodeCardLayout({ type, isChainRoot: isRoot }).chainStepY;
}
