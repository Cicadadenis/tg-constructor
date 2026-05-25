/**
 * Debug-mode preview bridge — Graph → Python codegen → /api/bot/preview (mock Telegram).
 * Uses the same authenticated preview worker as the server chat panel.
 */

import { apiFetch } from '../apiClient.js';
import { parseLevel0Trace } from './traceViewer.js';
import { ConstructorMode } from './modes.js';
import { normalizeCallbackData } from '../../core/codegen/callbackDataNormalize.js';
import {
  buildTelegramUpdateFromInboundEvent,
  normalizeInboundEvent,
  resolveEventToPaletteEntry,
} from './graph_document/palette_event_resolver.js';

const PREVIEW_SESSION_STORAGE_KEY = 'cicada_preview_session_id';

function getOrCreatePreviewSessionId() {
  try {
    let s = sessionStorage.getItem(PREVIEW_SESSION_STORAGE_KEY);
    if (!s || s.length < 8) {
      s =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `pv_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      sessionStorage.setItem(PREVIEW_SESSION_STORAGE_KEY, s);
    }
    return s;
  } catch {
    return `pv_${Date.now()}`;
  }
}

/**
 * @param {object} params
 * @param {string} params.generatedPython — aiogram bot.py source (required)
 * @param {string} [params.text]
 * @param {string} [params.callbackData]
 * @param {unknown} [params.event]
 * @param {ReadonlyArray} [params.palette]
 * @param {{ lang?: string, blockTypes?: ReadonlyArray }} [params.paletteOptions]
 * @param {string} [params.flowId]
 * @param {string} [params.botId]
 */
export async function runDebugExecution({
  graphIR: _graphIR,
  generatedPython,
  compileWarnings = [],
  transpileTrace = [],
  text = '',
  callbackData = null,
  event = null,
  palette = null,
  paletteOptions = {},
  flowId = null,
  botId = null,
}) {
  if (!generatedPython || !String(generatedPython).trim()) {
    throw new Error('runDebugExecution: generatedPython is required (compile the graph first)');
  }

  let inbound = event;
  if (!inbound) {
    inbound = callbackData != null
      ? { kind: 'callback', callbackData: String(callbackData) }
      : { kind: 'text', text: text != null ? String(text) : '' };
  }

  const normalized = normalizeInboundEvent(inbound);
  if (palette?.length) {
    resolveEventToPaletteEntry(inbound, palette, paletteOptions);
  }

  let previewText = text != null ? String(text) : '';
  let previewCallback = callbackData != null ? String(callbackData) : null;

  if (normalized.kind === 'callback' && normalized.callbackData) {
    previewCallback = normalizeCallbackData(normalized.callbackData);
    previewText = '';
  } else if (normalized.kind === 'command' && (normalized.command || normalized.text)) {
    previewText = normalized.command || normalized.text || '';
  } else if (normalized.text) {
    previewText = normalized.text;
  }

  buildTelegramUpdateFromInboundEvent(inbound);

  const data = await apiFetch('/api/bot/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: getOrCreatePreviewSessionId(),
      code: generatedPython,
      text: previewText,
      callbackData: previewCallback && previewCallback.length ? previewCallback : null,
      flowId: flowId || undefined,
      botId: botId || undefined,
    }),
  });

  if (data?.ok === false) {
    throw new Error(data.error || 'Не удалось выполнить превью');
  }

  const outbound = data.outbound ?? data.effects ?? [];
  const traceView = parseLevel0Trace({ effects: outbound, trace_id: data.trace_id });
  return {
    mode: ConstructorMode.DEBUG,
    effects: outbound,
    traceView,
    traceId: data.trace_id ?? null,
    raw: data,
    inbound: normalized,
    paletteEntry: palette?.length
      ? resolveEventToPaletteEntry(inbound, palette, paletteOptions)
      : null,
    debugSnapshot: {
      generatedPython: generatedPython ?? '',
      compileWarnings: compileWarnings ?? [],
      transpileTrace: transpileTrace ?? [],
    },
  };
}
