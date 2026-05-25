/**
 * Outbound effects → chat entries (Telegram preview).
 */

import { interpolateTemplate } from './variableInterpolation.js';

export function previewFormatFromOutbound(o) {
  const parseMode = String(o?.parse_mode || o?.parseMode || o?.params?.parse_mode || '').toLowerCase();
  if (o?.type === 'html' || parseMode === 'html') return 'html';
  if (o?.type === 'markdown_v2' || parseMode === 'markdownv2' || parseMode === 'markdown_v2') return 'markdown_v2';
  return '';
}

export function previewKeyboardButtonLabel(btn) {
  if (btn == null) return '';
  if (typeof btn === 'string') return btn;
  if (typeof btn === 'object' && btn.text != null) return String(btn.text);
  return String(btn);
}

export function previewKeyboardButtonKey(prefix, rowIndex, colIndex, btn) {
  const label = previewKeyboardButtonLabel(btn);
  const cd = typeof btn === 'object' && btn != null ? String(btn.callback_data ?? '') : label;
  const url = typeof btn === 'object' && btn != null ? String(btn.url ?? '') : '';
  return `${prefix}:r${rowIndex}:c${colIndex}:${label}:${cd}:${url}`;
}

function previewKeyboardRows(keyboard) {
  if (!Array.isArray(keyboard) || keyboard.length === 0) return [];
  if (Array.isArray(keyboard[0])) return keyboard;
  return [keyboard];
}

export function previewNormalizeReplyKeyboard(keyboard) {
  return previewKeyboardRows(keyboard).map((row) =>
    (Array.isArray(row) ? row : [])
      .map((btn) => previewKeyboardButtonLabel(btn))
      .filter((lbl) => lbl.length > 0),
  ).filter((row) => row.length > 0);
}

export function previewNormalizeInlineKeyboard(keyboard) {
  return previewKeyboardRows(keyboard).map((row) =>
    (Array.isArray(row) ? row : []).map((btn) => {
      if (typeof btn === 'string') {
        return { text: btn, callback_data: btn, url: null };
      }
      const text = previewKeyboardButtonLabel(btn);
      return {
        text,
        callback_data: btn?.callback_data != null ? btn.callback_data : text,
        url: btn?.url ?? null,
      };
    }),
  ).filter((row) => row.length > 0);
}

let entrySeq = 0;

function nextEntryId() {
  entrySeq += 1;
  return `msg-${Date.now()}-${entrySeq}`;
}

export function previewOutboundToEntries(outbound, variables = null) {
  const skip = new Set(['answer_callback', 'set_commands']);
  const entries = [];
  for (const o of outbound || []) {
    if (skip.has(o.type)) continue;
    const format = previewFormatFromOutbound(o);
    const rawText = o.text ?? '';
    const text = variables ? interpolateTemplate(rawText, variables) : rawText;
    const id = nextEntryId();
    if (o.type === 'send_message' || o.type === 'markdown' || o.type === 'html' || o.type === 'markdown_v2') {
      entries.push({ id, role: 'bot', kind: 'text', text, format, meta: { effectType: o.type } });
    } else if (o.type === 'reply_keyboard') {
      entries.push({
        id,
        role: 'bot',
        kind: 'reply_keyboard',
        text,
        format,
        keyboard: previewNormalizeReplyKeyboard(o.keyboard),
        meta: { effectType: o.type },
      });
    } else if (o.type === 'inline_keyboard') {
      entries.push({
        id,
        role: 'bot',
        kind: 'inline_keyboard',
        text,
        format,
        rows: previewNormalizeInlineKeyboard(o.keyboard),
        meta: { effectType: o.type },
      });
    } else if (o.type === 'photo') {
      entries.push({
        id,
        role: 'bot',
        kind: 'text',
        text: `[фото] ${o.source ?? ''}${o.caption ? `\n${interpolateTemplate(o.caption, variables)}` : ''}`,
        meta: { effectType: o.type },
      });
    } else if (o.type === 'typing' || o.type === 'chat_action') {
      entries.push({
        id,
        role: 'bot',
        kind: 'typing_marker',
        seconds: Number(o.seconds ?? o.duration ?? 1.2),
        meta: { effectType: o.type },
      });
    } else if (o.type === 'delay' || o.type === 'sleep' || o.type === 'pause') {
      entries.push({
        id,
        role: 'bot',
        kind: 'delay_marker',
        seconds: Number(o.seconds ?? o.duration ?? 1),
        meta: { effectType: o.type },
      });
    } else if (o.type === 'api_call') {
      entries.push({ id, role: 'bot', kind: 'sys', text: `API ${o.method ?? '?'}`, meta: { effectType: o.type } });
    } else {
      entries.push({ id, role: 'bot', kind: 'sys', text: String(o.type || '?'), meta: { effectType: o.type } });
    }
  }
  return entries;
}

export function createUserTextEntry(text) {
  return {
    id: nextEntryId(),
    role: 'user',
    kind: 'text',
    text: String(text ?? ''),
    ts: Date.now(),
  };
}

export function createUserEventEntry(label, eventKind) {
  return {
    id: nextEntryId(),
    role: 'user',
    kind: 'text',
    text: String(label ?? ''),
    ts: Date.now(),
    meta: { eventKind },
  };
}
