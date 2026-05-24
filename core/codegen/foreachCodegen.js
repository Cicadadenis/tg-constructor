/**
 * foreach node — list input, item context (body), optional inline keyboard from list.
 */

import { pyQuote, escapePyKey } from './utils.js';

/** @param {Record<string, unknown>} props */
export function isForeachKeyboardOutput(props) {
  const p = props || {};
  const output = String(p.output ?? p.mode ?? 'body').trim().toLowerCase();
  return (
    output === 'inline_keyboard'
    || output === 'inline'
    || p.keyboard === 'inline'
    || p.generateInline === true
  );
}

function dslRhsToPython(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '[]';
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  if (raw.toLowerCase() === 'true') return 'True';
  if (raw.toLowerCase() === 'false') return 'False';
  if (raw === '[]' || raw === '{}') return raw;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw;
  }
  if (/^[\w\u0400-\u04FF][\w\u0400-\u04FF.]*$/.test(raw)) return raw;
  return pyQuote(raw);
}

/**
 * Emit inline keyboard built from a list (e.g. products).
 * @param {Record<string, unknown>} props list, var, labelField, idField, callbackPrefix, columns
 * @param {string} [varName]
 */
export function emitForeachInlineKeyboard(props, varName = 'kb') {
  const p = props || {};
  const listExpr = dslRhsToPython(p.list ?? p.collection ?? 'products');
  const itemVar = escapePyKey(String(p.var ?? p.item ?? 'product'));
  const labelField = String(p.labelField ?? 'name').trim();
  const idField = String(p.idField ?? 'id').trim();
  const prefix = String(p.callbackPrefix ?? 'prod:').replace(/"/g, '\\"');
  const columns = Math.max(1, Number(p.columns) || 2);

  const textExpr = labelField
    ? `str(${itemVar}.get(${pyQuote(labelField)}, ${itemVar}) if isinstance(${itemVar}, dict) else ${itemVar})`
    : `str(${itemVar})`;
  const cbExpr = idField
    ? `f"${prefix}{${itemVar}.get(${pyQuote(idField)}, ${itemVar}) if isinstance(${itemVar}, dict) else ${itemVar}}"`
    : `f"${prefix}{${itemVar}}"`;

  return [
    `${varName}_rows = []`,
    `${varName}_row = []`,
    `for ${itemVar} in ${listExpr}:`,
    `    ${varName}_row.append(InlineKeyboardButton(text=${textExpr}, callback_data=${cbExpr}))`,
    `    if len(${varName}_row) >= ${columns}:`,
    `        ${varName}_rows.append(${varName}_row)`,
    `        ${varName}_row = []`,
    `if ${varName}_row:`,
    `    ${varName}_rows.append(${varName}_row)`,
    `${varName} = InlineKeyboardMarkup(inline_keyboard=${varName}_rows)`,
  ].join('\n');
}

/**
 * @param {import('./compileCore.js').PythonCodegenContext & { indent?: number }} ctx
 * @param {object} block
 */
export function compileForeachBlock(block, ctx) {
  const p = block?.props || {};
  if (isForeachKeyboardOutput(p)) return '';
  const list = dslRhsToPython(p.list ?? p.collection ?? 'items');
  const itemVar = escapePyKey(String(p.var ?? p.item ?? 'item'));
  const ind = '    '.repeat(Math.max(0, ctx?.indent ?? 0));
  return `${ind}for ${itemVar} in ${list}:`;
}
