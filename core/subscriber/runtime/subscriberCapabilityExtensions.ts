/**
 * Opt-in capability extensions — subscriber-aware branch + variable effects.
 * Does not modify execution scheduler; extends BRANCH when subscriber context is bound.
 */

import type { ExecutionContext } from "../../runtime/executionContext.js";
import {
  registerCapabilityExecutor,
  type CapabilityExecuteResult,
} from "../../runtime/capabilityExecutors.js";
import { CAPABILITY_ACTIONS } from "../../capabilities/capabilityIds.js";
import { getPayload } from "../../runtime/executionContext.js";
import { setStateEffect, freezeEffects } from "../../runtime/execution/executionEffects.mjs";
import { SubscriberStateManager } from "../services/subscriberStateManager.js";
import { evaluateDynamicCondition } from "../segmentation/dynamicConditionEvaluator.js";
import { getBoundSubscriberContext } from "./subscriberContextBinding.js";

let extensionsRegistered = false;

function branchResult(
  partial: Omit<CapabilityExecuteResult, "capabilityId" | "effects"> & {
    effects?: CapabilityExecuteResult["effects"];
  },
): CapabilityExecuteResult {
  return {
    ok: partial.ok,
    capabilityId: CAPABILITY_ACTIONS.BRANCH,
    effects: freezeEffects(partial.effects ? [...partial.effects] : []),
    ...(partial.nextPort !== undefined ? { nextPort: partial.nextPort } : {}),
    ...(partial.error !== undefined ? { error: partial.error } : {}),
    ...(partial.halt !== undefined ? { halt: partial.halt } : {}),
  };
}

/**
 * Register subscriber-aware BRANCH evaluation (idempotent).
 * When no subscriber context: same as legacy (`ok: true`, no branch port).
 */
export function registerSubscriberCapabilityExtensions(
  stateManager?: SubscriberStateManager,
): void {
  if (extensionsRegistered) return;
  extensionsRegistered = true;

  const manager = stateManager ?? new SubscriberStateManager();

  registerCapabilityExecutor(CAPABILITY_ACTIONS.BRANCH, async (ctx: ExecutionContext) => {
    const payload = getPayload(ctx) ?? {};
    const expression = String(
      payload.expression ?? payload.cond ?? "",
    ).trim();

    const subCtx = getBoundSubscriberContext(ctx) ?? manager.getBoundContext(ctx);
    if (!subCtx || !expression) {
      return branchResult({ ok: true });
    }

    const evts = await manager.events.list(subCtx.subscriber.id, 50);
    const pass = evaluateDynamicCondition(expression, {
      subscriber: subCtx.subscriber,
      events: evts,
      flowVariables: ctx.vars,
    });

    const port = pass ? "true" : "false";
    return branchResult({
      ok: true,
      nextPort: port,
      effects: [
        setStateEffect({
          __lastCondition: pass,
          __conditionPort: port,
        }),
      ],
    });
  });
}

export function resetSubscriberCapabilityExtensionsForTests(): void {
  extensionsRegistered = false;
}
