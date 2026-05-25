/**
 * Subscriber event pipeline — bus → triggers → product handlers (opt-in).
 */

import type { SubscriberEventRecord } from "../../subscriber/entities/types.js";
import { SubscriberEventBus, getDefaultSubscriberEventBus } from "../../subscriber/events/subscriberEventBus.js";
import {
  EventTriggerService,
  type EventTriggerRule,
} from "../../subscriber/events/eventTriggerService.js";
import { SubscriberEventTypes } from "../../subscriber/events/subscriberEventTypes.js";
import type { SubscriberStateManager } from "../../subscriber/services/subscriberStateManager.js";

export type EventPipelineHandler = (
  event: SubscriberEventRecord,
) => void | Promise<void>;

export interface SubscriberEventPipelineOptions {
  bus?: SubscriberEventBus;
  triggers?: EventTriggerService;
  stateManager?: SubscriberStateManager;
  onFlowTrigger?: (
    rule: EventTriggerRule,
    event: SubscriberEventRecord,
  ) => void | Promise<void>;
}

/**
 * Orchestrates domain events: internal bus, flow triggers, and product hooks.
 */
export class SubscriberEventPipeline {
  readonly bus: SubscriberEventBus;
  readonly triggers: EventTriggerService;
  private readonly handlers = new Map<string, Set<EventPipelineHandler>>();
  private busUnsub: (() => void) | null = null;

  constructor(
    private readonly stateManager?: SubscriberStateManager,
    options: SubscriberEventPipelineOptions = {},
  ) {
    this.bus = options.bus ?? getDefaultSubscriberEventBus();
    this.triggers =
      options.triggers
      ?? new EventTriggerService(this.bus, options.onFlowTrigger);
  }

  /** Register a product handler for a specific event type or `*`. */
  on(eventType: string, handler: EventPipelineHandler): () => void {
    const key = String(eventType || "*").trim() || "*";
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  registerFlowTrigger(rule: EventTriggerRule): () => void {
    return this.triggers.register(rule);
  }

  listFlowTriggers(botId: string): readonly EventTriggerRule[] {
    return this.triggers.listByBot(botId);
  }

  /** Start bus fan-out to registered handlers + flow triggers. */
  start(): () => void {
    if (this.busUnsub) return () => this.stop();
    this.triggers.startListening();
    const off = this.bus.onAny(async (event) => {
      await this.dispatch(event);
    });
    this.busUnsub = off;
    return () => this.stop();
  }

  stop(): void {
    this.triggers.stopListening();
    if (this.busUnsub) {
      this.busUnsub();
      this.busUnsub = null;
    }
  }

  /** Emit a domain event (persisted when stateManager + subscriber context available). */
  async emit(
    subscriberId: string,
    botId: string,
    eventType: string,
    payload: Record<string, unknown> = {},
    source: SubscriberEventRecord["source"] = "api",
  ): Promise<SubscriberEventRecord | null> {
    if (!this.stateManager) {
      const synthetic: SubscriberEventRecord = {
        id: `evt_${Date.now()}`,
        subscriberId,
        botId,
        type: eventType,
        payload: Object.freeze({ ...payload }),
        occurredAt: new Date().toISOString(),
        source,
      };
      this.bus.emit(synthetic);
      return synthetic;
    }
    const sub = await this.stateManager.subscribers.getById(subscriberId);
    if (!sub) return null;
    const record = await this.stateManager.events.track(
      sub,
      eventType,
      payload,
      source,
    );
    this.bus.emit(record);
    return record;
  }

  private async dispatch(event: SubscriberEventRecord): Promise<void> {
    const sets = [
      this.handlers.get(event.type),
      this.handlers.get("*"),
    ];
    for (const set of sets) {
      if (!set) continue;
      for (const fn of set) {
        await fn(event);
      }
    }
  }

  static eventCatalog(): readonly string[] {
    return Object.values(SubscriberEventTypes);
  }
}
