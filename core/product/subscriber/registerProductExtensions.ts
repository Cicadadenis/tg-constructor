/**
 * Product capability extensions — subscriber tag/field/variable/event actions.
 * Opt-in: registered by createProductSubscriberLayer(); falls through when no subscriber context.
 */

import type { ExecutionContext } from "../../runtime/executionContext.js";
import {
  registerCapabilityExecutor,
  type CapabilityExecuteResult,
} from "../../runtime/capabilityExecutors.js";
import { CAPABILITY_ACTIONS } from "../../capabilities/capabilityIds.mjs";
import { getBlockType, getPayload } from "../../runtime/executionContext.js";
import type { ExecutionEffect } from "../../runtime/execution/executionEffects.mjs";
import {
  freezeEffects,
  setStateEffect,
} from "../../runtime/execution/executionEffects.mjs";
import type { SubscriberStateManager } from "../../subscriber/services/subscriberStateManager.js";
import { getBoundSubscriberContext } from "../../subscriber/runtime/subscriberContextBinding.js";
import { effectsForBlockType } from "../../subscriber/runtime/subscriberExecutionBridge.mjs";

let productExtensionsRegistered = false;

function capResult(
  capabilityId: string,
  partial: Omit<CapabilityExecuteResult, "capabilityId" | "effects"> & {
    effects?: CapabilityExecuteResult["effects"];
  },
): CapabilityExecuteResult {
  return {
    ok: partial.ok,
    capabilityId,
    effects: freezeEffects(partial.effects ? [...partial.effects] : []),
    ...(partial.nextPort !== undefined ? { nextPort: partial.nextPort } : {}),
    ...(partial.halt !== undefined ? { halt: partial.halt } : {}),
    ...(partial.error !== undefined ? { error: partial.error } : {}),
  };
}

function subscriberEffectsFromBlock(ctx: ExecutionContext): readonly ExecutionEffect[] {
  const blockType = getBlockType(ctx) ?? "";
  const payload = getPayload(ctx) ?? {};
  return effectsForBlockType(blockType, payload) as readonly ExecutionEffect[];
}

/**
 * Register subscriber data capability executors (idempotent).
 */
export function registerSubscriberProductExtensions(
  stateManager?: SubscriberStateManager,
): void {
  if (productExtensionsRegistered) return;
  productExtensionsRegistered = true;

  const manager = stateManager;

  const runSubscriberAction = (
    capabilityId: string,
    ctx: ExecutionContext,
  ): CapabilityExecuteResult => {
    const subCtx = getBoundSubscriberContext(ctx) ?? manager?.getBoundContext(ctx);
    if (!subCtx) {
      return capResult(capabilityId, { ok: true });
    }
    const fx = subscriberEffectsFromBlock(ctx);
    return capResult(capabilityId, { ok: true, effects: fx });
  };

  registerCapabilityExecutor(CAPABILITY_ACTIONS.SUBSCRIBER_TAG, (ctx) =>
    runSubscriberAction(CAPABILITY_ACTIONS.SUBSCRIBER_TAG, ctx),
  );

  registerCapabilityExecutor(CAPABILITY_ACTIONS.SUBSCRIBER_FIELD, (ctx) =>
    runSubscriberAction(CAPABILITY_ACTIONS.SUBSCRIBER_FIELD, ctx),
  );

  registerCapabilityExecutor(CAPABILITY_ACTIONS.SUBSCRIBER_VARIABLE, (ctx) =>
    runSubscriberAction(CAPABILITY_ACTIONS.SUBSCRIBER_VARIABLE, ctx),
  );

  registerCapabilityExecutor(CAPABILITY_ACTIONS.SUBSCRIBER_TRACK_EVENT, (ctx) =>
    runSubscriberAction(CAPABILITY_ACTIONS.SUBSCRIBER_TRACK_EVENT, ctx),
  );

  /** Legacy set_global → subscriber tag when context bound */
  registerCapabilityExecutor(CAPABILITY_ACTIONS.SET_GLOBAL, (ctx) => {
    const subCtx = getBoundSubscriberContext(ctx) ?? manager?.getBoundContext(ctx);
    if (!subCtx) {
      return capResult(CAPABILITY_ACTIONS.SET_GLOBAL, { ok: true });
    }
    const fx = effectsForBlockType("set_global", getPayload(ctx) ?? {});
    return capResult(CAPABILITY_ACTIONS.SET_GLOBAL, { ok: true, effects: fx });
  });

  /** Session variable → subscriber session var when bound */
  registerCapabilityExecutor(CAPABILITY_ACTIONS.CTX_SET_VAR, (ctx) => {
    const payload = getPayload(ctx) ?? {};
    const name = String(payload.varname ?? payload.name ?? "").trim();
    const subCtx = getBoundSubscriberContext(ctx) ?? manager?.getBoundContext(ctx);
    const legacyEffects = name
      ? [setStateEffect({ [name]: payload.value ?? null })]
      : [];
    if (!subCtx) {
      return capResult(CAPABILITY_ACTIONS.CTX_SET_VAR, {
        ok: true,
        effects: legacyEffects,
      });
    }
    const blockType = getBlockType(ctx) ?? "set_variable";
    const subFx = effectsForBlockType(blockType, payload);
    return capResult(CAPABILITY_ACTIONS.CTX_SET_VAR, {
      ok: true,
      effects: [...legacyEffects, ...subFx],
    });
  });
}

export function resetSubscriberProductExtensionsForTests(): void {
  productExtensionsRegistered = false;
}
