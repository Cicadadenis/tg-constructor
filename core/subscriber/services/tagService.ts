import { newTagId, newEventId } from "../entities/ids.js";
import type { Subscriber, TagDefinition } from "../entities/types.js";
import { SubscriberEventTypes } from "../events/subscriberEventTypes.js";
import { getDefaultSubscriberEventBus } from "../events/subscriberEventBus.js";
import type { SubscriberEventBus } from "../events/subscriberEventBus.js";
import type { SubscriberRepositories } from "../repositories/interfaces.js";
import { getDefaultSubscriberRepositories } from "../repositories/inMemoryRepositories.js";

export class TagService {
  constructor(
    private readonly repos: SubscriberRepositories = getDefaultSubscriberRepositories(),
    private readonly bus: SubscriberEventBus = getDefaultSubscriberEventBus(),
  ) {}

  async ensureTagDefinition(botId: string, name: string, color = "#2563eb"): Promise<TagDefinition> {
    const existing = await this.repos.tags.getDefinition(botId, name);
    if (existing) return existing;
    const tag: TagDefinition = {
      id: newTagId(),
      botId,
      name,
      color,
      createdAt: new Date().toISOString(),
    };
    await this.repos.tags.saveDefinition(tag);
    return tag;
  }

  async addTag(subscriber: Subscriber, tagName: string): Promise<Subscriber> {
    const name = String(tagName || "").trim();
    if (!name || subscriber.tags.includes(name)) return subscriber;
    await this.ensureTagDefinition(subscriber.botId, name);
    const next: Subscriber = {
      ...subscriber,
      tags: Object.freeze([...subscriber.tags, name]),
      updatedAt: new Date().toISOString(),
    };
    await this.repos.subscribers.save(next);
    const event = Object.freeze({
      id: newEventId(),
      subscriberId: next.id,
      botId: next.botId,
      type: SubscriberEventTypes.TAG_ADDED,
      payload: Object.freeze({ tag: name }),
      occurredAt: new Date().toISOString(),
      source: "flow" as const,
    });
    await this.repos.events.append(event);
    await this.bus.emit(event);
    return next;
  }

  async removeTag(subscriber: Subscriber, tagName: string): Promise<Subscriber> {
    const name = String(tagName || "").trim();
    if (!name || !subscriber.tags.includes(name)) return subscriber;
    const next: Subscriber = {
      ...subscriber,
      tags: Object.freeze(subscriber.tags.filter((t) => t !== name)),
      updatedAt: new Date().toISOString(),
    };
    await this.repos.subscribers.save(next);
    const event = Object.freeze({
      id: newEventId(),
      subscriberId: next.id,
      botId: next.botId,
      type: SubscriberEventTypes.TAG_REMOVED,
      payload: Object.freeze({ tag: name }),
      occurredAt: new Date().toISOString(),
      source: "flow" as const,
    });
    await this.repos.events.append(event);
    await this.bus.emit(event);
    return next;
  }
}
