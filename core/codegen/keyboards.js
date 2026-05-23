/**
 * Reply / inline keyboard builders (shared by AST binding + compileCore).
 */

import {
  validateCallbackData,
  validateInlineKeyboardRows,
} from './callbackDataValidation.js';
import { resolveInlineButtonCallback } from './callbackDataNormalize.js';
import { pyIndent, pyQuote, toPyIdent } from './utils.js';

export { validateCallbackData, validateInlineKeyboardRows } from './callbackDataValidation.js';
export {
  normalizeCallbackData,
  resolveInlineButtonCallback,
  expandCallbackMatchKeys,
  callbackKeysMatch,
} from './callbackDataNormalize.js';

export { toPyIdent };

export function parseButtonRows(rowsText) {
  const rows = String(rowsText || '').trim();
  if (!rows) return [];
  const lines = rows.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1 && !rows.includes('[')) {
    const parts = lines[0].split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return [parts];
  }
  return lines.map((line) => {
    const inner = line.replace(/^\[|\]$/g, '').trim();
    return inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  });
}

export function parseInlineRows(buttonsText) {
  const raw = String(buttonsText || '').trim();
  if (!raw) return [];
  const out = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const row = [];
    const cells = t.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean);
    for (const cell of cells) {
      const m = cell.match(/^(.*?)\s*(?:->|=>|→|\|)\s*(.+)$/);
      const text = (m ? m[1] : cell).trim().replace(/^["']|["']$/g, '');
      const explicitCb = m ? m[2].trim().replace(/^["']|["']$/g, '') : '';
      const cb = resolveInlineButtonCallback(text, explicitCb);
      if (text && cb) row.push({ text, callback_data: cb });
    }
    if (row.length) out.push(row);
  }
  return out;
}

export function emitReplyKeyboard(rows, varName = 'kb') {
  const rowExprs = rows
    .map(
      (row) =>
        `[\n${row.map((label) => `${pyIndent(2)}KeyboardButton(text=${pyQuote(label)})`).join(',\n')}\n${pyIndent(1)}]`,
    )
    .join(',\n');
  return [
    `${varName} = ReplyKeyboardMarkup(`,
    `${pyIndent(1)}keyboard=[`,
    rowExprs,
    `${pyIndent(1)}],`,
    `${pyIndent(1)}resize_keyboard=True`,
    `)`,
  ].join('\n');
}

/**
 * @param {Array<Array<{ text?: string, callback_data?: string }>>} rows
 * @returns {string[]} diagnostic messages
 */
export function collectInlineKeyboardValidationIssues(rows) {
  return validateInlineKeyboardRows(rows).map(
    (issue) => `[${issue.row + 1}:${issue.col + 1}] ${issue.message} (${issue.callback_data})`,
  );
}

export function emitInlineKeyboard(rows, varName = 'kb') {
  const issues = validateInlineKeyboardRows(rows);
  if (issues.length > 0) {
    const detail = issues
      .map((i) => `  row ${i.row + 1} col ${i.col + 1}: ${i.message}`)
      .join('\n');
    console.warn('[codegen/keyboards] inline keyboard callback_data validation:\n' + detail);
    throw new Error(
      `Некорректный callback_data в inline-клавиатуре:\n${issues.map((i) => i.message).join('; ')}`,
    );
  }
  const rowExprs = rows
    .map(
      (row) =>
        `[\n${row
          .map(
            (btn) =>
              `${pyIndent(2)}InlineKeyboardButton(text=${pyQuote(btn.text)}, callback_data=${pyQuote(btn.callback_data)})`,
          )
          .join(',\n')}\n${pyIndent(1)}]`,
    )
    .join(',\n');
  return [
    `${varName} = InlineKeyboardMarkup(`,
    `${pyIndent(1)}inline_keyboard=[`,
    rowExprs,
    `${pyIndent(1)}]`,
    `)`,
  ].join('\n');
}
