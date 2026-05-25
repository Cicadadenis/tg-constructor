/**
 * Product subscriber layer — CRM facade over core/subscriber (non-breaking).
 */

import type { SubscriberRepositories } from "../../subscriber/repositories/interfaces.js";
import {
  bootstrapSubscriberRuntime,
  type BootstrapSubscriberRuntimeOptions,
  type SubscriberRuntimeBundle,
} from "../../subscriber/bootstrap.js";
import type { SubscriberStateManager } from "../../subscriber/services/subscriberStateManager.js";
import type {
  AudienceSegment,
  SegmentFilter,
  Subscriber,
  SubscriberContext,
  TagDefinition,
  CustomFieldDefinition,
} from "../../subscriber/entities/types.js";
import { SubscriberRuntimeAdapter } from "../../subscriber/runtime/subscriberRuntimeAdapter.js";
import type { ExecutionContext } from "../../runtime/executionContext.js";
import { AudienceEngine } from "./audienceEngine.js";
import { SubscriberEventPipeline } from "./eventPipeline.js";
import { registerSubscriberProductExtensions } from "./registerProductExtensions.js";

export interface ProductSubscriberLayerOptions extends BootstrapSubscriberRuntimeOptions {
  startEventPipeline?: boolean;
}

export interface ProductSubscriberLayer extends SubscriberRuntimeBundle {
  audience: AudienceEngine;
  pipeline: SubscriberEventPipeline;
  createRuntimeAdapter(botId: string, flowId?: string): SubscriberRuntimeAdapter;
  bindFlowExecution(ctx: ExecutionContext, botId: string, flowId?: string): Promise<SubscriberContext>;
}

/**
 * Bootstrap subscriber-centric product layer on top of core runtime.
 */
export function createProductSubscriberLayer(
  options: ProductSubscriberLayerOptions = {},
): ProductSubscriberLayer {
  const bundle = bootstrapSubscriberRuntime({
    enableCapabilityExtensions: true,
    ...options,
  });

  registerSubscriberProductExtensions(bundle.stateManager);

  const audience = new AudienceEngine(bundle.stateManager);
  const pipeline = new SubscriberEventPipeline(bundle.stateManager, {
    triggers: bundle.eventTriggers,
    onFlowTrigger: options.onFlowTrigger,
  });

  if (options.startEventPipeline !== false) {
    pipeline.start();
  }

  const layer: ProductSubscriberLayer = {
    ...bundle,
    audience,
    pipeline,
    createRuntimeAdapter(botId: string, flowId?: string) {
      return new SubscriberRuntimeAdapter({
        botId,
        flowId,
        stateManager: bundle.stateManager,
        enableCapabilityExtensions: true,
      });
    },
    async bindFlowExecution(ctx, botId, flowId) {
      const adapter = layer.createRuntimeAdapter(botId, flowId);
      await adapter.prepareExecutionContext(ctx);
      const subCtx = bundle.stateManager.getBoundContext(ctx);
      if (!subCtx) {
        throw new Error("subscriber_context_bind_failed");
      }
      return subCtx;
    },
  };

  return layer;
}

/** Domain shortcuts for CRM UI / API */
export class SubscriberProductApi {
  constructor(
    readonly repos: SubscriberRepositories,
    readonly stateManager: SubscriberStateManager,
    readonly audience: AudienceEngine,
    readonly pipeline: SubscriberEventPipeline,
  ) {}

  listSubscribers(botId: string) {
    return this.repos.subscribers.listByBot(botId);
  }

  getSubscriber(id: string) {
    return this.repos.subscribers.getById(id);
  }

  async addTag(subscriber: Subscriber, tag: string) {
    return this.stateManager.tags.addTag(subscriber, tag);
  }

  async removeTag(subscriber: Subscriber, tag: string) {
    return this.stateManager.tags.removeTag(subscriber, tag);
  }

  async setField(subscriber: Subscriber, key: string, value: unknown) {
    return this.stateManager.fields.setField(subscriber, key, value);
  }

  async setSessionVariable(
    sessionId: string,
    key: string,
    value: unknown,
  ) {
    const session = await this.repos.sessions.getById(sessionId);
    if (!session) throw new Error("session_not_found");
    return this.stateManager.variables.setSessionVariable(session, key, value);
  }

  listTags(botId: string): Promise<readonly TagDefinition[]> {
    return this.repos.tags.listDefinitions(botId);
  }

  listCustomFields(botId: string): Promise<readonly CustomFieldDefinition[]> {
    return this.repos.customFields.listDefinitions(botId);
  }

  listSegments(botId: string): Promise<readonly AudienceSegment[]> {
    return this.stateManager.segments.listByBot(botId);
  }

  createSegment(botId: string, name: string, filter: SegmentFilter, description = "") {
    return this.stateManager.segments.create(botId, name, filter, description);
  }

  listEvents(subscriberId: string, limit = 50) {
    return this.stateManager.events.list(subscriberId, limit);
  }

  listSessions(subscriberId: string) {
    return this.repos.sessions.getActiveForSubscriber(subscriberId).then((s) =>
      s ? [s] : [],
    );
  }
}

export function createSubscriberProductApi(
  layer: ProductSubscriberLayer,
): SubscriberProductApi {
  return new SubscriberProductApi(
    layer.repos,
    layer.stateManager,
    layer.audience,
    layer.pipeline,
  );
}
