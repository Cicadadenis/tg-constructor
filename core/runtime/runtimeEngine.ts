/**
 * Capability execution engine — runtime.execute(capability).
 */

import type { BotExecutionPlan, CapabilityPlanStep } from "./executionPlan.js";
import { buildExecutionPlan } from "./executionPlan.js";
import type { BotIRGraph } from "../ir/bot_ir.js";
import type { BotRuntimeContext } from "./runtimeContext.js";
import { createTransport, type TransportAdapter } from "../transport/transportAdapter.js";
import { TELEGRAM_TRANSPORT_ID } from "../transport/telegramAdapter.js";
import {
  ensureCapabilityExecutorsRegistered,
  executeCapability,
  type CapabilityExecuteResult,
} from "./capabilityExecutors.js";

export interface RuntimeExecuteOptions {
  transport?: TransportAdapter;
  transportId?: string;
  nodeId?: string;
  stepId?: string;
}

export interface RuntimeEngine {
  readonly plan: BotExecutionPlan;
  execute(
    capabilityId: string,
    payload?: Record<string, unknown>,
    options?: RuntimeExecuteOptions,
  ): Promise<CapabilityExecuteResult>;
  executeStep(
    stepId: string,
    runtime: BotRuntimeContext,
    options?: RuntimeExecuteOptions,
  ): Promise<CapabilityExecuteResult>;
}

function mergePayload(
  base: Readonly<Record<string, unknown>>,
  extra?: Record<string, unknown>,
): Readonly<Record<string, unknown>> {
  if (!extra || !Object.keys(extra).length) return base;
  return Object.freeze({ ...base, ...extra });
}

/**
 * Create engine from Bot IR (builds immutable execution plan).
 */
export function createRuntimeEngine(
  botIr: BotIRGraph,
  options: { transportId?: string } = {},
): RuntimeEngine {
  ensureCapabilityExecutorsRegistered();
  const plan = buildExecutionPlan(botIr);
  const defaultTransportId = options.transportId ?? TELEGRAM_TRANSPORT_ID;

  const resolveTransport = (opts?: RuntimeExecuteOptions): TransportAdapter =>
    opts?.transport ?? createTransport(opts?.transportId ?? defaultTransportId);

  return Object.freeze({
    plan,
    async execute(capabilityId, payload = {}, options = {}) {
      const runtime = payload._runtime as BotRuntimeContext | undefined;
      if (!runtime) {
        throw new Error(
          "runtime.execute(capability): pass BotRuntimeContext via payload._runtime",
        );
      }
      const { _runtime: _, ...cleanPayload } = payload;
      return executeCapability(capabilityId, {
        runtime,
        transport: resolveTransport(options),
        payload: cleanPayload,
        nodeId: options.nodeId,
        stepId: options.stepId,
      });
    },
    async executeStep(stepId, runtime, options = {}) {
      const step = plan.steps.find((s) => s.stepId === stepId);
      if (!step) {
        throw new Error(`Unknown plan step: "${stepId}"`);
      }
      return executeCapability(step.capabilityId, {
        runtime,
        transport: resolveTransport(options),
        payload: mergePayload(step.payload, undefined),
        nodeId: step.nodeId,
        stepId: step.stepId,
      });
    },
  });
}

/**
 * Global entry: runtime.execute(capability, runtimeCtx, payload, options).
 */
export async function execute(
  capabilityId: string,
  runtime: BotRuntimeContext,
  payload: Record<string, unknown> = {},
  options: RuntimeExecuteOptions = {},
): Promise<CapabilityExecuteResult> {
  ensureCapabilityExecutorsRegistered();
  const transport =
    options.transport
    ?? createTransport(options.transportId ?? TELEGRAM_TRANSPORT_ID);

  return executeCapability(capabilityId, {
    runtime,
    transport,
    payload: Object.freeze({ ...payload }),
    nodeId: options.nodeId,
    stepId: options.stepId,
  });
}

export type { CapabilityPlanStep, BotExecutionPlan };
