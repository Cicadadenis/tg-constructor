/**
 * Canonical inline_keyboard / reply_keyboard node data model.
 * Supports legacy { rows: [{ buttons: [] }] } and matrix rows: [[btn]].
 */

function uid(prefix = 'btn') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const BUTTON_TYPES = Object.freeze({
  CALLBACK: 'callback',
  URL: 'url',
});

/**
 * @typedef {object} InlineKeyboardButton
 * @property {string} id
 * @property {string} text
 * @property {string} [callbackRef] — graph callback handler node id
 * @property {string} [handlerNodeId]
 * @property {string} [callbackId] — compile-only slug (generated)
 * @property {string} [graphRefId]
 * @property {string} [type]
 * @property {string} [url]
 * @property {string} [action]
 */

/**
 * @param {object} btn
 * @returns {InlineKeyboardButton}
 */
export function normalizeButton(btn = {}) {
  const handlerNodeId = String(
    btn.handlerNodeId || btn.callbackRef || '',
  ).trim();
  return {
    id: String(btn.id || uid()).trim() || uid(),
    text: String(btn.text || 'Кнопка').trim() || 'Кнопка',
    callbackRef: handlerNodeId,
    handlerNodeId,
    callbackId: String(btn.callbackId || btn.callback || '').trim(),
    graphRefId: String(btn.graphRefId || '').trim(),
    type: btn.url || btn.type === BUTTON_TYPES.URL ? BUTTON_TYPES.URL : BUTTON_TYPES.CALLBACK,
    url: btn.url != null ? String(btn.url).trim() : '',
    action: String(btn.action || '').trim(),
  };
}

/**
 * @param {object} raw
 * @param {string} [nodeType]
 */
export function normalizeInlineKeyboardData(raw, nodeType = 'inline_keyboard') {
  const src = raw && typeof raw === 'object' ? raw : {};
  const isReply = nodeType === 'reply_keyboard' || src.layout === 'reply';

  /** @type {InlineKeyboardButton[][]} */
  let matrix = [];

  if (Array.isArray(src.rows) && src.rows.length) {
    const first = src.rows[0];
    if (Array.isArray(first)) {
      matrix = src.rows.map((row) => (
        Array.isArray(row) ? row.map((b) => normalizeButton(b)) : []
      ));
    } else if (first && typeof first === 'object' && Array.isArray(first.buttons)) {
      matrix = src.rows.map((row) => (
        Array.isArray(row?.buttons) ? row.buttons.map((b) => normalizeButton(b)) : []
      ));
    }
  }

  return {
    layout: isReply ? 'reply' : 'inline',
    resize: src.resize !== false && src.resizeKeyboard !== false,
    oneTime: Boolean(src.oneTime ?? src.oneTimeKeyboard),
    persistent: Boolean(src.persistent),
    rows: matrix,
  };
}

/** Persist shape for GraphDocument node.data (codegen-compatible). */
export function serializeInlineKeyboardData(model) {
  const m = normalizeInlineKeyboardData(model);
  return {
    layout: m.layout,
    resizeKeyboard: m.resize,
    oneTimeKeyboard: m.oneTime,
    persistent: m.persistent,
    rows: m.rows.map((row) => ({
      buttons: row.map((btn) => ({
        id: btn.id,
        text: btn.text,
        callbackRef: btn.handlerNodeId || btn.callbackRef || '',
        handlerNodeId: btn.handlerNodeId || '',
        callbackId: btn.callbackId,
        graphRefId: btn.graphRefId,
        type: btn.type,
        url: btn.url || undefined,
        action: btn.action || undefined,
      })),
    })),
  };
}

export function countButtons(model) {
  const m = normalizeInlineKeyboardData(model);
  return m.rows.reduce((n, row) => n + row.length, 0);
}

export function flattenButtons(model) {
  const m = normalizeInlineKeyboardData(model);
  return m.rows.flat();
}

/** Canvas / preview: «Да · Нет / Назад» */
export function formatKeyboardCanvasPreview(model, maxRows = 3, maxPerRow = 4) {
  const m = normalizeInlineKeyboardData(model);
  if (!m.rows.length) return '';
  const lines = m.rows.slice(0, maxRows).map((row) => {
    const labels = row.slice(0, maxPerRow).map((b) => {
      if (b.type === BUTTON_TYPES.URL) return `🔗${(b.text || 'URL').slice(0, 8)}`;
      const linked = b.handlerNodeId ? '' : ' ⚠';
      return `${(b.text || '?').slice(0, 10)}${linked}`;
    });
    return `[ ${labels.join(' | ')} ]`;
  });
  const extra = m.rows.length > maxRows ? ' …' : '';
  return `${lines.join('\n')}${extra}`;
}

export function emptyInlineKeyboardData(nodeType = 'inline_keyboard') {
  return serializeInlineKeyboardData({
    layout: nodeType === 'reply_keyboard' ? 'reply' : 'inline',
    rows: [],
    resize: true,
    oneTime: false,
    persistent: false,
  });
}
