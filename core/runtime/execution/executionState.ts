/**
 * Persistent execution state for resumable deterministic runs.
 */

import type { ExecutionStatus } from "./executionIr.js";

export const EXECUTION_STATE_VERSION = "1.0";

export interface BranchRuntimeState {
  readonly branchId: string;
  readonly status: ExecutionStatus;
  readonly completedStepIds: readonly string[];
  readonly error?: string;
}

export interface JoinProgress {
  readonly barrierId: string;
  readonly completedBranchIds: readonly string[];
}

export interface ExecutionStateSnapshot {
  readonly stateVersion: string;
  readonly executionId: string;
  readonly planId: string;
  readonly status: ExecutionStatus;
  readonly activeStepIds: readonly string[];
  readonly completedStepIds: readonly string[];
  readonly failedStepIds: readonly string[];
  readonly branchStates: Readonly<Record<string, BranchRuntimeState>>;
  readonly joinProgress: Readonly<Record<string, JoinProgress>>;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly appliedIdempotencyKeys: readonly string[];
  readonly lastEventSequence: number;
  readonly suspendReason?: string;
  readonly checkpoint: number;
  readonly lastError?: string;
  readonly compensationStepId?: string;
  readonly updatedAt: string;
}

export function createInitialExecutionState(
  executionId: string,
  planId: string,
  entryStepId: string,
): ExecutionStateSnapshot {
  const now = new Date().toISOString();
  return Object.freeze({
    stateVersion: EXECUTION_STATE_VERSION,
    executionId,
    planId,
    status: "running",
    activeStepIds: Object.freeze([entryStepId]),
    completedStepIds: Object.freeze([]),
    failedStepIds: Object.freeze([]),
    branchStates: Object.freeze({}),
    joinProgress: Object.freeze({}),
    variables: Object.freeze({}),
    appliedIdempotencyKeys: Object.freeze([]),
    lastEventSequence: 0,
    checkpoint: 0,
    updatedAt: now,
  });
}

export function cloneSnapshot(
  snapshot: ExecutionStateSnapshot,
  patch: Partial<{
    status: ExecutionStatus;
    activeStepIds: string[];
    completedStepIds: string[];
    failedStepIds: string[];
    branchStates: Record<string, BranchRuntimeState>;
    joinProgress: Record<string, JoinProgress>;
    variables: Record<string, unknown>;
    appliedIdempotencyKeys: string[];
    lastEventSequence: number;
    suspendReason: string | undefined;
    checkpoint: number;
    lastError: string | undefined;
    compensationStepId: string | undefined;
  }>,
): ExecutionStateSnapshot {
  return Object.freeze({
    ...snapshot,
    ...patch,
    activeStepIds: Object.freeze(patch.activeStepIds ?? [...snapshot.activeStepIds]),
    completedStepIds: Object.freeze(patch.completedStepIds ?? [...snapshot.completedStepIds]),
    failedStepIds: Object.freeze(patch.failedStepIds ?? [...snapshot.failedStepIds]),
    branchStates: Object.freeze({
      ...snapshot.branchStates,
      ...(patch.branchStates || {}),
    }),
    joinProgress: Object.freeze({
      ...snapshot.joinProgress,
      ...(patch.joinProgress || {}),
    }),
    variables: Object.freeze({
      ...snapshot.variables,
      ...(patch.variables || {}),
    }),
    appliedIdempotencyKeys: Object.freeze(
      patch.appliedIdempotencyKeys ?? [...snapshot.appliedIdempotencyKeys],
    ),
    lastEventSequence: patch.lastEventSequence ?? snapshot.lastEventSequence,
    checkpoint: patch.checkpoint ?? snapshot.checkpoint + 1,
    updatedAt: new Date().toISOString(),
  });
}

export function isJoinBarrierSatisfied(
  barrier: { requiredBranchIds: readonly string[] },
  progress: JoinProgress | undefined,
): boolean {
  if (!progress) return false;
  const required = new Set(barrier.requiredBranchIds);
  const done = new Set(progress.completedBranchIds);
  for (const id of required) {
    if (!done.has(id)) return false;
  }
  return true;
}
