/**
 * When the canvas has no compilable content, skip Python codegen (no bot.py skeleton).
 */

import { normalizeFlowNode } from '../ir/normalizeFlowNode.js';
import { isEventHandlerType } from './constants.js';

const METADATA_ONLY_TYPES = new Set([
  'version',
  'bot',
  'commands',
  'global',
  'set_global',
  'middleware',
  'scenario',
  'step',
  'caption',
]);

const STATEMENT_TYPES = new Set([
  'message',
  'reply',
  'caption',
  'buttons',
  'inline',
  'inline_db',
  'ask',
  'remember',
  'get',
  'save',
  'save_global',
  'set_global',
  'condition',
  'condition_not',
  'else',
  'loop',
  'delay',
  'typing',
  'photo',
  'video',
  'audio',
  'sticker',
  'contact',
  'location',
  'poll',
  'http',
  'goto',
  'use',
  'run',
  'stop',
  'log',
  'notify',
  'menu',
  'random',
  'switch',
  'database',
  'document_send',
  'send_file',
  'payment',
  'analytics',
  'classify',
  'broadcast',
  'forward_msg',
  'call_block',
]);

function blockTypeFromFlowNode(node) {
  return normalizeFlowNode(node).type;
}

/**
 * @param {{ nodes?: unknown[], edges?: unknown[] }} flow
 */
export function isFlowEmptyForCodegen(flow) {
  const nodes = flow?.nodes || [];
  if (nodes.length === 0) return true;

  for (const node of nodes) {
    const type = blockTypeFromFlowNode(node);
    if (isEventHandlerType(type) || type === 'else' || type === 'block') return false;
    if (STATEMENT_TYPES.has(type)) return false;
    if (type && !METADATA_ONLY_TYPES.has(type)) return false;
  }
  return true;
}

/**
 * @param {unknown[]} stacks — legacy editor stacks (optional path)
 */
export function isStacksEmptyForCodegen(stacks) {
  const nodes = [];
  for (const stack of stacks || []) {
    for (const block of stack?.blocks || []) {
      nodes.push({ data: { type: block.type, props: block.props || {} } });
    }
  }
  return isFlowEmptyForCodegen({ nodes, edges: [] });
}
