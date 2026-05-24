/**
 * Capability executors — read-only ExecutionContext; return explicit effects only.
 */

import type { ExecutionContext } from "./executionContext.js";
import {
  getBlockType,
  getNodeId,
  getPayload,
  getStepId,
  getVar,
} from "./executionContext.js";
import type { ExecutionEffect } from "./execution/executionEffects.js";
import {
  effects,
  emitEventEffect,
  freezeEffects,
  sendMessageEffect,
  setStateEffect,
} from "./execution/executionEffects.mjs";
import { CAPABILITY_ACTIONS } from "../capabilities/capabilityIds.js";
import { validateNodeExecution } from "../node_manifest/validateNodeExecution.mjs";

/** Context exposed to node executors — engine applies mutations via effects. */
export type NodeExecutionContext = ExecutionContext;

export interface CapabilityExecuteResult {
  ok: boolean;
  capabilityId: string;
  readonly effects: readonly ExecutionEffect[];
  halt?: boolean;
  nextPort?: string;
  error?: string;
}

export type CapabilityExecutorFn = (
  ctx: NodeExecutionContext,
) => Promise<CapabilityExecuteResult> | CapabilityExecuteResult;

const executors = new Map<string, CapabilityExecutorFn>();

export class UnknownCapabilityExecutorError extends Error {
  readonly capabilityId: string;

  constructor(capabilityId: string) {
    super(`No capability executor registered for "${capabilityId}"`);
    this.name = "UnknownCapabilityExecutorError";
    this.capabilityId = capabilityId;
  }
}

export function registerCapabilityExecutor(
  capabilityId: string,
  fn: CapabilityExecutorFn,
): void {
  const id = String(capabilityId || "").trim();
  if (!id || typeof fn !== "function") {
    throw new Error("registerCapabilityExecutor(id, fn) requires id and function");
  }
  executors.set(id, fn);
}

export function hasCapabilityExecutor(capabilityId: string): boolean {
  return executors.has(String(capabilityId || "").trim());
}

export function listCapabilityExecutors(): string[] {
  return [...executors.keys()].sort();
}

function result(
  capabilityId: string,
  partial: Omit<CapabilityExecuteResult, "capabilityId" | "effects"> & {
    effects?: readonly ExecutionEffect[];
  },
): CapabilityExecuteResult {
  return {
    ok: partial.ok,
    capabilityId,
    effects: freezeEffects(partial.effects ? [...partial.effects] : []),
    ...(partial.halt !== undefined ? { halt: partial.halt } : {}),
    ...(partial.nextPort !== undefined ? { nextPort: partial.nextPort } : {}),
    ...(partial.error !== undefined ? { error: partial.error } : {}),
  };
}

async function runExecutor(
  capabilityId: string,
  ctx: NodeExecutionContext,
): Promise<CapabilityExecuteResult> {
  const fn = executors.get(capabilityId);
  if (!fn) {
    throw new UnknownCapabilityExecutorError(capabilityId);
  }
  const raw = await fn(ctx);
  return result(capabilityId, raw);
}

/**
 * Run a capability (validation + dispatch). Does not apply effects — caller must use
 * applyExecutionEffects() after a successful node execution.
 */
export async function executeCapability(
  capabilityId: string,
  ctx: NodeExecutionContext,
): Promise<CapabilityExecuteResult> {
  const blockType = getBlockType(ctx);
  if (blockType) {
    validateNodeExecution(blockType, getPayload(ctx), {
      nodeId: getNodeId(ctx),
      stepId: getStepId(ctx),
    });
  }
  return runExecutor(String(capabilityId || "").trim(), ctx);
}

function registerCoreExecutors(): void {
  registerCapabilityExecutor(CAPABILITY_ACTIONS.NOOP, () =>
    result(CAPABILITY_ACTIONS.NOOP, { ok: true }),
  );

  registerCapabilityExecutor(CAPABILITY_ACTIONS.ROUTE, () =>
    result(CAPABILITY_ACTIONS.ROUTE, { ok: true }),
  );

  registerCapabilityExecutor(CAPABILITY_ACTIONS.SEND_MESSAGE, (ctx) => {
    const payload = getPayload(ctx);
    const text = String(payload.text ?? "").trim();
    return result(CAPABILITY_ACTIONS.SEND_MESSAGE, {
      ok: true,
      effects: text ? [sendMessageEffect(text)] : [],
    });
  });

  registerCapabilityExecutor(CAPABILITY_ACTIONS.CTX_SET_VAR, (ctx) => {
    const payload = getPayload(ctx);
    const name = String(payload.varname ?? payload.name ?? "").trim();
    if (!name) {
      return result(CAPABILITY_ACTIONS.CTX_SET_VAR, { ok: true });
    }
    return result(CAPABILITY_ACTIONS.CTX_SET_VAR, {
      ok: true,
      effects: [setStateEffect({ [name]: payload.value ?? null })],
    });
  });

  registerCapabilityExecutor(CAPABILITY_ACTIONS.CTX_GET_VAR, (ctx) => {
    const payload = getPayload(ctx);
    const name = String(payload.varname ?? payload.name ?? "").trim();
    const into = String(payload.into ?? payload.target ?? name).trim();
    if (!into || !name) {
      return result(CAPABILITY_ACTIONS.CTX_GET_VAR, { ok: true });
    }
    return result(CAPABILITY_ACTIONS.CTX_GET_VAR, {
      ok: true,
      effects: [setStateEffect({ [into]: getVar(ctx, name) })],
    });
  });

  registerCapabilityExecutor(CAPABILITY_ACTIONS.HALT, () =>
    result(CAPABILITY_ACTIONS.HALT, { ok: true, halt: true }),
  );

  registerCapabilityExecutor(CAPABILITY_ACTIONS.LOG, (ctx) => {
    const payload = getPayload(ctx);
    const message = String(payload.message ?? payload.text ?? "");
    if (!message) {
      return result(CAPABILITY_ACTIONS.LOG, { ok: true });
    }
    return result(CAPABILITY_ACTIONS.LOG, {
      ok: true,
      effects: [
        emitEventEffect("log", {
          message,
          nodeId: getNodeId(ctx),
          stepId: getStepId(ctx),
        }),
      ],
    });
  });

  registerCapabilityExecutor(CAPABILITY_ACTIONS.SLEEP, () =>
    result(CAPABILITY_ACTIONS.SLEEP, { ok: true }),
  );

  registerCapabilityExecutor(CAPABILITY_ACTIONS.BRANCH, () =>
    result(CAPABILITY_ACTIONS.BRANCH, { ok: true }),
  );

  registerCapabilityExecutor(CAPABILITY_ACTIONS.BRANCH_FALLBACK, () =>
    result(CAPABILITY_ACTIONS.BRANCH_FALLBACK, { ok: true }),
  );
}

let bootstrapped = false;

export function ensureCapabilityExecutorsRegistered(): void {
  if (bootstrapped) return;
  registerCoreExecutors();
  bootstrapped = true;
}
