/**
 * Palette-core inbound event resolution — map Telegram-style events → PaletteEntryV2.
 * UI layer only; compile via compilePaletteAction + applyComposition (unchanged VM/ops).
 */

import { createPaletteEntryV2 } from './palette_core.js';
import {
  compilePaletteAction,
  getPaletteEntry,
} from './graph_ui_palette.js';

const legacyEventRuleWarned = new Set();

/** @typedef {'voice' | 'sticker' | 'text' | 'command' | 'callback' | 'start' | 'photo' | 'document' | 'unknown'} InboundEventKind */

/**
 * Trigger node palette ids for inbound event kinds.
 * @type {Readonly<Record<string, string>>}
 */
export const EVENT_TRIGGER_PALETTE_IDS = Object.freeze({
  voice: 'node:on_voice',
  sticker: 'node:on_sticker',
  text: 'node:on_text',
  command: 'node:command',
  callback: 'node:callback',
  start: 'node:start',
  photo: 'node:on_photo',
  document: 'node:on_document',
});

/**
 * Action palette ids for legacy string-rule migration targets.
 * @type {Readonly<Record<string, string>>}
 */
export const EVENT_ACTION_PALETTE_IDS = Object.freeze({
  delete_key: 'node:db_delete',
  send_sticker: 'node:sticker',
  reply: 'node:message',
});

/** @param {string} rule */
export function warnLegacyEventDsl(rule) {
  const key = String(rule || 'unknown');
  if (legacyEventRuleWarned.has(key)) return;
  legacyEventRuleWarned.add(key);
  console.warn(`[legacy-event-dsl] ${key}`);
}

/**
 * Legacy DSL / string rules → palette entry id + props (warn, never silent).
 * @type {ReadonlyArray<{ id: string, re: RegExp, props: (m: RegExpMatchArray) => object, rule: string }>}
 */
export const LEGACY_EVENT_STRING_RULES = Object.freeze([
  {
    id: EVENT_ACTION_PALETTE_IDS.delete_key,
    re: /^удалить\s+"([^"]+)"/i,
    props: (m) => ({ key: m[1] }),
    rule: 'delete-key:удалить "<key>"',
  },
  {
    id: EVENT_ACTION_PALETTE_IDS.delete_key,
    re: /^delete\s+"([^"]+)"/i,
    props: (m) => ({ key: m[1] }),
    rule: 'delete-key:delete "<key>"',
  },
  {
    id: EVENT_ACTION_PALETTE_IDS.send_sticker,
    re: /^стикер\s+(.+)$/i,
    props: (m) => ({ file_id: String(m[1]).replace(/^["']|["']$/g, '').trim() }),
    rule: 'send-sticker:стикер <file_id>',
  },
  {
    id: 'node:on_sticker',
    re: /^при\s+стикере:?\s*$/i,
    props: () => ({}),
    rule: 'trigger:при стикере',
  },
  {
    id: 'node:on_voice',
    re: /^при\s+голосовом:?\s*$/i,
    props: () => ({}),
    rule: 'trigger:при голосовом',
  },
  {
    id: 'node:command',
    re: /^при\s+команде\s+(.+)$/i,
    props: (m) => ({ cmd: String(m[1]).replace(/^["'/]|["']$/g, '').replace(/^\//, '').trim() }),
    rule: 'trigger:при команде <cmd>',
  },
]);

/**
 * @param {string} line
 * @returns {{ paletteId: string, props: object, rule: string } | null}
 */
export function matchLegacyEventStringRule(line) {
  const t = String(line || '').trim();
  if (!t) return null;
  for (const spec of LEGACY_EVENT_STRING_RULES) {
    const m = t.match(spec.re);
    if (!m) continue;
    warnLegacyEventDsl(spec.rule);
    return { paletteId: spec.id, props: spec.props(m), rule: spec.rule };
  }
  if (/if\s+.*sticker/i.test(t) || /if\s+.*text\s*===/i.test(t) || /event\.type\s*===/i.test(t)) {
    warnLegacyEventDsl(`unmigrated-condition:${t.slice(0, 80)}`);
  }
  return null;
}

/**
 * @param {object} input — Telegram update | normalized event | string
 * @returns {{
 *   kind: InboundEventKind,
 *   text?: string,
 *   command?: string,
 *   callbackData?: string,
 *   stickerId?: string,
 *   stickerEmoji?: string,
 *   fileId?: string,
 *   raw?: unknown,
 * }}
 */
export function normalizeInboundEvent(input) {
  if (input?.kind) {
    return {
      kind: input.kind,
      text: input.text,
      command: input.command,
      callbackData: input.callbackData,
      stickerId: input.stickerId,
      stickerEmoji: input.stickerEmoji,
      fileId: input.fileId,
      raw: input.raw ?? input,
    };
  }

  if (typeof input === 'string') {
    const text = input.trim();
    if (text.startsWith('/')) {
      return { kind: 'command', command: text.split(/\s/)[0], text, raw: input };
    }
    return { kind: 'text', text, raw: input };
  }

  if (input?.callback_query) {
    const cq = input.callback_query;
    return {
      kind: 'callback',
      callbackData: String(cq.data ?? ''),
      text: String(cq.data ?? ''),
      raw: input,
    };
  }

  const msg = input?.message || input;
  if (!msg || typeof msg !== 'object') {
    return { kind: 'unknown', raw: input };
  }

  if (msg.voice) {
    return {
      kind: 'voice',
      fileId: msg.voice.file_id,
      raw: input,
    };
  }
  if (msg.audio) {
    return { kind: 'voice', fileId: msg.audio.file_id, raw: input };
  }
  if (msg.sticker) {
    return {
      kind: 'sticker',
      stickerId: msg.sticker.file_id,
      stickerEmoji: msg.sticker.emoji || '',
      raw: input,
    };
  }
  if (msg.photo?.length) {
    return { kind: 'photo', fileId: msg.photo[msg.photo.length - 1]?.file_id, raw: input };
  }
  if (msg.document) {
    return { kind: 'document', fileId: msg.document.file_id, raw: input };
  }

  const text = String(msg.text || '');
  if (text === '/start') return { kind: 'start', text, command: '/start', raw: input };
  if (text.startsWith('/')) {
    return { kind: 'command', command: text.split(/\s/)[0], text, raw: input };
  }
  if (text) return { kind: 'text', text, raw: input };

  return { kind: 'unknown', raw: input };
}

/**
 * @param {ReturnType<typeof normalizeInboundEvent>} normalized
 * @returns {string | null}
 */
export function paletteEntryIdForInboundEvent(normalized) {
  const kind = normalized?.kind;
  if (kind === 'command' && normalized.command === '/start') {
    return EVENT_TRIGGER_PALETTE_IDS.start;
  }
  return EVENT_TRIGGER_PALETTE_IDS[kind] || null;
}

/**
 * @param {object} paletteEntry
 * @param {object} [eventProps]
 */
function withEventProps(paletteEntry, eventProps = {}) {
  if (!eventProps || !Object.keys(eventProps).length) return paletteEntry;
  return {
    ...paletteEntry,
    meta: {
      ...(paletteEntry.meta || {}),
      eventProps: { ...eventProps },
    },
  };
}

/**
 * Resolve inbound event → PaletteEntryV2 from palette (or virtual entry).
 * @param {unknown} event
 * @param {ReadonlyArray} palette
 * @param {{ lang?: string, blockTypes?: ReadonlyArray }} [options]
 * @returns {import('./palette_core.js').PaletteEntryV2 | null}
 */
export function resolveEventToPaletteEntry(event, palette, options = {}) {
  const list = palette || [];
  const normalized = normalizeInboundEvent(event);

  if (typeof event === 'string') {
    const legacy = matchLegacyEventStringRule(event);
    if (legacy) {
      return resolvePaletteEntryById(legacy.paletteId, list, options, legacy.props);
    }
  }

  const paletteId = paletteEntryIdForInboundEvent(normalized);
  if (!paletteId) return null;

  let eventProps = {};
  if (normalized.kind === 'command') {
    eventProps = {
      cmd: String(normalized.command || normalized.text || '').replace(/^\//, '').trim() || 'start',
    };
  }
  if (normalized.kind === 'sticker' && normalized.stickerId) {
    eventProps = { file_id: normalized.stickerId, emoji: normalized.stickerEmoji || '' };
  }
  if (normalized.kind === 'callback' && normalized.callbackData) {
    eventProps = { label: normalized.callbackData };
  }

  return resolvePaletteEntryById(paletteId, list, options, eventProps);
}

/**
 * @param {string} paletteId
 * @param {ReadonlyArray} palette
 * @param {object} options
 * @param {object} [eventProps]
 */
export function resolvePaletteEntryById(paletteId, palette, options = {}, eventProps = {}) {
  const id = String(paletteId || '').trim();
  const found = (palette || []).find((e) => e.id === id);
  if (found) {
    return withEventProps(found, eventProps);
  }
  const fromCatalog = getPaletteEntry(id, options);
  if (fromCatalog) {
    return withEventProps(fromCatalog, eventProps);
  }

  if (id.startsWith('node:')) {
    const blockType = id.slice(5);
    warnLegacyEventDsl(`virtual-entry:${id}`);
    return createPaletteEntryV2({
      id,
      type: 'node',
      operationType: 'AddNode',
      defaultNodeType: blockType,
      paletteKind: 'node',
      label: blockType,
      category: 'main',
      interaction: 'drag',
      compileFn: 'compileAddNewStack',
      alternateCompileFn: 'compileAddBlockToStack',
      meta: { eventProps },
    });
  }

  return null;
}

/**
 * Build Telegram update object for preview / engine (from normalized inbound event).
 * @param {unknown} event
 */
export function buildTelegramUpdateFromInboundEvent(event) {
  const n = normalizeInboundEvent(event);
  const base = {
    message_id: 1,
    chat: { id: 990000001, type: 'private' },
    from: { id: 990000001, first_name: 'Preview' },
  };

  if (n.kind === 'callback') {
    return {
      callback_query: {
        id: 'cb_preview',
        from: { id: 990000001 },
        message: { chat: { id: 990000001 }, message_id: 1 },
        data: String(n.callbackData || ''),
      },
    };
  }

  if (n.kind === 'voice') {
    return {
      message: {
        ...base,
        voice: { file_id: n.fileId || 'preview_voice_file_id', duration: 3 },
      },
    };
  }

  if (n.kind === 'sticker') {
    return {
      message: {
        ...base,
        sticker: {
          file_id: n.stickerId || 'preview_sticker_file_id',
          emoji: n.stickerEmoji || '🙂',
        },
      },
    };
  }

  if (n.kind === 'command' || n.kind === 'start') {
    return {
      message: {
        ...base,
        text: n.text || n.command || '/start',
      },
    };
  }

  if (n.kind === 'text') {
    return {
      message: {
        ...base,
        text: n.text || '',
      },
    };
  }

  return {
    message: {
      ...base,
      text: n.text || '/start',
    },
  };
}

/**
 * Apply palette entry via compilePaletteAction → applyComposition.
 * @param {object} params
 * @param {import('./palette_core.js').PaletteEntryV2} params.entry
 * @param {object} params.graph
 * @param {Function} params.applyComposition
 * @param {ReadonlyArray} [params.stacks]
 * @param {object} [params.block] — required for node entries
 * @param {number} [params.x]
 * @param {number} [params.y]
 * @param {string} [params.stackId]
 * @param {string} [params.nodeId] — for RemoveNode / UpdateNodeData
 * @param {object} [params.data]
 * @param {object} [params.meta]
 */
export function applyPaletteEntryViaComposition(params) {
  const {
    entry,
    graph,
    applyComposition,
    stacks,
    block,
    x = 120,
    y = 120,
    stackId,
    nodeId,
    data,
    meta,
  } = params;

  if (!entry?.id) {
    return { ok: false, error: 'Missing palette entry' };
  }

  const compiled = compilePaletteAction(entry, {
    stacks,
    stackId,
    block,
    x,
    y,
    nodeId,
    data,
    meta,
  });

  if (!compiled?.ok) {
    return compiled;
  }

  return applyComposition(graph, compiled);
}

/**
 * Resolve event → entry → compile → apply (full palette-core pipeline).
 * @param {object} params
 */
export function applyInboundEventViaPalette(params) {
  const {
    event,
    palette,
    graph,
    applyComposition,
    options = {},
    block,
    stacks,
    x,
    y,
    stackId,
    makeBlock,
  } = params;

  const entry = resolveEventToPaletteEntry(event, palette, options);
  if (!entry) {
    return { ok: false, error: 'No palette entry for event' };
  }

  let resolvedBlock = block;
  if (entry.type === 'node' && !resolvedBlock && typeof makeBlock === 'function') {
    const eventProps = entry.meta?.eventProps || {};
    resolvedBlock = makeBlock(entry.defaultNodeType, eventProps);
  }

  const applied = applyPaletteEntryViaComposition({
    entry,
    graph,
    applyComposition,
    stacks,
    block: resolvedBlock,
    x,
    y,
    stackId,
  });

  return { ...applied, entry, compiled: applied };
}

/**
 * Sticker-specific virtual action: sticker:<file_id> → send sticker node entry.
 * @param {string} stickerKey — file_id or alias after "sticker:"
 * @param {ReadonlyArray} palette
 * @param {object} [options]
 */
export function resolveStickerActionEntry(stickerKey, palette, options = {}) {
  const id = String(stickerKey || '').trim();
  warnLegacyEventDsl(`sticker-action:sticker:${id}`);
  return resolvePaletteEntryById('node:sticker', palette, options, { file_id: id });
}
