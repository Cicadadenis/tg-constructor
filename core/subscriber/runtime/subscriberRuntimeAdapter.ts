import type { ExecutionContext } from "../../runtime/executionContext.js";
import type { SchedulerRunOptions } from "../../runtime/execution/executionScheduler.js";
import type { EmitEventEffect } from "../../runtime/execution/executionEffects.js";
import { SubscriberStateManager } from "../services/subscriberStateManager.js";
import { isSubscriberDomainEvent } from "../events/subscriberEventTypes.js";
import { registerSubscriberCapabilityExtensions } from "./subscriberCapabilityExtensions.js";

export interface SubscriberRuntimeAdapterOptions {
  botId: string;
  channel?: string;
  flowId?: string;
  stateManager?: SubscriberStateManager;
  /** When true, registers subscriber-aware BRANCH executor (call after ensureCapabilityExecutorsRegistered). */
  enableCapabilityExtensions?: boolean;
}

/**
 * Runtime adapter — wires subscriber state into execution runs (opt-in).
 */
export class SubscriberRuntimeAdapter {
  readonly stateManager: SubscriberStateManager;

  constructor(private readonly options: SubscriberRuntimeAdapterOptions) {
    this.stateManager = options.stateManager ?? new SubscriberStateManager();
    if (options.enableCapabilityExtensions !== false) {
      registerSubscriberCapabilityExtensions(this.stateManager);
    }
  }

  /**
   * Prepare execution context before scheduler.start() or runtime.execute().
   */
  async prepareExecutionContext(ctx: ExecutionContext): Promise<void> {
    await this.stateManager.bindExecutionContext(ctx, {
      botId: this.options.botId,
      channel: this.options.channel,
      flowId: this.options.flowId,
      executionId: ctx.traceId,
    });
  }

  /**
   * Extend scheduler options with subscriber emit handler (non-breaking optional).
   */
  extendSchedulerOptions(
    base: SchedulerRunOptions = {},
  ): SchedulerRunOptions {
    const manager = this.stateManager;
    const prior = base.onEmitEvent;
    return {
      ...base,
      onEmitEvent: async (effect: EmitEventEffect) => {
        if (prior) await prior(effect);
        if (!isSubscriberDomainEvent(effect.eventType)) return;
        const ctx = base.execution;
        if (!ctx) return;
        const subCtx = manager.getBoundContext(ctx);
        if (!subCtx) return;
        await manager.events.track(subCtx.subscriber, effect.eventType, {
          ...effect.payload,
        }, "flow");
        await manager.refreshAfterMutation(ctx);
      },
    };
  }
}
