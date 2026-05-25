import { newCustomFieldId, newEventId } from "../entities/ids.js";
import type { CustomFieldDefinition, CustomFieldType, Subscriber } from "../entities/types.js";
import { SubscriberEventTypes } from "../events/subscriberEventTypes.js";
import type { SubscriberRepositories } from "../repositories/interfaces.js";
import { getDefaultSubscriberRepositories } from "../repositories/inMemoryRepositories.js";

export class CustomFieldService {
  constructor(
    private readonly repos: SubscriberRepositories = getDefaultSubscriberRepositories(),
  ) {}

  async defineField(
    botId: string,
    key: string,
    label: string,
    type: CustomFieldType = "text",
    defaultValue: unknown = null,
  ): Promise<CustomFieldDefinition> {
    const existing = await this.repos.customFields.getDefinition(botId, key);
    if (existing) return existing;
    const field: CustomFieldDefinition = {
      id: newCustomFieldId(),
      botId,
      key,
      label,
      type,
      defaultValue,
      createdAt: new Date().toISOString(),
    };
    await this.repos.customFields.saveDefinition(field);
    return field;
  }

  async setField(subscriber: Subscriber, key: string, value: unknown): Promise<Subscriber> {
    const k = String(key || "").trim();
    if (!k) return subscriber;
    await this.defineField(subscriber.botId, k, k);
    const next: Subscriber = {
      ...subscriber,
      customFields: Object.freeze({ ...subscriber.customFields, [k]: value }),
      updatedAt: new Date().toISOString(),
    };
    await this.repos.subscribers.save(next);
    await this.repos.events.append({
      id: newEventId(),
      subscriberId: next.id,
      botId: next.botId,
      type: SubscriberEventTypes.FIELD_UPDATED,
      payload: Object.freeze({ field: k, value }),
      occurredAt: new Date().toISOString(),
      source: "flow",
    });
    return next;
  }
}
