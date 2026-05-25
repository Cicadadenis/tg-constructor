import { newEventId } from "../entities/ids.js";
import type { Subscriber, SubscriberEventRecord } from "../entities/types.js";
import { SubscriberEventTypes } from "../events/subscriberEventTypes.js";
import type { SubscriberEventBus } from "../events/subscriberEventBus.js";
import { getDefaultSubscriberEventBus } from "../events/subscriberEventBus.js";
import type { SubscriberRepositories } from "../repositories/interfaces.js";
import { getDefaultSubscriberRepositories } from "../repositories/inMemoryRepositories.js";

export class EventService {
  constructor(
    private readonly repos: SubscriberRepositories = getDefaultSubscriberRepositories(),
    private readonly bus: SubscriberEventBus = getDefaultSubscriberEventBus(),
  ) {}

  async track(
    subscriber: Subscriber,
    eventType: string,
    payload: Record<string, unknown> = {},
    source: SubscriberEventRecord["source"] = "flow",
  ): Promise<SubscriberEventRecord> {
    const type = eventType.startsWith("subscriber.")
      ? eventType
      : `${SubscriberEventTypes.CUSTOM}.${eventType}`;
    const event: SubscriberEventRecord = Object.freeze({
      id: newEventId(),
      subscriberId: subscriber.id,
      botId: subscriber.botId,
      type,
      payload: Object.freeze({ ...payload }),
      occurredAt: new Date().toISOString(),
      source,
    });
    await this.repos.events.append(event);
    await this.bus.emit(event);
    return event;
  }

  async list(subscriberId: string, limit?: number): Promise<readonly SubscriberEventRecord[]> {
    return this.repos.events.listForSubscriber(subscriberId, limit);
  }
}
