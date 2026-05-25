/**
 * Isolated in-browser mock subscriber state (no core/subscriber bundle — Vite-safe).
 */

import { variablesSnapshotFromSubscriber } from './variableInterpolation.js';

const PREVIEW_BOT_ID = 'simulator-preview';

/** @type {object|null} */
let mockContext = null;

function createDefaultMockContext() {
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
  };
  const session = {
    id: 'sess_sim_preview',
    subscriberId: subscriber.id,
    botId: PREVIEW_BOT_ID,
    status: 'active',
    flowId: null,
    executionId: null,
    variables: {},
  };
  return { subscriber, session, conversation: null };
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

export function resetMockSubscriber() {
  mockContext = createDefaultMockContext();
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
