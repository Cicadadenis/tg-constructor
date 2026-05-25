import type { SubscriberEventRecord } from "../entities/types.js";
import { SubscriberEventBus, getDefaultSubscriberEventBus } from "./subscriberEventBus.js";
import { isSubscriberDomainEvent } from "./subscriberEventTypes.js";

export interface EventTriggerRule {
  readonly id: string;
  readonly botId: string;
  readonly eventType: string;
  readonly flowId: string;
  readonly enabled: boolean;
  readonly filter?: Record<string, unknown>;
}

/**
 * Registers flow triggers on subscriber domain events (ManyChat-style automations).
 */
export class EventTriggerService {
  private readonly rules = new Map<string, EventTriggerRule[]>();
  private unsubscribes: Array<() => void> = [];

  constructor(
    private readonly bus: SubscriberEventBus = getDefaultSubscriberEventBus(),
    private readonly onTrigger: (
      rule: EventTriggerRule,
      event: SubscriberEventRecord,
    ) => void | Promise<void> = async () => {},
  ) {}

  register(rule: EventTriggerRule): () => void {
    const list = this.rules.get(rule.botId) ?? [];
    const next = [...list.filter((r) => r.id !== rule.id), rule];
    this.rules.set(rule.botId, next);
    return () => {
      const cur = this.rules.get(rule.botId) ?? [];
      this.rules.set(
        rule.botId,
        cur.filter((r) => r.id !== rule.id),
      );
    };
  }

  listByBot(botId: string): readonly EventTriggerRule[] {
    return Object.freeze([...(this.rules.get(botId) ?? [])]);
  }

  /**
   * Wire bus → matching flow triggers. Call once per process.
   */
  startListening(): () => void {
    if (this.unsubscribes.length) return () => this.stopListening();
    const off = this.bus.onAny(async (event) => {
      const rules = this.rules.get(event.botId) ?? [];
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (!this.matches(rule, event)) continue;
        await this.onTrigger(rule, event);
      }
    });
    this.unsubscribes.push(off);
    return () => this.stopListening();
  }

  stopListening(): void {
    for (const off of this.unsubscribes) off();
    this.unsubscribes = [];
  }

  private matches(rule: EventTriggerRule, event: SubscriberEventRecord): boolean {
    if (rule.eventType !== "*") {
      if (rule.eventType === "subscriber.*") {
        if (!isSubscriberDomainEvent(event.type)) return false;
      } else if (event.type !== rule.eventType) {
        return false;
      }
    }
    const filter = rule.filter;
    if (!filter || !Object.keys(filter).length) return true;
    return Object.entries(filter).every(([k, v]) => event.payload[k] === v);
  }
}
