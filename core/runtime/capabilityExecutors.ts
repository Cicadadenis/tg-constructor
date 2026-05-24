/**
 * Capability executors — runtime dispatch by capability id (not node.type).
 */

import type { BotRuntimeContext } from "./runtimeContext.js";
import type { TransportAdapter } from "../transport/transportAdapter.js";
import { CAPABILITY_ACTIONS } from "../capabilities/capabilityIds.js";

export interface CapabilityExecuteContext {
  runtime: BotRuntimeContext;
  transport: TransportAdapter;
  payload: Readonly<Record<string, unknown>>;
  nodeId?: string;
  stepId?: string;
}

export interface CapabilityExecuteResult {
  ok: boolean;
  capabilityId: string;
  halt?: boolean;
  nextPort?: string;
  error?: string;
}

export type CapabilityExecutorFn = (
  ctx: CapabilityExecuteContext,
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

async function runExecutor(
  capabilityId: string,
  ctx: CapabilityExecuteContext,
): Promise<CapabilityExecuteResult> {
  const fn = executors.get(capabilityId);
  if (!fn) {
    throw new UnknownCapabilityExecutorError(capabilityId);
  }
  const result = await fn(ctx);
  return { ...result, capabilityId };
}

/** Execute a single capability (fail-fast if unregistered). */
export async function executeCapability(
  capabilityId: string,
  ctx: CapabilityExecuteContext,
): Promise<CapabilityExecuteResult> {
  return runExecutor(String(capabilityId || "").trim(), ctx);
}

function registerCoreExecutors(): void {
  registerCapabilityExecutor(CAPABILITY_ACTIONS.NOOP, () => ({
    ok: true,
    capabilityId: CAPABILITY_ACTIONS.NOOP,
  }));

  registerCapabilityExecutor(CAPABILITY_ACTIONS.ROUTE, () => ({
    ok: true,
    capabilityId: CAPABILITY_ACTIONS.ROUTE,
  }));

  registerCapabilityExecutor(CAPABILITY_ACTIONS.SEND_MESSAGE, async ({
    runtime,
    transport,
    payload,
  }) => {
    const text = String(payload.text ?? "").trim();
    if (text) {
      await transport.sendMessage(runtime, text);
    }
    return { ok: true, capabilityId: CAPABILITY_ACTIONS.SEND_MESSAGE };
  });

  registerCapabilityExecutor(CAPABILITY_ACTIONS.CTX_SET_VAR, ({ runtime, payload }) => {
    const name = String(payload.varname ?? payload.name ?? "").trim();
    if (name) {
      runtime.vars[name] = payload.value ?? null;
    }
    return { ok: true, capabilityId: CAPABILITY_ACTIONS.CTX_SET_VAR };
  });

  registerCapabilityExecutor(CAPABILITY_ACTIONS.CTX_GET_VAR, ({ runtime, payload }) => {
    const name = String(payload.varname ?? payload.name ?? "").trim();
    const into = String(payload.into ?? payload.target ?? name).trim();
    if (into && name) {
      runtime.vars[into] = runtime.vars[name];
    }
    return { ok: true, capabilityId: CAPABILITY_ACTIONS.CTX_GET_VAR };
  });

  registerCapabilityExecutor(CAPABILITY_ACTIONS.HALT, () => ({
    ok: true,
    capabilityId: CAPABILITY_ACTIONS.HALT,
    halt: true,
  }));

  registerCapabilityExecutor(CAPABILITY_ACTIONS.LOG, ({ payload }) => {
    const message = String(payload.message ?? payload.text ?? "");
    if (message) {
      console.log("[bot]", message);
    }
    return { ok: true, capabilityId: CAPABILITY_ACTIONS.LOG };
  });

  registerCapabilityExecutor(CAPABILITY_ACTIONS.SLEEP, async () => {
    return { ok: true, capabilityId: CAPABILITY_ACTIONS.SLEEP };
  });

  registerCapabilityExecutor(CAPABILITY_ACTIONS.BRANCH, () => ({
    ok: true,
    capabilityId: CAPABILITY_ACTIONS.BRANCH,
  }));

  registerCapabilityExecutor(CAPABILITY_ACTIONS.BRANCH_FALLBACK, () => ({
    ok: true,
    capabilityId: CAPABILITY_ACTIONS.BRANCH_FALLBACK,
  }));
}

let bootstrapped = false;

export function ensureCapabilityExecutorsRegistered(): void {
  if (bootstrapped) return;
  registerCoreExecutors();
  bootstrapped = true;
}
