import type { SegmentFilter, Subscriber, SubscriberEventRecord } from "../entities/types.js";

export interface SegmentEvaluationContext {
  readonly subscriber: Subscriber;
  readonly events?: readonly SubscriberEventRecord[];
  readonly flowVariables?: Readonly<Record<string, unknown>>;
  readonly memberOfSegmentIds?: ReadonlySet<string>;
}

function mergeVars(ctx: SegmentEvaluationContext): Record<string, unknown> {
  return {
    ...ctx.flowVariables,
    ...ctx.subscriber.customFields,
    ...ctx.subscriber.attributes,
  };
}

function fieldValue(subscriber: Subscriber, field: string): unknown {
  if (Object.prototype.hasOwnProperty.call(subscriber.customFields, field)) {
    return subscriber.customFields[field];
  }
  return subscriber.attributes[field];
}

function eventWithinHours(
  events: readonly SubscriberEventRecord[] | undefined,
  eventType: string,
  withinHours: number,
): boolean {
  if (!events?.length) return false;
  const cutoff = Date.now() - withinHours * 3600 * 1000;
  return events.some(
    (e) => e.type === eventType && new Date(e.occurredAt).getTime() >= cutoff,
  );
}

/**
 * Evaluate audience segment filter against subscriber state (ManyChat-style).
 */
export function evaluateSegmentFilter(
  filter: SegmentFilter,
  ctx: SegmentEvaluationContext,
): boolean {
  const { subscriber } = ctx;

  switch (filter.op) {
    case "and":
      return filter.clauses.every((c) => evaluateSegmentFilter(c, ctx));
    case "or":
      return filter.clauses.some((c) => evaluateSegmentFilter(c, ctx));
    case "not":
      return !evaluateSegmentFilter(filter.clause, ctx);
    case "hasTag":
      return subscriber.tags.includes(filter.tag);
    case "missingTag":
      return !subscriber.tags.includes(filter.tag);
    case "fieldEq":
      return fieldValue(subscriber, filter.field) === filter.value;
    case "fieldContains": {
      const v = String(fieldValue(subscriber, filter.field) ?? "");
      return v.includes(filter.substring);
    }
    case "attrEq":
      return subscriber.attributes[filter.key] === filter.value;
    case "statusEq":
      return subscriber.status === filter.status;
    case "eventOccurred":
      return eventWithinHours(
        ctx.events,
        filter.eventType,
        filter.withinHours ?? 24 * 365,
      );
    case "variableEq": {
      const vars = mergeVars(ctx);
      return vars[filter.key] === filter.value;
    }
    case "variableContains": {
      const v = String(mergeVars(ctx)[filter.key] ?? "");
      return v.includes(filter.substring);
    }
    case "fieldGt": {
      const v = Number(fieldValue(subscriber, filter.field));
      return Number.isFinite(v) && v > filter.value;
    }
    case "fieldLt": {
      const v = Number(fieldValue(subscriber, filter.field));
      return Number.isFinite(v) && v < filter.value;
    }
    case "hasAnyTag":
      return filter.tags.some((t) => subscriber.tags.includes(t));
    case "inSegment":
      return ctx.memberOfSegmentIds?.has(filter.segmentId) ?? false;
    case "dynamicExpr":
      return false;
    default:
      return false;
  }
}

/**
 * Filter subscribers matching segment definition.
 */
export function filterSubscribersForSegment(
  subscribers: readonly Subscriber[],
  filter: SegmentFilter,
  ctxFactory: (s: Subscriber) => SegmentEvaluationContext,
): Subscriber[] {
  return subscribers.filter((s) => evaluateSegmentFilter(filter, ctxFactory(s)));
}
