/**
 * Analytics event pipeline — validate, enrich, ingest, fan-out.
 */

import { AnalyticsEventTypes } from './analyticsEventTypes.js';
import { getDefaultAnalyticsStore } from './inMemoryAnalyticsStore.js';

/**
 * @param {object} input
 * @param {string} input.type
 * @param {string} [input.flowId]
 * @param {string} [input.botId]
 * @param {string} [input.sessionId]
 * @param {string} [input.subscriberId]
 * @param {string} [input.nodeId]
 * @param {string} [input.executionId]
 * @param {string} [input.traceId]
 * @param {Record<string, unknown>} [input.properties]
 * @param {import('./inMemoryAnalyticsStore.js').InMemoryAnalyticsStore} [store]
 */
export function trackAnalyticsEvent(input, store = getDefaultAnalyticsStore()) {
  if (!input?.type) return null;
  const event = store.ingest({
    id: input.id,
    type: input.type,
    ts: input.ts ?? Date.now(),
    flowId: input.flowId,
    botId: input.botId,
    sessionId: input.sessionId,
    subscriberId: input.subscriberId,
    nodeId: input.nodeId,
    edgeId: input.edgeId,
    executionId: input.executionId,
    traceId: input.traceId,
    properties: input.properties,
  });
  return event;
}

/**
 * Register graph nodes for funnel/heatmap ordering.
 * @param {string} flowId
 * @param {string[]} nodeIds
 * @param {import('./inMemoryAnalyticsStore.js').InMemoryAnalyticsStore} [store]
 */
export function registerFlowForAnalytics(flowId, nodeIds, store = getDefaultAnalyticsStore()) {
  if (!flowId) return;
  store.registerFlowGraph(flowId, nodeIds);
}

/**
 * @param {object} opts
 * @param {string} opts.flowId
 * @param {string} opts.sessionId
 * @param {string} [opts.subscriberId]
 * @param {import('./inMemoryAnalyticsStore.js').InMemoryAnalyticsStore} [store]
 */
export function trackSessionStart(opts, store = getDefaultAnalyticsStore()) {
  return trackAnalyticsEvent({
    type: AnalyticsEventTypes.SESSION_START,
    flowId: opts.flowId,
    sessionId: opts.sessionId,
    subscriberId: opts.subscriberId,
    ts: Date.now(),
  }, store);
}

/**
 * @param {string | null} [flowId]
 * @param {{ botId?: string, since?: number, until?: number } | import('./inMemoryAnalyticsStore.js').InMemoryAnalyticsStore} [optsOrStore]
 * @param {import('./inMemoryAnalyticsStore.js').InMemoryAnalyticsStore} [store]
 */
export function getAnalyticsSnapshot(flowId = null, optsOrStore = {}, store) {
  if (optsOrStore && typeof optsOrStore.ingest === 'function') {
    return optsOrStore.getSnapshot(flowId);
  }
  const s = store || getDefaultAnalyticsStore();
  const opts = optsOrStore && typeof optsOrStore === 'object' ? optsOrStore : {};
  return s.getSnapshot(flowId, opts);
}

export function subscribeAnalytics(fn, store = getDefaultAnalyticsStore()) {
  return store.subscribe(fn);
}
