import type { ExecutionContext } from "../../runtime/executionContext.js";
import type { SubscriberContext } from "../entities/types.js";

export const CTX_SUBSCRIBER_KEY = "__subscriberContext";

export function getBoundSubscriberContext(
  ctx: ExecutionContext,
): SubscriberContext | null {
  const raw = ctx.temp[CTX_SUBSCRIBER_KEY];
  return raw && typeof raw === "object" ? (raw as SubscriberContext) : null;
}

export function setBoundSubscriberContext(
  ctx: ExecutionContext,
  subCtx: SubscriberContext,
): void {
  ctx.temp[CTX_SUBSCRIBER_KEY] = subCtx;
}
