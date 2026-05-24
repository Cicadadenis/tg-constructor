/**
 * Graph fragment builders for composable modules (same layout rules as example flows).
 */

import { getBlockVisualMetrics } from '../../builder/blockLayout.js';

export const MODULE_COL_WIDTH = 280;
export const MODULE_SYSTEM_Y = 20;
export const MODULE_HANDLER_START_Y = 120;

const BRANCHING_SOURCE_TYPES = new Set(['condition', 'condition_not']);

/** @param {string} id @param {string} blockType @param {number} x @param {number} y @param {object} [props] */
export function moduleNode(id, blockType, x, y, props = {}) {
  return {
    id,
    type: blockType,
    position: { x, y },
    data: { ...props },
  };
}

/**
 * @param {string} id
 * @param {string} source
 * @param {string} target
 * @param {{ sourcePort?: string, targetPort?: string, label?: string }} [ports]
 */
export function moduleEdge(id, source, target, ports = {}) {
  return {
    id,
    source,
    target,
    sourceHandle: ports.sourcePort || 'flow',
    targetHandle: ports.targetPort || 'flow',
    sourcePort: ports.sourcePort || 'flow',
    targetPort: ports.targetPort || 'flow',
    ...(ports.label ? { label: ports.label } : {}),
  };
}

/** @param {object[]} nodes @param {object[]} edges */
export function moduleFlow(nodes, edges = []) {
  return { nodes, edges };
}

export function moduleBotNode(id, token = 'YOUR_BOT_TOKEN', col = 0) {
  return moduleNode(id, 'bot', col * MODULE_COL_WIDTH, MODULE_SYSTEM_Y, { token });
}

/**
 * @param {number} col
 * @param {Array<{ id?: string, type: string, props?: object }>} blocks
 * @param {number} [startY]
 */
export function moduleHandlerColumn(col, blocks, startY = MODULE_HANDLER_START_Y) {
  const nodes = [];
  const edges = [];
  const x = col * MODULE_COL_WIDTH;
  let y = startY;
  let prevId = null;
  let prevType = null;
  let pendingFalseSource = null;
  let routeNextToFalse = false;

  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const type = b.type;

    if (type === 'else') {
      routeNextToFalse = true;
      continue;
    }

    const id = b.id || `n_c${col}_${i}`;
    const isRoot = prevId === null;
    nodes.push(moduleNode(id, type, x, y, b.props || {}));

    if (routeNextToFalse && pendingFalseSource) {
      edges.push(moduleEdge(
        `e_c${col}_false_${i}`,
        pendingFalseSource,
        id,
        { sourcePort: 'false', label: 'FALSE' },
      ));
      routeNextToFalse = false;
      pendingFalseSource = null;
      prevId = id;
      prevType = type;
      y += getBlockVisualMetrics(type, isRoot).chainStepY;
      continue;
    }

    if (prevId) {
      let sourcePort = 'flow';
      if (BRANCHING_SOURCE_TYPES.has(prevType)) {
        sourcePort = 'true';
        pendingFalseSource = prevId;
      }
      edges.push(moduleEdge(
        `e_c${col}_${i}`,
        prevId,
        id,
        { sourcePort, label: sourcePort === 'true' ? 'TRUE' : undefined },
      ));
    }

    if (BRANCHING_SOURCE_TYPES.has(type)) {
      pendingFalseSource = id;
    }

    prevId = id;
    prevType = type;
    y += getBlockVisualMetrics(type, isRoot).chainStepY;
  }

  return { nodes, edges };
}

/** @param {number} colBot @param {Array<{ nodes: object[], edges: object[] }>} columns @param {object} [opts] */
export function mergeModuleColumns(colBot, columns, opts = {}) {
  const bot = moduleBotNode(opts.botId || 'n_bot', opts.token, colBot);
  const nodes = [bot];
  const edges = [];
  for (const col of columns) {
    nodes.push(...col.nodes);
    edges.push(...col.edges);
  }
  return moduleFlow(nodes, edges);
}
