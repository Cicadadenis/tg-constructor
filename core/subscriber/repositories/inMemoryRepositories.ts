import type {
  AudienceSegment,
  Conversation,
  CustomFieldDefinition,
  Subscriber,
  SubscriberEventRecord,
  SubscriberSession,
  TagDefinition,
} from "../entities/types.js";
import type { SubscriberRepositories } from "./interfaces.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * In-memory subscriber persistence (dev, tests, sandbox).
 * Production can swap with PostgresSubscriberRepositories implementing same interfaces.
 */
export function createInMemorySubscriberRepositories(): SubscriberRepositories {
  const subscribers = new Map<string, Subscriber>();
  const subscriberIndex = new Map<string, string>();
  const conversations = new Map<string, Conversation>();
  const convBySub = new Map<string, string>();
  const sessions = new Map<string, SubscriberSession>();
  const activeSession = new Map<string, string>();
  const tagDefs = new Map<string, TagDefinition>();
  const tagIndex = new Map<string, string>();
  const cfDefs = new Map<string, CustomFieldDefinition>();
  const cfIndex = new Map<string, string>();
  const events = new Map<string, SubscriberEventRecord[]>();
  const segments = new Map<string, AudienceSegment>();
  const segmentsByBot = new Map<string, string[]>();

  const indexKey = (botId: string, channel: string, externalUserId: string) =>
    `${botId}|${channel}|${externalUserId}`;

  return {
    subscribers: {
      async getById(id) {
        const s = subscribers.get(id);
        return s ? clone(s) : null;
      },
      async findByExternal(botId, channel, externalUserId) {
        const id = subscriberIndex.get(indexKey(botId, channel, externalUserId));
        return id ? this.getById(id) : null;
      },
      async save(subscriber) {
        const copy = clone(subscriber);
        subscribers.set(copy.id, copy);
        subscriberIndex.set(
          indexKey(copy.botId, copy.channel, copy.externalUserId),
          copy.id,
        );
      },
      async listByBot(botId) {
        return [...subscribers.values()].filter((s) => s.botId === botId).map(clone);
      },
    },
    conversations: {
      async getById(id) {
        const c = conversations.get(id);
        return c ? clone(c) : null;
      },
      async getOpenForSubscriber(subscriberId) {
        const id = convBySub.get(subscriberId);
        if (!id) return null;
        const c = await this.getById(id);
        return c && c.status === "open" ? c : null;
      },
      async save(conversation) {
        const copy = clone(conversation);
        conversations.set(copy.id, copy);
        if (copy.status === "open") {
          convBySub.set(copy.subscriberId, copy.id);
        }
      },
    },
    sessions: {
      async getById(id) {
        const s = sessions.get(id);
        return s ? clone(s) : null;
      },
      async getActiveForSubscriber(subscriberId) {
        const id = activeSession.get(subscriberId);
        return id ? this.getById(id) : null;
      },
      async save(session) {
        const copy = clone(session);
        sessions.set(copy.id, copy);
        if (copy.status === "active" || copy.status === "idle") {
          activeSession.set(copy.subscriberId, copy.id);
        } else if (activeSession.get(copy.subscriberId) === copy.id) {
          activeSession.delete(copy.subscriberId);
        }
      },
    },
    tags: {
      async getDefinition(botId, name) {
        const id = tagIndex.get(`${botId}|${name}`);
        return id ? clone(tagDefs.get(id)!) : null;
      },
      async saveDefinition(tag) {
        const copy = clone(tag);
        tagDefs.set(copy.id, copy);
        tagIndex.set(`${copy.botId}|${copy.name}`, copy.id);
      },
      async listDefinitions(botId) {
        return [...tagDefs.values()].filter((t) => t.botId === botId).map(clone);
      },
    },
    customFields: {
      async getDefinition(botId, key) {
        const id = cfIndex.get(`${botId}|${key}`);
        return id ? clone(cfDefs.get(id)!) : null;
      },
      async saveDefinition(field) {
        const copy = clone(field);
        cfDefs.set(copy.id, copy);
        cfIndex.set(`${copy.botId}|${copy.key}`, copy.id);
      },
      async listDefinitions(botId) {
        return [...cfDefs.values()].filter((f) => f.botId === botId).map(clone);
      },
    },
    events: {
      async append(event) {
        const copy = clone(event);
        const list = events.get(copy.subscriberId) ?? [];
        list.push(copy);
        events.set(copy.subscriberId, list);
      },
      async listForSubscriber(subscriberId, limit = 100) {
        const list = events.get(subscriberId) ?? [];
        return list.slice(-limit).map(clone);
      },
    },
    segments: {
      async getById(id) {
        const s = segments.get(id);
        return s ? clone(s) : null;
      },
      async save(segment) {
        const copy = clone(segment);
        segments.set(copy.id, copy);
        const ids = segmentsByBot.get(copy.botId) ?? [];
        if (!ids.includes(copy.id)) {
          segmentsByBot.set(copy.botId, [...ids, copy.id]);
        }
      },
      async listByBot(botId) {
        const ids = segmentsByBot.get(botId) ?? [];
        return ids.map((id) => clone(segments.get(id)!)).filter(Boolean);
      },
    },
  };
}

let defaultRepos: SubscriberRepositories | null = null;

export function getDefaultSubscriberRepositories(): SubscriberRepositories {
  if (!defaultRepos) {
    defaultRepos = createInMemorySubscriberRepositories();
  }
  return defaultRepos;
}

export function setDefaultSubscriberRepositories(repos: SubscriberRepositories): void {
  defaultRepos = repos;
}
