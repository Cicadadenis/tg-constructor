/**
 * Audience engine — segment membership, filters, and batch evaluation (product layer).
 */

import type { Subscriber, AudienceSegment, SegmentFilter } from "../../subscriber/entities/types.js";
import type { SubscriberStateManager } from "../../subscriber/services/subscriberStateManager.js";
import {
  evaluateSegmentFilter,
  filterSubscribersForSegment,
} from "../../subscriber/segmentation/segmentEngine.js";
import {
  evaluateDynamicCondition,
  parseConditionExpression,
} from "../../subscriber/segmentation/dynamicConditionEvaluator.js";
import type { SegmentEvaluationContext } from "../../subscriber/segmentation/segmentEngine.js";

export interface AudienceEvaluateOptions {
  flowVariables?: Record<string, unknown>;
  memberOfSegmentIds?: ReadonlySet<string>;
  eventLimit?: number;
}

/**
 * Product-facing audience engine — wraps core segment engine without altering it.
 */
export class AudienceEngine {
  constructor(private readonly stateManager: SubscriberStateManager) {}

  parseFilter(expression: string): SegmentFilter | null {
    return parseConditionExpression(expression);
  }

  evaluateFilter(
    filter: SegmentFilter,
    subscriber: Subscriber,
    options: AudienceEvaluateOptions = {},
  ): boolean {
    const ctx: SegmentEvaluationContext = {
      subscriber,
      flowVariables: options.flowVariables,
      memberOfSegmentIds: options.memberOfSegmentIds,
    };
    return evaluateSegmentFilter(filter, ctx);
  }

  evaluateExpression(
    expression: string,
    subscriber: Subscriber,
    options: AudienceEvaluateOptions = {},
  ): boolean {
    return evaluateDynamicCondition(expression, {
      subscriber,
      flowVariables: options.flowVariables,
      memberOfSegmentIds: options.memberOfSegmentIds,
    });
  }

  async evaluateSubscriber(
    subscriberId: string,
    filterOrExpression: SegmentFilter | string,
    options: AudienceEvaluateOptions = {},
  ): Promise<boolean> {
    const sub = await this.stateManager.subscribers.getById(subscriberId);
    if (!sub) return false;
    const events = await this.stateManager.events.list(
      subscriberId,
      options.eventLimit ?? 50,
    );
    if (typeof filterOrExpression === "string") {
      return evaluateDynamicCondition(filterOrExpression, {
        subscriber: sub,
        events,
        flowVariables: options.flowVariables,
        memberOfSegmentIds: options.memberOfSegmentIds,
      });
    }
    return evaluateSegmentFilter(filterOrExpression, {
      subscriber: sub,
      events,
      flowVariables: options.flowVariables,
      memberOfSegmentIds: options.memberOfSegmentIds,
    });
  }

  async resolveSegmentMembers(segment: AudienceSegment): Promise<readonly Subscriber[]> {
    return this.stateManager.segments.resolveMembers(segment);
  }

  filterSubscribers(
    subscribers: readonly Subscriber[],
    filter: SegmentFilter,
    options: AudienceEvaluateOptions = {},
  ): Subscriber[] {
    return filterSubscribersForSegment(subscribers, filter, (sub) => ({
      subscriber: sub,
      flowVariables: options.flowVariables,
      memberOfSegmentIds: options.memberOfSegmentIds,
    }));
  }

  async getSegment(botId: string, segmentId: string): Promise<AudienceSegment | null> {
    const segments = await this.stateManager.segments.listByBot(botId);
    return segments.find((s) => s.id === segmentId) ?? null;
  }
}
