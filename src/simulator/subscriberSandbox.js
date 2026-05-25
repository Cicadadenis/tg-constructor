/**
 * Isolated in-browser mock subscriber state (no core/subscriber bundle — Vite-safe).
 */

import { variablesSnapshotFromSubscriber } from './variableInterpolation.js';

const PREVIEW_BOT_ID = 'simulator-preview';

/** @type {readonly { id: string, label: { ru: string, en: string, uk: string }, subscriber: object }[]} */
export const SUBSCRIBER_PRESETS = Object.freeze([
  {
    id: 'new_user',
    label: { ru: 'Новый', en: 'New user', uk: 'Новий' },
    subscriber: {
      externalUserId: 'tg_100001',
      displayName: 'Анна',
      firstName: 'Анна',
      locale: 'ru',
      tags: [],
      customFields: { source: 'organic' },
    },
  },
  {
    id: 'returning',
    label: { ru: 'Вернувшийся', en: 'Returning', uk: 'Повернувся' },
    subscriber: {
      externalUserId: 'tg_204812',
      displayName: 'Максим',
      firstName: 'Максим',
      locale: 'ru',
      tags: ['returning'],
      customFields: { visits: '3', last_order: '2025-12-01' },
    },
  },
  {
    id: 'vip',
    label: { ru: 'VIP', en: 'VIP', uk: 'VIP' },
    subscriber: {
      externalUserId: 'tg_900042',
      displayName: 'Elena VIP',
      firstName: 'Elena',
      locale: 'en',
      tags: ['vip', 'paid'],
      customFields: { plan: 'pro', credits: '120' },
    },
  },
]);

/** @type {object|null} */
let mockContext = null;

function buildMockContext(partial = {}) {
  const subscriber = {
    id: 'sub_sim_preview',
    botId: PREVIEW_BOT_ID,
    channel: 'telegram',
    externalUserId: 'sandbox-user',
    displayName: 'Preview User',
    locale: 'ru',
    status: 'active',
    tags: [],
    customFields: {},
    attributes: {},
    ...partial.subscriber,
  };
  const session = {
    id: `sess_${subscriber.externalUserId}`,
    subscriberId: subscriber.id,
    botId: PREVIEW_BOT_ID,
    status: 'active',
    flowId: null,
    executionId: null,
    variables: { ...(partial.sessionVariables || {}) },
  };
  return { subscriber, session, conversation: null };
}

function createDefaultMockContext() {
  const preset = SUBSCRIBER_PRESETS[0];
  return buildMockContext({ subscriber: preset.subscriber });
}

/**
 * @param {string} presetId
 */
export function switchMockSubscriber(presetId) {
  const preset = SUBSCRIBER_PRESETS.find((p) => p.id === presetId) || SUBSCRIBER_PRESETS[0];
  mockContext = buildMockContext({ subscriber: preset.subscriber });
  return mockContext;
}

export function presetLabel(preset, lang = 'ru') {
  if (!preset?.label) return preset?.id || '';
  if (lang === 'en') return preset.label.en;
  if (lang === 'uk') return preset.label.uk;
  return preset.label.ru;
}

/**
 * @returns {Promise<{ context: object, variables: Record<string, string> }>}
 */
export async function ensureMockSubscriber() {
  if (!mockContext) {
    mockContext = createDefaultMockContext();
  }
  return {
    context: mockContext,
    variables: variablesSnapshotFromSubscriber(mockContext),
  };
}

export function resetMockSubscriber(presetId) {
  mockContext = presetId
    ? switchMockSubscriber(presetId)
    : createDefaultMockContext();
  return mockContext;
}

export async function applySubscriberEffectsFromOutbound(subCtx, outbound) {
  if (!subCtx || !Array.isArray(outbound)) return subCtx;
  const subscriber = { ...subCtx.subscriber, tags: [...(subCtx.subscriber.tags || [])] };
  const session = { ...subCtx.session, variables: { ...(subCtx.session?.variables || {}) } };
  const customFields = { ...(subscriber.customFields || {}) };

  for (const o of outbound) {
    const t = o?.type;
    if (t === 'tag' || t === 'add_tag') {
      const tag = String(o.tag ?? o.name ?? '').trim();
      if (tag && !subscriber.tags.includes(tag)) subscriber.tags.push(tag);
    }
    if (t === 'untag' || t === 'remove_tag') {
      const tag = String(o.tag ?? o.name ?? '').trim();
      subscriber.tags = subscriber.tags.filter((x) => x !== tag);
    }
    if (t === 'set_field' || t === 'custom_field') {
      const key = o.key ?? o.field;
      if (key) customFields[String(key)] = o.value;
    }
    if (t === 'set_variable' || t === 'variable') {
      const key = o.key ?? o.name;
      if (key) session.variables[String(key)] = o.value;
    }
  }

  subscriber.customFields = customFields;
  const next = { ...subCtx, subscriber, session };
  mockContext = next;
  return next;
}

export async function refreshSubscriberVariables(subCtx) {
  return variablesSnapshotFromSubscriber(subCtx ?? mockContext);
}

export function getSimulatorSubscriberManager() {
  return null;
}

export function getSimulatorEventBus() {
  return null;
}

export function addMockTag(subCtx, tagName) {
  if (!subCtx?.subscriber) return subCtx;
  const name = String(tagName || '').trim();
  if (!name) return subCtx;
  const tags = [...(subCtx.subscriber.tags || [])];
  if (!tags.includes(name)) tags.push(name);
  const next = {
    ...subCtx,
    subscriber: { ...subCtx.subscriber, tags },
  };
  mockContext = next;
  return next;
}

export function removeMockTag(subCtx, tagName) {
  if (!subCtx?.subscriber) return subCtx;
  const name = String(tagName || '').trim();
  const next = {
    ...subCtx,
    subscriber: {
      ...subCtx.subscriber,
      tags: (subCtx.subscriber.tags || []).filter((t) => t !== name),
    },
  };
  mockContext = next;
  return next;
}
