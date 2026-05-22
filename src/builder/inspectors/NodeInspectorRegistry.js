/**
 * Routes node types to specialized property inspectors (beyond schema fields).
 */

import InlineKeyboardInspector from './InlineKeyboardInspector.jsx';

/** @type {ReadonlySet<string>} */
export const CUSTOM_INSPECTOR_TYPES = Object.freeze(
  new Set(['inline_keyboard', 'reply_keyboard']),
);

/**
 * @param {string} nodeType
 * @returns {boolean}
 */
export function hasCustomInspector(nodeType) {
  return CUSTOM_INSPECTOR_TYPES.has(String(nodeType || '').trim());
}

/**
 * @param {string} nodeType
 * @returns {React.ComponentType|null}
 */
export function resolveNodeInspector(nodeType) {
  const t = String(nodeType || '').trim();
  if (t === 'inline_keyboard' || t === 'reply_keyboard') {
    return InlineKeyboardInspector;
  }
  return null;
}

export { InlineKeyboardInspector };
