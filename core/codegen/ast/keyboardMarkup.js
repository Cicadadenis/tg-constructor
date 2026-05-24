/**
 * Emit reply_markup from boundKeyboard on output blocks (compile-time only).
 */

import {
  parseButtonRows,
  parseInlineRows,
  emitReplyKeyboard,
  emitInlineKeyboard,
  toPyIdent,
} from '../keyboards.js';
import { normalizeCallbackData } from '../callbackDataNormalize.js';
import { pyIndent, pyQuote } from '../utils.js';
import { emitForeachInlineKeyboard } from '../foreachCodegen.js';

/** @param {object} ctx */
export function getAnswerTarget(ctx) {
  return ctx?.inCallbackHandler ? 'callback.message' : 'message';
}

/** @param {object} block inline keyboard source */
export function trackInlineCallbackData(block, ctx) {
  if (!ctx.inlineCallbackData) ctx.inlineCallbackData = new Set();
  if (!ctx.callbackPrefixes) ctx.callbackPrefixes = new Set();
  if (block?.type !== 'inline') return;
  for (const row of parseInlineRows(block?.props?.buttons || '')) {
    for (const btn of row) {
      const cb = normalizeCallbackData(btn?.callback_data);
      if (cb && !cb.startsWith('url:')) ctx.inlineCallbackData.add(cb);
    }
  }
}

function keyboardVarName(kb) {
  return `kb_${toPyIdent(kb?.id || kb?.type || 'kb')}`;
}

/**
 * @param {object} kb boundKeyboard
 * @param {object} ctx
 * @returns {string} Python assignment lines (no indent)
 */
function emitKeyboardAssignment(kb, ctx) {
  const varName = keyboardVarName(kb);
  if (kb.type === 'buttons') {
    const rows = parseButtonRows(kb.props?.rows || '');
    return emitReplyKeyboard(rows, varName);
  }
  if (kb.type === 'inline') {
    trackInlineCallbackData(kb, ctx);
    const rows = parseInlineRows(kb.props?.buttons || '');
    return emitInlineKeyboard(rows, varName);
  }
  if (kb.type === 'foreach') {
    return emitForeachInlineKeyboard(kb.props || {}, varName);
  }
  if (kb.type === 'inline_db') {
    const p = kb.props || {};
    const key = p.key || p.dbKey || 'products';
    const prefix = String(p.callbackPrefix || 'cat:');
    const labelField = String(p.labelField || '').trim();
    const idField = String(p.idField || '').trim();
    const textExpr = labelField ? `str(item.get(${pyQuote(labelField)}, item))` : 'str(item)';
    const safePrefix = prefix.replace(/"/g, '\\"');
    const cbExpr = idField
      ? `f"${safePrefix}{item.get(${pyQuote(idField)}, item)}"`
      : `f"${safePrefix}{item}"`;
    return [
      `items = db.get(${pyQuote(key)}, [])`,
      'buttons = []',
      'for item in items:',
      '    buttons.append([',
      '        InlineKeyboardButton(',
      `            text=${textExpr},`,
      `            callback_data=${cbExpr},`,
      '        )',
      '    ])',
      `${varName} = InlineKeyboardMarkup(inline_keyboard=buttons)`,
    ].join('\n');
  }
  return '';
}

/**
 * @param {object} outputBlock message/photo/… with optional boundKeyboard
 * @param {object} ctx
 * @returns {{ prelude: string, suffix: string }}
 */
export function boundKeyboardParts(outputBlock, ctx) {
  const kb = outputBlock?.boundKeyboard;
  if (!kb) return { prelude: '', suffix: '' };
  const ind = pyIndent(ctx.indent ?? 0);
  const raw = emitKeyboardAssignment(kb, ctx);
  if (!raw) return { prelude: '', suffix: '' };
  const prelude = raw
    .split('\n')
    .map((line) => (line ? `${ind}${line}` : ''))
    .filter(Boolean)
    .join('\n');
  const suffix = `, reply_markup=${keyboardVarName(kb)}`;
  return { prelude, suffix };
}

/**
 * @param {object} outputBlock
 * @param {object} ctx
 * @param {string} sendLine single await line
 * @returns {string}
 */
export function wrapOutputWithBoundKeyboard(outputBlock, ctx, sendLine) {
  const { prelude, suffix } = boundKeyboardParts(outputBlock, ctx);
  if (!suffix) return sendLine;
  const line = sendLine.includes('reply_markup=')
    ? sendLine
    : sendLine.replace(/\)\s*$/, `${suffix})`);
  return prelude ? `${prelude}\n${line}` : line;
}
