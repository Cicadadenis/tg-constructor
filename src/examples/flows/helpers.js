/**
 * Builders for aiogram 3 example graphs (AST-first: keyboards bind to output nodes).
 * Handler columns share one baseline Y; only X shifts per column so chains stack on the canvas.
 */

import { getBlockVisualMetrics } from '../../builder/blockLayout.js';

const COL_WIDTH = 260;
const SYSTEM_Y = 20;
const HANDLER_START_Y = 120;

/** @param {string} id @param {string} blockType @param {number} x @param {number} y @param {object} [props] */
export function node(id, blockType, x, y, props = {}) {
  return {
    id,
    type: blockType,
    position: { x, y },
    data: { ...props },
  };
}

/** @param {string} id @param {string} source @param {string} target */
export function edge(id, source, target) {
  return {
    id,
    source,
    target,
    sourceHandle: 'flow',
    targetHandle: 'flow',
  };
}

/** @param {object[]} nodes @param {object[]} edges */
export function flow(nodes, edges = []) {
  return { nodes, edges };
}

/** System bot token node (separate stack in codegen). */
export function botNode(token = 'YOUR_BOT_TOKEN', col = 0) {
  return node('n_bot', 'bot', col * COL_WIDTH, SYSTEM_Y, { token });
}

/**
 * One handler / system column: blocks chained top-to-bottom (stable stack order).
 * @param {number} col
 * @param {Array<{ id?: string, type: string, props?: object }>} blocks
 * @param {number} [startY]
 */
export function handlerColumn(col, blocks, startY = HANDLER_START_Y) {
  const nodes = [];
  const edges = [];
  const x = col * COL_WIDTH;
  let y = startY;
  let prevId = null;
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const id = b.id || `n_c${col}_${i}`;
    const isRoot = prevId === null;
    nodes.push(node(id, b.type, x, y, b.props || {}));
    if (prevId) {
      edges.push(edge(`e_c${col}_${i}`, prevId, id));
    }
    prevId = id;
    y += getBlockVisualMetrics(b.type, isRoot).chainStepY;
  }
  return { nodes, edges };
}

/** @param {number} col @param {Array<object>} columns @param {object} [opts] */
export function mergeColumns(colBot, columns, opts = {}) {
  const bot = botNode(opts.token, colBot);
  const nodes = [bot];
  const edges = [];
  for (const col of columns) {
    nodes.push(...col.nodes);
    edges.push(...col.edges);
  }
  return flow(nodes, edges);
}
