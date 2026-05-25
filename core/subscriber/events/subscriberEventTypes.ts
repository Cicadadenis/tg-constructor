/** Subscriber-domain event types (distinct from execution event sourcing). */

export const SUBSCRIBER_EVENT_PREFIX = "subscriber.";

export const SubscriberEventTypes = Object.freeze({
  CREATED: `${SUBSCRIBER_EVENT_PREFIX}created`,
  TAG_ADDED: `${SUBSCRIBER_EVENT_PREFIX}tag_added`,
  TAG_REMOVED: `${SUBSCRIBER_EVENT_PREFIX}tag_removed`,
  FIELD_UPDATED: `${SUBSCRIBER_EVENT_PREFIX}field_updated`,
  ATTRIBUTE_UPDATED: `${SUBSCRIBER_EVENT_PREFIX}attribute_updated`,
  VARIABLE_UPDATED: `${SUBSCRIBER_EVENT_PREFIX}variable_updated`,
  SESSION_STARTED: `${SUBSCRIBER_EVENT_PREFIX}session_started`,
  SESSION_ENDED: `${SUBSCRIBER_EVENT_PREFIX}session_ended`,
  CONVERSATION_OPENED: `${SUBSCRIBER_EVENT_PREFIX}conversation_opened`,
  MESSAGE_RECEIVED: `${SUBSCRIBER_EVENT_PREFIX}message_received`,
  GOAL_REACHED: `${SUBSCRIBER_EVENT_PREFIX}goal_reached`,
  CUSTOM: `${SUBSCRIBER_EVENT_PREFIX}custom`,
});

export function isSubscriberDomainEvent(eventType: string): boolean {
  return String(eventType || "").startsWith(SUBSCRIBER_EVENT_PREFIX);
}
