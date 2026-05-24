/**
 * Execution IR types + re-exports (implementation in executionIrCore.mjs).
 */

export {
  EXECUTION_IR_VERSION,
  freezeExecutionIrPlan,
  freezeStep,
  freezeBarrier,
  getExecutionStep,
  getJoinBarrier,
} from "./executionIrCore.mjs";

export type ExecutionStepKind =
  | "action"
  | "fork"
  | "join"
  | "barrier"
  | "halt";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "suspended"
  | "completed"
  | "failed"
  | "compensating";

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMs: number;
  readonly retryableErrors?: readonly string[];
}

export interface ForkBranch {
  readonly branchId: string;
  readonly entryStepId: string;
  readonly label?: string;
}

export interface JoinBarrier {
  readonly barrierId: string;
  readonly requiredBranchIds: readonly string[];
  readonly mergeStepId: string;
}

export interface ExecutionIrStep {
  readonly stepId: string;
  readonly kind: ExecutionStepKind;
  readonly capabilityId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly successors: readonly string[];
  readonly forkBranches?: readonly ForkBranch[];
  readonly joinBarrierId?: string;
  readonly retry?: RetryPolicy;
  readonly compensateStepId?: string;
  readonly sourceNodeId?: string;
}

export interface ExecutionIrPlan {
  readonly version: string;
  readonly planId: string;
  readonly entryStepId: string;
  readonly steps: readonly ExecutionIrStep[];
  readonly barriers: readonly JoinBarrier[];
  readonly stepById: Readonly<Record<string, ExecutionIrStep>>;
  readonly barrierById: Readonly<Record<string, JoinBarrier>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}
