/**
 * Bridge SubscriberEventBus → analytics pipeline (server-side; optional).
 */

import { trackAnalyticsEvent } from './analyticsPipeline.js';
import { AnalyticsEventTypes } from './analyticsEventTypes.js';

const SUBSCRIBER_GOAL_REACHED = 'subscriber.goal_reached';

const SUBSCRIBER_TO_ANALYTICS = Object.freeze({
  'subscriber.created': AnalyticsEventTypes.SESSION_START,
  'subscriber.session_started': AnalyticsEventTypes.SESSION_START,
  'subscriber.session_ended': AnalyticsEventTypes.SESSION_END,
  'subscriber.tag_added': AnalyticsEventTypes.ANALYTICS_EVENT,
  'subscriber.tag_removed': AnalyticsEventTypes.ANALYTICS_EVENT,
  'subscriber.field_updated': AnalyticsEventTypes.ANALYTICS_EVENT,
  [SUBSCRIBER_GOAL_REACHED]: AnalyticsEventTypes.CONVERSION_GOAL,
  'subscriber.message_received': AnalyticsEventTypes.MESSAGE_OPENED,
  'subscriber.custom': AnalyticsEventTypes.ANALYTICS_EVENT,
});

let wired = false;

/**
 * @param {import('./inMemoryAnalyticsStore.js').InMemoryAnalyticsStore} [store]
 * @param {object} [bus] — SubscriberEventBus instance (injected from server)
 */
export function wireSubscriberAnalyticsBridgeSync(store, bus) {
  if (wired || !bus?.onAny) return;
  wired = true;

  bus.onAny((event) => {
    const type = SUBSCRIBER_TO_ANALYTICS[event.type] || AnalyticsEventTypes.ANALYTICS_EVENT;
    trackAnalyticsEvent({
      type,
      botId: event.botId,
      subscriberId: event.subscriberId,
      sessionId: event.payload?.sessionId,
      properties: {
        subscriberEvent: event.type,
        ...event.payload,
      },
    }, store);

    if (event.type === SUBSCRIBER_GOAL_REACHED) {
      trackAnalyticsEvent({
        type: AnalyticsEventTypes.CONVERSION_GOAL,
        botId: event.botId,
        subscriberId: event.subscriberId,
        properties: {
          goal: event.payload?.goal || event.payload?.name || 'goal',
          ...event.payload,
        },
      }, store);
    }
  });
}

export function resetSubscriberAnalyticsBridgeForTests() {
  wired = false;
}
