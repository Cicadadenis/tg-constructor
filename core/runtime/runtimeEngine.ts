/**
 * Capability execution engine — runtime.execute(capability).
 */

import type { BotExecutionPlan, CapabilityPlanStep } from "./executionPlan.js";
import { buildExecutionPlan } from "./executionPlan.js";
import type { BotIRGraph } from "../ir/bot_ir.js";
import type { ExecutionContext } from "./executionContext.js";
import {
  bindNodeScope,
  bindRunScope,
  clearNodeScope,
} from "./executionContext.js";
import { applyExecutionEffects } from "./execution/executionEffects.mjs";
import { createTransport, type TransportAdapter } from "../transport/transportAdapter.js";
import { TELEGRAM_TRANSPORT_ID } from "../transport/telegramAdapter.js";
import {
  ensureCapabilityExecutorsRegistered,
  executeCapability,
  type CapabilityExecuteResult,
} from "./capabilityExecutors.js";
import { assertLegacyExecutionAllowed } from "./legacyExecutionPolicy.mjs";

export interface RuntimeExecuteOptions {
  transport?: TransportAdapter;
  transportId?: string;
  nodeId?: string;
  stepId?: string;
  replayOnly?: boolean;
}

export interface RuntimeEngine {
  readonly plan: BotExecutionPlan;
  execute(
    capabilityId: string,
    execution: ExecutionContext,
    payload?: Record<string, unknown>,
    options?: RuntimeExecuteOptions,
  ): Promise<CapabilityExecuteResult>;
  executeStep(
    stepId: string,
    execution: ExecutionContext,
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

async function runCapabilityWithEffects(
  capabilityId: string,
  execution: ExecutionContext,
  scope: {
    payload: Readonly<Record<string, unknown>>;
    nodeId?: string;
    stepId?: string;
    blockType?: string;
  },
  options: RuntimeExecuteOptions,
): Promise<CapabilityExecuteResult> {
  const transport =
    options.transport
    ?? createTransport(options.transportId ?? TELEGRAM_TRANSPORT_ID);
  bindRunScope(execution, { transport, replayOnly: options.replayOnly });
  bindNodeScope(execution, scope);
  try {
    const capResult = await executeCapability(capabilityId, execution);
    if (capResult.ok) {
      await applyExecutionEffects(execution, capResult.effects, {
        replayOnly: options.replayOnly,
      });
    }
    return capResult;
  } finally {
    clearNodeScope(execution);
  }
}

export function createRuntimeEngine(
  botIr: BotIRGraph,
  options: { transportId?: string } = {},
): RuntimeEngine {
  assertLegacyExecutionAllowed("createRuntimeEngine");
  ensureCapabilityExecutorsRegistered();
  const plan = buildExecutionPlan(botIr);
  const defaultTransportId = options.transportId ?? TELEGRAM_TRANSPORT_ID;

  return Object.freeze({
    plan,
    async execute(
      capabilityId: string,
      execution: ExecutionContext,
      payload: Record<string, unknown> = {},
      options: RuntimeExecuteOptions = {},
    ) {
      return runCapabilityWithEffects(
        capabilityId,
        execution,
        {
          payload: Object.freeze({ ...payload }),
          nodeId: options.nodeId,
          stepId: options.stepId,
        },
        { ...options, transportId: options.transportId ?? defaultTransportId },
      );
    },
    async executeStep(
      stepId: string,
      execution: ExecutionContext,
      options: RuntimeExecuteOptions = {},
    ) {
      const step = plan.steps.find((s) => s.stepId === stepId);
      if (!step) {
        throw new Error(`Unknown plan step: "${stepId}"`);
      }
      return runCapabilityWithEffects(
        step.capabilityId,
        execution,
        {
          payload: mergePayload(step.payload, undefined),
          nodeId: step.nodeId,
          stepId: step.stepId,
        },
        { ...options, transportId: options.transportId ?? defaultTransportId },
      );
    },
  });
}

export async function execute(
  capabilityId: string,
  execution: ExecutionContext,
  payload: Record<string, unknown> = {},
  options: RuntimeExecuteOptions = {},
): Promise<CapabilityExecuteResult> {
  assertLegacyExecutionAllowed("runtime.execute");
  ensureCapabilityExecutorsRegistered();
  return runCapabilityWithEffects(
    capabilityId,
    execution,
    {
      payload: Object.freeze({ ...payload }),
      nodeId: options.nodeId,
      stepId: options.stepId,
    },
    options,
  );
}

export type { CapabilityPlanStep, BotExecutionPlan };
