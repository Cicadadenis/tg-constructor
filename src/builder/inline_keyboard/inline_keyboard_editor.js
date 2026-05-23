/**
 * Pure edits on normalized inline keyboard model (matrix rows).
 */

import {
  normalizeInlineKeyboardData,
  normalizeButton,
  serializeInlineKeyboardData,
} from './inline_keyboard_model.js';

export function createEmptyModel(nodeType = 'inline_keyboard') {
  return normalizeInlineKeyboardData({ rows: [] }, nodeType);
}

export function addRow(model, nodeType) {
  const m = normalizeInlineKeyboardData(model, nodeType);
  m.rows.push([normalizeButton({ text: 'Кнопка' })]);
  return m;
}

export function addButton(model, rowIndex, nodeType, label = 'Кнопка') {
  const m = normalizeInlineKeyboardData(model, nodeType);
  const ri = Math.max(0, Math.min(rowIndex, m.rows.length));
  if (!m.rows[ri]) m.rows[ri] = [];
  m.rows[ri].push(normalizeButton({ text: label }));
  return m;
}

export function removeButton(model, rowIndex, buttonId) {
  const m = normalizeInlineKeyboardData(model);
  if (!m.rows[rowIndex]) return m;
  m.rows[rowIndex] = m.rows[rowIndex].filter((b) => b.id !== buttonId);
  if (m.rows[rowIndex].length === 0) m.rows.splice(rowIndex, 1);
  return m;
}

export function duplicateButton(model, rowIndex, buttonId) {
  const m = normalizeInlineKeyboardData(model);
  const row = m.rows[rowIndex];
  if (!row) return m;
  const src = row.find((b) => b.id === buttonId);
  if (!src) return m;
  const copy = normalizeButton({ ...src, id: undefined });
  row.push(copy);
  return m;
}

export function updateButton(model, rowIndex, buttonId, patch) {
  const m = normalizeInlineKeyboardData(model);
  const row = m.rows[rowIndex];
  if (!row) return m;
  const idx = row.findIndex((b) => b.id === buttonId);
  if (idx < 0) return m;
  row[idx] = normalizeButton({ ...row[idx], ...patch });
  return m;
}

export function moveButton(model, rowIndex, buttonId, dir) {
  const m = normalizeInlineKeyboardData(model);
  const row = m.rows[rowIndex];
  if (!row) return m;
  const idx = row.findIndex((b) => b.id === buttonId);
  if (idx < 0) return m;
  const next = idx + dir;
  if (next < 0 || next >= row.length) return m;
  const tmp = row[idx];
  row[idx] = row[next];
  row[next] = tmp;
  return m;
}

export function moveRow(model, rowIndex, dir) {
  const m = normalizeInlineKeyboardData(model);
  const next = rowIndex + dir;
  if (next < 0 || next >= m.rows.length) return m;
  const tmp = m.rows[rowIndex];
  m.rows[rowIndex] = m.rows[next];
  m.rows[next] = tmp;
  return m;
}

export function setOptions(model, patch) {
  const m = normalizeInlineKeyboardData(model);
  if (patch.resize != null) m.resize = Boolean(patch.resize);
  if (patch.oneTime != null) m.oneTime = Boolean(patch.oneTime);
  if (patch.persistent != null) m.persistent = Boolean(patch.persistent);
  return m;
}

export function bindButtonHandler(model, rowIndex, buttonId, handler) {
  const handlerNodeId = String(handler?.ownerNodeId || handler?.handlerNodeId || '').trim();
  const compileValue = String(handler?.compileValue || '').trim();
  return updateButton(model, rowIndex, buttonId, {
    handlerNodeId,
    callbackRef: handlerNodeId,
    callbackId: compileValue || undefined,
    graphRefId: handler?.id || '',
    type: 'callback',
    url: '',
  });
}

export function toNodeData(model) {
  return serializeInlineKeyboardData(model);
}
