/**
 * Keyboard node data → legacy codegen props (inline/buttons text areas).
 */

import { keyboardCodegenAlias, isGraphKeyboardNode } from './keyboard_topology.js';

export function normalizeKeyboardRows(data, nodeType = 'inline_keyboard') {
  const src = data && typeof data === 'object' ? data : {};
  const layout = src.layout === 'reply' || nodeType === 'reply_keyboard' ? 'reply' : 'inline';
  const rows = Array.isArray(src.rows) ? src.rows.map((row) => ({
    buttons: Array.isArray(row?.buttons)
      ? row.buttons.map((btn) => ({
        id: String(btn?.id || ''),
        text: String(btn?.text || 'Кнопка').trim() || 'Кнопка',
        callbackId: String(btn?.callbackId || btn?.callback || '').trim(),
        graphRefId: String(btn?.graphRefId || '').trim(),
        handlerNodeId: String(btn?.handlerNodeId || '').trim(),
        url: btn?.url != null ? String(btn.url) : undefined,
      }))
      : [],
  })) : [];
  return { layout, resizeKeyboard: src.resizeKeyboard !== false, oneTimeKeyboard: Boolean(src.oneTimeKeyboard), rows };
}

export function keyboardDataToCodegenProps(nodeType, data) {
  const kb = normalizeKeyboardRows(data, nodeType);
  if (nodeType === 'reply_keyboard' || kb.layout === 'reply') {
    const labels = kb.rows.flatMap((row) => row.buttons.map((b) => b.text)).filter(Boolean);
    return labels.length ? { rows: labels.join(', ') } : null;
  }
  const lines = kb.rows.flatMap((row) => row.buttons.map((b) => {
    const text = b.text || 'Кнопка';
    const cb = b.callbackId || text;
    return `${text} → ${cb}`;
  })).filter(Boolean);
  return lines.length ? { buttons: lines.join('\n') } : null;
}

export function keyboardNodeToBoundProps(node) {
  const type = String(node?.type || '').trim();
  if (!isGraphKeyboardNode(type)) return null;
  return keyboardDataToCodegenProps(type, node?.data || node?.props);
}

export function keyboardNodeToStackBlock(node) {
  const type = String(node?.type || 'inline_keyboard').trim();
  const data = normalizeKeyboardRows(node?.data || node?.props, type);
  const props = keyboardDataToCodegenProps(type, data) || {};
  return {
    id: node.id,
    type: keyboardCodegenAlias(type),
    props,
    _graphKeyboard: { ...data, nodeType: type },
  };
}
