/**
 * Runtime enforcement of compile-time ExecutionContract on Execution IR steps.
 */

import {
  assertValidExecutionContract,
  executionContractToRetryPolicy,
} from "../../node_manifest/executionContract.mjs";
import type {
  ExecutionContractSnapshot,
  ExecutionIrStep,
  RetryPolicy,
} from "./executionIr.js";

export class ExecutionContractEnforcementError extends Error {
  readonly stepId: string;

  constructor(stepId: string, message: string) {
    super(message);
    this.name = "ExecutionContractEnforcementError";
    this.stepId = stepId;
  }
}

export function requireStepExecutionContract(
  step: ExecutionIrStep,
): ExecutionContractSnapshot {
  if (step.kind === "join") {
    throw new ExecutionContractEnforcementError(
      step.stepId,
      `Join step ${step.stepId} must not execute capabilities directly`,
    );
  }
  if (!step.executionContract) {
    throw new ExecutionContractEnforcementError(
      step.stepId,
      `Step ${step.stepId} is missing executionContract — compile via Graph → NodeManifest validation → Execution IR`,
    );
  }
  return assertValidExecutionContract(step.executionContract, {
    nodeId: step.sourceNodeId,
  }) as ExecutionContractSnapshot;
}

export function resolveStepRetryPolicy(
  contract: ExecutionContractSnapshot,
): RetryPolicy | undefined {
  return executionContractToRetryPolicy(contract);
}

export function manifestBlockTypeFromStep(step: ExecutionIrStep): string | undefined {
  const raw = step.payload?._manifestBlockType;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}
