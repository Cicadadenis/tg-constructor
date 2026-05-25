import type { ExecutionContext } from "../../runtime/executionContext.js";
import type { SegmentFilter, SubscriberContext } from "../entities/types.js";
import { evaluateDynamicCondition } from "../segmentation/dynamicConditionEvaluator.js";
import { SubscriberService } from "./subscriberService.js";
import { TagService } from "./tagService.js";
import { CustomFieldService } from "./customFieldService.js";
import { VariableService } from "./variableService.js";
import { EventService } from "./eventService.js";
import { SegmentService } from "./segmentService.js";
import { extractTelegramIdentity } from "../runtime/telegramIdentity.js";
import {
  createInMemorySubscriberRepositories,
  getDefaultSubscriberRepositories,
} from "../repositories/inMemoryRepositories.js";

import {
  CTX_SUBSCRIBER_KEY,
  getBoundSubscriberContext,
  setBoundSubscriberContext,
} from "../runtime/subscriberContextBinding.js";

export interface SubscriberStateManagerOptions {
  botId: string;
  channel?: string;
  flowId?: string;
  executionId?: string;
}

/**
 * Central state orchestration — flow runs revolve around subscriber context.
 */
export class SubscriberStateManager {
  readonly subscribers: SubscriberService;
  readonly tags: TagService;
  readonly fields: CustomFieldService;
  readonly variables: VariableService;
  readonly events: EventService;
  readonly segments: SegmentService;

  private cache = new Map<string, SubscriberContext>();

  private readonly repos: ReturnType<typeof getDefaultSubscriberRepositories>;

  constructor(repos = getDefaultSubscriberRepositories()) {
    this.repos = repos;
    this.subscribers = new SubscriberService(repos);
    this.tags = new TagService(repos);
    this.fields = new CustomFieldService(repos);
    this.variables = new VariableService(repos);
    this.events = new EventService(repos);
    this.segments = new SegmentService(repos);
  }

  /**
   * Bind subscriber context onto execution kernel (non-breaking extension).
   */
  async bindExecutionContext(
    ctx: ExecutionContext,
    options: SubscriberStateManagerOptions,
  ): Promise<SubscriberContext> {
    const identity = extractTelegramIdentity(ctx);
    const externalUserId = identity.externalUserId ?? "sandbox-user";
    const cacheKey = `${options.botId}:${options.channel ?? "telegram"}:${externalUserId}`;

    let subCtx = this.cache.get(cacheKey);
    if (!subCtx) {
      subCtx = await this.subscribers.resolveContext({
        botId: options.botId,
        channel: options.channel ?? identity.channel ?? "telegram",
        externalUserId,
        displayName: identity.displayName,
        locale: identity.locale,
        flowId: options.flowId,
        executionId: options.executionId,
      });
      this.cache.set(cacheKey, subCtx);
    }

    setBoundSubscriberContext(ctx, subCtx);
    Object.assign(
      ctx.vars,
      VariableService.mergeIntoExecutionVars(ctx.vars, subCtx.subscriber, subCtx.session),
    );
    return subCtx;
  }

  getBoundContext(ctx: ExecutionContext): SubscriberContext | null {
    return getBoundSubscriberContext(ctx);
  }

  /**
   * Dynamic condition — evaluate segment filter against current subscriber.
   */
  /**
   * Evaluate audience filter or flow condition expression against bound subscriber.
   */
  async evaluateCondition(
    ctx: ExecutionContext,
    filterOrExpression: SegmentFilter | string,
  ): Promise<boolean> {
    const subCtx = this.getBoundContext(ctx);
    if (!subCtx) return false;
    const evts = await this.events.list(subCtx.subscriber.id, 50);
    const evalCtx = {
      subscriber: subCtx.subscriber,
      events: evts,
      flowVariables: ctx.vars,
    };
    if (typeof filterOrExpression === "string") {
      return evaluateDynamicCondition(filterOrExpression, evalCtx);
    }
    const { evaluateSegmentFilter } = await import("../segmentation/segmentEngine.js");
    return evaluateSegmentFilter(filterOrExpression, evalCtx);
  }

  /** @deprecated use evaluateCondition */
  async evaluateDynamicCondition(
    ctx: ExecutionContext,
    filter: SegmentFilter,
  ): Promise<boolean> {
    return this.evaluateCondition(ctx, filter);
  }

  async refreshAfterMutation(ctx: ExecutionContext): Promise<void> {
    const subCtx = this.getBoundContext(ctx);
    if (!subCtx) return;
    const fresh = await this.subscribers.getById(subCtx.subscriber.id);
    if (!fresh) return;
    const session = await this.repos.sessions.getActiveForSubscriber(fresh.id);
    if (!session) return;
    const next = Object.freeze({
      subscriber: fresh,
      conversation: subCtx.conversation,
      session,
      variables: Object.freeze({ ...session.variables, ...fresh.customFields }),
    });
    setBoundSubscriberContext(ctx, next);
    Object.assign(
      ctx.vars,
      VariableService.mergeIntoExecutionVars({}, fresh, session),
    );
  }
}

let defaultManager: SubscriberStateManager | null = null;

export function getDefaultSubscriberStateManager(): SubscriberStateManager {
  if (!defaultManager) {
    defaultManager = new SubscriberStateManager(getDefaultSubscriberRepositories());
  }
  return defaultManager;
}

/** Fresh manager with isolated in-memory store (tests). */
export function createSubscriberStateManager(
  repos = createInMemorySubscriberRepositories(),
): SubscriberStateManager {
  return new SubscriberStateManager(repos);
}
