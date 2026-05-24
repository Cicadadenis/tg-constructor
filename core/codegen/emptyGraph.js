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
  'set_variable',
  'get_variable',
  'get',
  'save',
  'save_global',
  'set_global',
  'condition',
  'condition_not',
  'else',
  'loop',
  'foreach',
  'require_role',
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
 * Only metadata blocks (version, bot, commands, …) — still emit bootstrap bot.py in preview.
 * @param {{ nodes?: unknown[], edges?: unknown[] }} flow
 */
export function isFlowMetadataOnlyForCodegen(flow) {
  const nodes = flow?.nodes || [];
  if (nodes.length === 0) return false;
  for (const node of nodes) {
    const type = blockTypeFromFlowNode(node);
    if (!type || !METADATA_ONLY_TYPES.has(type)) return false;
  }
  return true;
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
/** Canvas content that warrants a bootstrap bot.py in preview when full codegen is empty. */
const PREVIEW_BOOTSTRAP_TRIGGER_TYPES = new Set([
  ...METADATA_ONLY_TYPES,
  'start',
  'command',
  'callback',
  'else',
  'on_text',
  'on_photo',
  'on_voice',
  'on_document',
  'on_sticker',
  'on_location',
  'on_contact',
]);

/**
 * Preview/codegen produced no module but the canvas has settings or entry points
 * (e.g. Version + Start without Bot or without edges yet).
 * @param {{ nodes?: unknown[] }} flow
 * @param {string} [code]
 */
export function shouldEmitPreviewBootstrap(flow, code = '') {
  if (String(code || '').trim()) return false;
  const nodes = flow?.nodes || [];
  if (!nodes.length) return false;
  return nodes.some((node) => {
    const t = blockTypeFromFlowNode(node);
    return PREVIEW_BOOTSTRAP_TRIGGER_TYPES.has(t) || isEventHandlerType(t);
  });
}

export function isStacksEmptyForCodegen(stacks) {
  const nodes = [];
  for (const stack of stacks || []) {
    for (const block of stack?.blocks || []) {
      nodes.push({ type: block.type, data: block.props || {} });
    }
  }
  return isFlowEmptyForCodegen({ nodes, edges: [] });
}
