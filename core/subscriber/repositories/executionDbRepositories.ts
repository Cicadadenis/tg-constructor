import type { ExecutionDbAccess } from "../../runtime/executionDb.js";
import type {
  AudienceSegment,
  Conversation,
  CustomFieldDefinition,
  Subscriber,
  SubscriberEventRecord,
  SubscriberSession,
  TagDefinition,
} from "../entities/types.js";
import {
  activeSessionKey,
  conversationBySubscriberKey,
  conversationKey,
  customFieldDefKey,
  customFieldDefsByBotKey,
  customFieldIndexKey,
  eventsBySubscriberKey,
  segmentKey,
  segmentsByBotKey,
  sessionKey,
  subscriberIndexKey,
  subscriberKey,
  subscribersByBotKey,
  tagDefKey,
  tagDefsByBotKey,
  tagIndexKey,
} from "../persistence/subscriberDbKeys.js";
import {
  dbAppendId,
  dbGetIdList,
  dbGetJson,
  dbSetJson,
} from "../persistence/executionDbStore.js";
import type { SubscriberRepositories } from "./interfaces.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Subscriber repositories backed by ExecutionDbAccess (persistent across runs when db is shared).
 */
export function createExecutionDbSubscriberRepositories(
  db: ExecutionDbAccess,
): SubscriberRepositories {
  return {
    subscribers: {
      async getById(id) {
        return dbGetJson<Subscriber>(db, subscriberKey(id));
      },
      async findByExternal(botId, channel, externalUserId) {
        const id = await dbGetJson<string>(
          db,
          subscriberIndexKey(botId, channel, externalUserId),
        );
        return id ? this.getById(id) : null;
      },
      async save(subscriber) {
        const copy = clone(subscriber);
        await dbSetJson(db, subscriberKey(copy.id), copy);
        await dbSetJson(
          db,
          subscriberIndexKey(copy.botId, copy.channel, copy.externalUserId),
          copy.id,
        );
        await dbAppendId(db, subscribersByBotKey(copy.botId), copy.id);
      },
      async listByBot(botId) {
        const ids = await dbGetIdList(db, subscribersByBotKey(botId));
        const out: Subscriber[] = [];
        for (const id of ids) {
          const s = await this.getById(id);
          if (s) out.push(s);
        }
        return out;
      },
    },
    conversations: {
      async getById(id) {
        return dbGetJson<Conversation>(db, conversationKey(id));
      },
      async getOpenForSubscriber(subscriberId) {
        const id = await dbGetJson<string>(db, conversationBySubscriberKey(subscriberId));
        if (!id) return null;
        const c = await this.getById(id);
        return c && c.status === "open" ? c : null;
      },
      async save(conversation) {
        const copy = clone(conversation);
        await dbSetJson(db, conversationKey(copy.id), copy);
        if (copy.status === "open") {
          await dbSetJson(db, conversationBySubscriberKey(copy.subscriberId), copy.id);
        }
      },
    },
    sessions: {
      async getById(id) {
        return dbGetJson<SubscriberSession>(db, sessionKey(id));
      },
      async getActiveForSubscriber(subscriberId) {
        const id = await dbGetJson<string>(db, activeSessionKey(subscriberId));
        return id ? this.getById(id) : null;
      },
      async save(session) {
        const copy = clone(session);
        await dbSetJson(db, sessionKey(copy.id), copy);
        if (copy.status === "active" || copy.status === "idle") {
          await dbSetJson(db, activeSessionKey(copy.subscriberId), copy.id);
        } else {
          const active = await dbGetJson<string>(db, activeSessionKey(copy.subscriberId));
          if (active === copy.id) {
            await db.delete(activeSessionKey(copy.subscriberId));
          }
        }
      },
    },
    tags: {
      async getDefinition(botId, name) {
        const id = await dbGetJson<string>(db, tagIndexKey(botId, name));
        return id ? dbGetJson<TagDefinition>(db, tagDefKey(id)) : null;
      },
      async saveDefinition(tag) {
        const copy = clone(tag);
        await dbSetJson(db, tagDefKey(copy.id), copy);
        await dbSetJson(db, tagIndexKey(copy.botId, copy.name), copy.id);
        await dbAppendId(db, tagDefsByBotKey(copy.botId), copy.id);
      },
      async listDefinitions(botId) {
        const ids = await dbGetIdList(db, tagDefsByBotKey(botId));
        const out: TagDefinition[] = [];
        for (const id of ids) {
          const t = await dbGetJson<TagDefinition>(db, tagDefKey(id));
          if (t) out.push(t);
        }
        return out;
      },
    },
    customFields: {
      async getDefinition(botId, key) {
        const id = await dbGetJson<string>(db, customFieldIndexKey(botId, key));
        return id ? dbGetJson<CustomFieldDefinition>(db, customFieldDefKey(id)) : null;
      },
      async saveDefinition(field) {
        const copy = clone(field);
        await dbSetJson(db, customFieldDefKey(copy.id), copy);
        await dbSetJson(db, customFieldIndexKey(copy.botId, copy.key), copy.id);
        await dbAppendId(db, customFieldDefsByBotKey(copy.botId), copy.id);
      },
      async listDefinitions(botId) {
        const ids = await dbGetIdList(db, customFieldDefsByBotKey(botId));
        const out: CustomFieldDefinition[] = [];
        for (const id of ids) {
          const f = await dbGetJson<CustomFieldDefinition>(db, customFieldDefKey(id));
          if (f) out.push(f);
        }
        return out;
      },
    },
    events: {
      async append(event) {
        const copy = clone(event);
        const listKey = eventsBySubscriberKey(copy.subscriberId);
        const ids = await dbGetIdList(db, listKey);
        await dbSetJson(db, `subscriber:v1:evt:${copy.id}`, copy);
        await dbSetJson(db, listKey, [...ids, copy.id].slice(-500));
      },
      async listForSubscriber(subscriberId, limit = 100) {
        const ids = await dbGetIdList(db, eventsBySubscriberKey(subscriberId));
        const slice = ids.slice(-limit);
        const out: SubscriberEventRecord[] = [];
        for (const id of slice) {
          const e = await dbGetJson<SubscriberEventRecord>(db, `subscriber:v1:evt:${id}`);
          if (e) out.push(e);
        }
        return out;
      },
    },
    segments: {
      async getById(id) {
        return dbGetJson<AudienceSegment>(db, segmentKey(id));
      },
      async save(segment) {
        const copy = clone(segment);
        await dbSetJson(db, segmentKey(copy.id), copy);
        await dbAppendId(db, segmentsByBotKey(copy.botId), copy.id);
      },
      async listByBot(botId) {
        const ids = await dbGetIdList(db, segmentsByBotKey(botId));
        const out: AudienceSegment[] = [];
        for (const id of ids) {
          const s = await this.getById(id);
          if (s) out.push(s);
        }
        return out;
      },
    },
  };
}
