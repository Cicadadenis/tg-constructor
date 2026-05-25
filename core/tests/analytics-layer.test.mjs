import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetDefaultAnalyticsStore,
  trackAnalyticsEvent,
  registerFlowForAnalytics,
  getAnalyticsSnapshot,
  AnalyticsEventTypes,
} from '../analytics/index.js';
import {
  bootstrapAnalyticsLayer,
  resetAnalyticsBootstrapForTests,
} from '../analytics/server.js';

test('analytics pipeline aggregates funnel and heatmap', () => {
  const store = resetDefaultAnalyticsStore();
  registerFlowForAnalytics('flow-1', ['n1', 'n2', 'n3'], store);

  trackAnalyticsEvent({
    type: AnalyticsEventTypes.SESSION_START,
    flowId: 'flow-1',
    sessionId: 's1',
    subscriberId: 'u1',
  }, store);

  trackAnalyticsEvent({
    type: AnalyticsEventTypes.NODE_ENTER,
    flowId: 'flow-1',
    sessionId: 's1',
    subscriberId: 'u1',
    nodeId: 'n1',
    properties: { fromNodeId: null },
  }, store);

  trackAnalyticsEvent({
    type: AnalyticsEventTypes.NODE_ENTER,
    flowId: 'flow-1',
    sessionId: 's1',
    subscriberId: 'u1',
    nodeId: 'n2',
    properties: { fromNodeId: 'n1' },
  }, store);

  trackAnalyticsEvent({
    type: AnalyticsEventTypes.MESSAGE_SENT,
    flowId: 'flow-1',
    nodeId: 'n2',
  }, store);

  trackAnalyticsEvent({
    type: AnalyticsEventTypes.MESSAGE_OPENED,
    flowId: 'flow-1',
    sessionId: 's1',
    subscriberId: 'u1',
  }, store);

  trackAnalyticsEvent({
    type: AnalyticsEventTypes.BUTTON_CLICK,
    flowId: 'flow-1',
    properties: { callbackData: 'buy' },
  }, store);

  trackAnalyticsEvent({
    type: AnalyticsEventTypes.CONVERSION_GOAL,
    flowId: 'flow-1',
    properties: { goal: 'purchase' },
  }, store);

  const snap = getAnalyticsSnapshot('flow-1', {}, store);
  assert.equal(snap.activeUsers, 1);
  assert.equal(snap.liveSessions, 1);
  assert.ok(snap.funnel.length >= 2);
  assert.ok(snap.heatmap.some((h) => h.nodeId === 'n1'));
  assert.equal(snap.openRate.sent, 1);
  assert.equal(snap.openRate.opened, 1);
  assert.equal(snap.conversionGoals.purchase.count, 1);
  assert.equal(snap.clickStats.buy, 1);
});

test('node error appears in failed nodes', () => {
  const store = resetDefaultAnalyticsStore();
  trackAnalyticsEvent({
    type: AnalyticsEventTypes.NODE_ERROR,
    nodeId: 'bad-node',
    properties: { error: 'timeout' },
  }, store);
  const snap = getAnalyticsSnapshot(null, {}, store);
  assert.equal(snap.failedNodes[0].nodeId, 'bad-node');
});

test('subscriber goal_reached maps to conversion', async () => {
  const store = resetDefaultAnalyticsStore();
  trackAnalyticsEvent({
    type: AnalyticsEventTypes.CONVERSION_GOAL,
    botId: 'bot_1',
    subscriberId: 'sub_1',
    properties: { goal: 'signup', subscriberEvent: 'subscriber.goal_reached' },
  }, store);
  const snap = getAnalyticsSnapshot(null, {}, store);
  assert.equal(snap.conversionGoals.signup?.count, 1);
});

test('bootstrap sets persistence hook', async () => {
  resetAnalyticsBootstrapForTests();
  const store = resetDefaultAnalyticsStore();
  await bootstrapAnalyticsLayer(store);
  assert.equal(typeof store.setPersistHook, 'function');
});
