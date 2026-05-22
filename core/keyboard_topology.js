/**
 * Keyboard / reply-capable topology — capability-based validation (not type === message).
 */

/** Nodes that may own an inline or reply keyboard (Telegram reply_markup). */
export const REPLY_CAPABLE_NODES = Object.freeze([
  'message',
  'reply',
  'caption',
  'media',
  'photo',
  'photo_var',
  'video',
  'audio',
  'document',
  'document_var',
  'send_file',
  'sticker',
  'contact',
  'location',
  'poll',
]);

/** First-class graph keyboard node types (preferred). */
export const GRAPH_KEYBOARD_NODE_TYPES = Object.freeze([
  'inline_keyboard',
  'reply_keyboard',
]);

/** Legacy stack keyboard blocks (still bind in linear stacks). */
export const LEGACY_KEYBOARD_NODE_TYPES = Object.freeze([
  'buttons',
  'inline',
  'inline_db',
]);

const REPLY_CAPABLE_SET = new Set(REPLY_CAPABLE_NODES);
const GRAPH_KB_SET = new Set(GRAPH_KEYBOARD_NODE_TYPES);
const ANY_KB_SET = new Set([...GRAPH_KEYBOARD_NODE_TYPES, ...LEGACY_KEYBOARD_NODE_TYPES]);

export function isReplyCapable(type) {
  return REPLY_CAPABLE_SET.has(String(type || '').trim());
}

export function isGraphKeyboardNode(type) {
  return GRAPH_KB_SET.has(String(type || '').trim());
}

export function isLegacyKeyboardNode(type) {
  return LEGACY_KEYBOARD_NODE_TYPES.has(String(type || '').trim());
}

export function isAnyKeyboardNode(type) {
  return ANY_KB_SET.has(String(type || '').trim());
}

/** Codegen stack role alias for bindKeyboards / keyboards.js */
export function keyboardCodegenAlias(type) {
  const t = String(type || '').trim();
  if (t === 'inline_keyboard') return 'inline';
  if (t === 'reply_keyboard') return 'buttons';
  return t;
}

export const KEYBOARD_EDGE_SOURCE_PORT = 'keyboard';
export const KEYBOARD_EDGE_TARGET_PORT = 'keyboard';
