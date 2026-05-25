/**
 * Unified execution kernel — single context for all node/capability execution.
 */

import { randomUUID } from "node:crypto";
import type { TransportAdapter } from "../transport/transportAdapter.js";
import type { ExecutionDbAccess } from "./executionDb.js";
import { getDefaultExecutionDb } from "./executionDb.js";
import type { ExecutionLogger } from "./executionLogger.js";
import { getDefaultExecutionLogger } from "./executionLogger.js";

export const EXECUTION_CONTEXT_VERSION = "1.0";

/** Ephemeral per-run / per-node keys stored in ctx.temp (not global). */
export const EXEC_CTX_TEMP = Object.freeze({
  TRANSPORT: "__transport",
  PAYLOAD: "__payload",
  NODE_ID: "__nodeId",
  STEP_ID: "__stepId",
  BLOCK_TYPE: "__blockType",
  CALLBACK: "__callback",
  REPLAY_ONLY: "__replayOnly",
});

export interface ExecutionContext {
  readonly traceId: string;
  user: unknown;
  chat: unknown;
  message: unknown;
  state: unknown;
  vars: Record<string, unknown>;
  temp: Record<string, unknown>;
  readonly db: ExecutionDbAccess;
  readonly logger: ExecutionLogger;
}

export interface CreateExecutionContextOptions {
  traceId?: string;
  user?: unknown;
  chat?: unknown;
  message?: unknown;
  /** Callback query object (ephemeral; stored in temp). */
  callback?: unknown;
  state?: unknown;
  vars?: Record<string, unknown>;
  temp?: Record<string, unknown>;
  db?: ExecutionDbAccess;
  logger?: ExecutionLogger;
  transport?: TransportAdapter;
}

export interface NodeExecutionScope {
  payload: Readonly<Record<string, unknown>>;
  nodeId?: string;
  stepId?: string;
  blockType?: string;
}

/**
 * Create a fresh execution context for a run or handler invocation.
 */
export function createExecutionContext(
  options: CreateExecutionContextOptions = {},
): ExecutionContext {
  const temp: Record<string, unknown> = { ...(options.temp ?? {}) };
  if (options.callback !== undefined) {
    temp[EXEC_CTX_TEMP.CALLBACK] = options.callback;
  }
  if (options.transport) {
    temp[EXEC_CTX_TEMP.TRANSPORT] = options.transport;
  }

  return {
    traceId: options.traceId ?? randomUUID(),
    user: options.user ?? null,
    chat: options.chat ?? null,
    message: options.message ?? null,
    state: options.state ?? null,
    vars: { ...(options.vars ?? {}) },
    temp,
    db: options.db ?? getDefaultExecutionDb(),
    logger: options.logger ?? getDefaultExecutionLogger(),
  };
}

/** Attach transport for the duration of a scheduler run. */
export function bindRunScope(
  ctx: ExecutionContext,
  scope: { transport: TransportAdapter; replayOnly?: boolean },
): void {
  ctx.temp[EXEC_CTX_TEMP.TRANSPORT] = scope.transport;
  if (scope.replayOnly !== undefined) {
    ctx.temp[EXEC_CTX_TEMP.REPLAY_ONLY] = scope.replayOnly;
  }
}

/** Attach current step scope before invoking a node capability. */
export function bindNodeScope(ctx: ExecutionContext, scope: NodeExecutionScope): void {
  ctx.temp[EXEC_CTX_TEMP.PAYLOAD] = scope.payload;
  if (scope.nodeId !== undefined) ctx.temp[EXEC_CTX_TEMP.NODE_ID] = scope.nodeId;
  if (scope.stepId !== undefined) ctx.temp[EXEC_CTX_TEMP.STEP_ID] = scope.stepId;
  if (scope.blockType !== undefined) ctx.temp[EXEC_CTX_TEMP.BLOCK_TYPE] = scope.blockType;
}

export function clearNodeScope(ctx: ExecutionContext): void {
  delete ctx.temp[EXEC_CTX_TEMP.PAYLOAD];
  delete ctx.temp[EXEC_CTX_TEMP.NODE_ID];
  delete ctx.temp[EXEC_CTX_TEMP.STEP_ID];
  delete ctx.temp[EXEC_CTX_TEMP.BLOCK_TYPE];
}

export function getPayload(ctx: ExecutionContext): Readonly<Record<string, unknown>> {
  const raw = ctx.temp[EXEC_CTX_TEMP.PAYLOAD];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.freeze({ .../** @type {Record<string, unknown>} */ (raw) });
  }
  return Object.freeze({});
}

export function getNodeId(ctx: ExecutionContext): string | undefined {
  const v = ctx.temp[EXEC_CTX_TEMP.NODE_ID];
  return v != null ? String(v) : undefined;
}

export function getStepId(ctx: ExecutionContext): string | undefined {
  const v = ctx.temp[EXEC_CTX_TEMP.STEP_ID];
  return v != null ? String(v) : undefined;
}

export function getBlockType(ctx: ExecutionContext): string | undefined {
  const v = ctx.temp[EXEC_CTX_TEMP.BLOCK_TYPE];
  if (typeof v === "string" && v.trim()) return v.trim();
  const payload = getPayload(ctx);
  const fromPayload = payload._blockType ?? payload._manifestBlockType;
  return typeof fromPayload === "string" && fromPayload.trim()
    ? fromPayload.trim()
    : undefined;
}

export function requireTransport(ctx: ExecutionContext): TransportAdapter {
  const transport = ctx.temp[EXEC_CTX_TEMP.TRANSPORT];
  if (!transport || typeof transport !== "object" || !("sendMessage" in transport)) {
    throw new Error("ExecutionContext: transport not bound — call bindRunScope() first");
  }
  return transport as TransportAdapter;
}

export function getCallback(ctx: ExecutionContext): unknown {
  return ctx.temp[EXEC_CTX_TEMP.CALLBACK] ?? null;
}

export function isReplayOnly(ctx: ExecutionContext): boolean {
  return ctx.temp[EXEC_CTX_TEMP.REPLAY_ONLY] === true;
}

/**
 * @deprecated Nodes must return setState effects — use applyExecutionEffects() in the engine only.
 */
export function setVar(ctx: ExecutionContext, name: string, value: unknown): void {
  const key = String(name || "").trim();
  if (!key) return;
  ctx.vars[key] = value;
}

export function getVar(ctx: ExecutionContext, name: string, defaultValue?: unknown): unknown {
  const key = String(name || "").trim();
  if (!key) return defaultValue;
  return Object.prototype.hasOwnProperty.call(ctx.vars, key)
    ? ctx.vars[key]
    : defaultValue;
}

/**
 * Migrate legacy BotRuntimeContext-shaped object into ExecutionContext.
 * @deprecated For tests only — prefer createExecutionContext().
 */
export function executionContextFromLegacy(runtime: {
  user?: unknown;
  message?: unknown;
  callback?: unknown;
  state?: unknown;
  vars?: Record<string, unknown>;
  chat?: unknown;
}, options: Omit<CreateExecutionContextOptions, "user" | "message" | "state" | "vars"> = {}): ExecutionContext {
  const chat =
    options.chat
    ?? (runtime.message && typeof runtime.message === "object"
      ? (runtime.message as { chat?: unknown }).chat
      : null)
    ?? (runtime.callback && typeof runtime.callback === "object"
      ? ((runtime.callback as { message?: { chat?: unknown } }).message?.chat ?? null)
      : null);

  return createExecutionContext({
    ...options,
    user: runtime.user ?? null,
    chat,
    message: runtime.message ?? null,
    callback: runtime.callback,
    state: runtime.state ?? null,
    vars: { ...(runtime.vars ?? {}) },
  });
}
