/** Key prefixes for subscriber persistence on ExecutionDbAccess / SubscriberStore. */

export const SUBSCRIBER_DB_PREFIX = "subscriber:v1:";

export function subscriberKey(id: string): string {
  return `${SUBSCRIBER_DB_PREFIX}sub:${id}`;
}

export function subscriberIndexKey(botId: string, channel: string, externalUserId: string): string {
  return `${SUBSCRIBER_DB_PREFIX}idx:${botId}:${channel}:${externalUserId}`;
}

export function conversationKey(id: string): string {
  return `${SUBSCRIBER_DB_PREFIX}conv:${id}`;
}

export function conversationBySubscriberKey(subscriberId: string): string {
  return `${SUBSCRIBER_DB_PREFIX}conv_by_sub:${subscriberId}`;
}

export function sessionKey(id: string): string {
  return `${SUBSCRIBER_DB_PREFIX}sess:${id}`;
}

export function activeSessionKey(subscriberId: string): string {
  return `${SUBSCRIBER_DB_PREFIX}sess_active:${subscriberId}`;
}

export function tagDefKey(id: string): string {
  return `${SUBSCRIBER_DB_PREFIX}tagdef:${id}`;
}

export function tagIndexKey(botId: string, name: string): string {
  return `${SUBSCRIBER_DB_PREFIX}tagidx:${botId}:${name}`;
}

export function customFieldDefKey(id: string): string {
  return `${SUBSCRIBER_DB_PREFIX}cfdef:${id}`;
}

export function customFieldIndexKey(botId: string, key: string): string {
  return `${SUBSCRIBER_DB_PREFIX}cfidx:${botId}:${key}`;
}

export function eventKey(id: string): string {
  return `${SUBSCRIBER_DB_PREFIX}evt:${id}`;
}

export function eventsBySubscriberKey(subscriberId: string): string {
  return `${SUBSCRIBER_DB_PREFIX}evts:${subscriberId}`;
}

export function segmentKey(id: string): string {
  return `${SUBSCRIBER_DB_PREFIX}seg:${id}`;
}

export function segmentsByBotKey(botId: string): string {
  return `${SUBSCRIBER_DB_PREFIX}segs:${botId}`;
}

export function subscribersByBotKey(botId: string): string {
  return `${SUBSCRIBER_DB_PREFIX}subs_by_bot:${botId}`;
}

export function tagDefsByBotKey(botId: string): string {
  return `${SUBSCRIBER_DB_PREFIX}tagdefs:${botId}`;
}

export function customFieldDefsByBotKey(botId: string): string {
  return `${SUBSCRIBER_DB_PREFIX}cfdefs:${botId}`;
}
