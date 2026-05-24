/**
 * Deterministic execution runtime scheduler — fork/join, retry, compensation, resume.
 */

import { randomUUID } from "node:crypto";
import type { BotRuntimeContext } from "../runtimeContext.js";
import type { TransportAdapter } from "../../transport/transportAdapter.js";
import { createTransport } from "../../transport/transportAdapter.js";
import { TELEGRAM_TRANSPORT_ID } from "../../transport/telegramAdapter.js";
import {
  ensureCapabilityExecutorsRegistered,
  executeCapability,
  type CapabilityExecuteResult,
} from "../capabilityExecutors.js";
import type { ExecutionIrPlan, ExecutionIrStep, RetryPolicy } from "./executionIr.js";
import { getExecutionStep, getJoinBarrier } from "./executionIr.js";
import {
  cloneSnapshot,
  createInitialExecutionState,
  isJoinBarrierSatisfied,
  type ExecutionStateSnapshot,
  type JoinProgress,
} from "./executionState.js";
import {
  getDefaultExecutionStateStore,
  type ExecutionStateStore,
} from "./executionStateStore.js";

export interface SchedulerRunOptions {
  transport?: TransportAdapter;
  transportId?: string;
  runtime?: BotRuntimeContext;
  store?: ExecutionStateStore;
  maxSteps?: number;
}

export interface SchedulerRunResult {
  executionId: string;
  status: ExecutionStateSnapshot["status"];
  snapshot: ExecutionStateSnapshot;
  stepsExecuted: number;
  halted: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: string, policy?: RetryPolicy): boolean {
  if (!policy?.retryableErrors?.length) return true;
  return policy.retryableErrors.some((code) => error.includes(code));
}

async function runWithRetry(
  fn: () => Promise<CapabilityExecuteResult>,
  policy?: RetryPolicy,
): Promise<CapabilityExecuteResult> {
  const maxAttempts = policy?.maxAttempts ?? 1;
  const backoffMs = policy?.backoffMs ?? 0;
  let last: CapabilityExecuteResult = { ok: false, capabilityId: "", error: "no attempt" };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = await fn();
    if (last.ok) return last;
    if (attempt >= maxAttempts) break;
    if (!isRetryableError(last.error || "error", policy)) break;
    if (backoffMs > 0) await sleep(backoffMs * attempt);
  }
  return last;
}

export class ExecutionScheduler {
  readonly plan: ExecutionIrPlan;

  constructor(plan: ExecutionIrPlan) {
    this.plan = plan;
    ensureCapabilityExecutorsRegistered();
  }

  async start(options: SchedulerRunOptions = {}): Promise<SchedulerRunResult> {
    const executionId = randomUUID();
    const snapshot = createInitialExecutionState(
      executionId,
      this.plan.planId,
      this.plan.entryStepId,
    );
    const store = options.store ?? getDefaultExecutionStateStore();
    await store.save(snapshot);
    return this.run(executionId, options);
  }

  async resume(
    executionId: string,
    options: SchedulerRunOptions = {},
  ): Promise<SchedulerRunResult> {
    const store = options.store ?? getDefaultExecutionStateStore();
    const existing = await store.load(executionId);
    if (!existing) {
      throw new Error(`Execution not found: ${executionId}`);
    }
    if (existing.planId !== this.plan.planId) {
      throw new Error(
        `Plan mismatch: state=${existing.planId} engine=${this.plan.planId}`,
      );
    }
    const resumed = cloneSnapshot(existing, {
      status: "running",
      suspendReason: undefined,
    });
    await store.save(resumed);
    return this.run(executionId, options);
  }

  async run(
    executionId: string,
    options: SchedulerRunOptions = {},
  ): Promise<SchedulerRunResult> {
    const store = options.store ?? getDefaultExecutionStateStore();
    let snapshot = await store.load(executionId);
    if (!snapshot) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const transport =
      options.transport
      ?? createTransport(options.transportId ?? TELEGRAM_TRANSPORT_ID);
    const runtime: BotRuntimeContext = options.runtime ?? {
      user: null,
      message: null,
      callback: null,
      state: null,
      vars: { ...snapshot.variables },
    };

    const maxSteps = options.maxSteps ?? 10_000;
    let stepsExecuted = 0;
    let halted = false;

    while (
      snapshot.status === "running" &&
      snapshot.activeStepIds.length > 0 &&
      stepsExecuted < maxSteps
    ) {
      const nextActive: string[] = [];

      for (const stepId of snapshot.activeStepIds) {
        const step = getExecutionStep(this.plan, stepId);
        if (!step) {
          snapshot = cloneSnapshot(snapshot, {
            status: "failed",
            lastError: `Unknown step: ${stepId}`,
            activeStepIds: [],
          });
          break;
        }

        const outcome = await this.executeStep(step, snapshot, runtime, transport);
        stepsExecuted += 1;

        if (outcome.halted) halted = true;

        if (outcome.status === "suspended") {
          snapshot = outcome.snapshot;
          await store.save(snapshot);
          return {
            executionId,
            status: snapshot.status,
            snapshot,
            stepsExecuted,
            halted,
          };
        }

        snapshot = outcome.snapshot;
        nextActive.push(...outcome.nextStepIds);
      }

      const uniqueActive = [...new Set(nextActive)];
      if (snapshot.status === "running") {
        if (!uniqueActive.length) {
          snapshot = cloneSnapshot(snapshot, {
            status: "completed",
            activeStepIds: [],
          });
        } else {
          snapshot = cloneSnapshot(snapshot, { activeStepIds: uniqueActive });
        }
      }

      await store.save(snapshot);
    }

    return {
      executionId,
      status: snapshot.status,
      snapshot,
      stepsExecuted,
      halted,
    };
  }

  private async executeStep(
    step: ExecutionIrStep,
    snapshot: ExecutionStateSnapshot,
    runtime: BotRuntimeContext,
    transport: TransportAdapter,
  ): Promise<{
    snapshot: ExecutionStateSnapshot;
    nextStepIds: string[];
    halted: boolean;
    status: ExecutionStateSnapshot["status"];
  }> {
    const completed = new Set(snapshot.completedStepIds);

    if (step.kind === "halt") {
      return {
        snapshot: cloneSnapshot(snapshot, {
          status: "completed",
          completedStepIds: [...completed, step.stepId],
          activeStepIds: [],
        }),
        nextStepIds: [],
        halted: true,
        status: "completed",
      };
    }

    if (step.kind === "fork" && step.forkBranches?.length) {
      const branchResults = await Promise.all(
        step.forkBranches.map((branch) =>
          this.runBranch(branch.branchId, branch.entryStepId, snapshot, runtime, transport),
        ),
      );

      const branchStates = { ...snapshot.branchStates };
      const joinProgress = { ...snapshot.joinProgress };
      let joinBarrierId = step.successors.find((sid) => {
        const succ = getExecutionStep(this.plan, sid);
        return succ?.kind === "join";
      });
      const joinStep = joinBarrierId
        ? getExecutionStep(this.plan, joinBarrierId)
        : undefined;
      const barrier = joinStep?.joinBarrierId
        ? getJoinBarrier(this.plan, joinStep.joinBarrierId)
        : undefined;

      for (const br of branchResults) {
        branchStates[br.branchId] = br.branchState;
      }

      if (barrier) {
        const progress: JoinProgress = {
          barrierId: barrier.barrierId,
          completedBranchIds: Object.freeze(
            branchResults.map((b) => b.branchId),
          ),
        };
        joinProgress[barrier.barrierId] = progress;

        if (isJoinBarrierSatisfied(barrier, progress)) {
          return {
            snapshot: cloneSnapshot(snapshot, {
              completedStepIds: [...completed, step.stepId],
              branchStates,
              joinProgress,
            }),
            nextStepIds: [barrier.mergeStepId],
            halted: false,
            status: "running",
          };
        }

        return {
          snapshot: cloneSnapshot(snapshot, {
            status: "suspended",
            suspendReason: `join:${barrier.barrierId}`,
            branchStates,
            joinProgress,
            activeStepIds: [step.stepId],
          }),
          nextStepIds: [],
          halted: false,
          status: "suspended",
        };
      }

      return {
        snapshot: cloneSnapshot(snapshot, {
          completedStepIds: [...completed, step.stepId],
          branchStates,
        }),
        nextStepIds: [...step.successors],
        halted: false,
        status: "running",
      };
    }

    if (step.kind === "join" && step.joinBarrierId) {
      const barrier = getJoinBarrier(this.plan, step.joinBarrierId);
      if (!barrier) {
        return {
          snapshot: cloneSnapshot(snapshot, {
            status: "failed",
            lastError: `Unknown barrier: ${step.joinBarrierId}`,
          }),
          nextStepIds: [],
          halted: false,
          status: "failed",
        };
      }
      const progress = snapshot.joinProgress[barrier.barrierId];
      if (!isJoinBarrierSatisfied(barrier, progress)) {
        return {
          snapshot: cloneSnapshot(snapshot, {
            status: "suspended",
            suspendReason: `join:${barrier.barrierId}`,
            activeStepIds: [step.stepId],
          }),
          nextStepIds: [],
          halted: false,
          status: "suspended",
        };
      }
      return {
        snapshot: cloneSnapshot(snapshot, {
          completedStepIds: [...completed, step.stepId],
        }),
        nextStepIds: step.successors.length ? [...step.successors] : [],
        halted: false,
        status: "running",
      };
    }

    if (step.kind === "action" && step.capabilityId) {
      const result = await runWithRetry(
        () =>
          executeCapability(step.capabilityId!, {
            runtime,
            transport,
            payload: step.payload,
            stepId: step.stepId,
            nodeId: step.sourceNodeId,
          }),
        step.retry,
      );

      if (!result.ok) {
        if (step.compensateStepId) {
          const comp = getExecutionStep(this.plan, step.compensateStepId);
          if (comp?.capabilityId) {
            await executeCapability(comp.capabilityId, {
              runtime,
              transport,
              payload: comp.payload,
              stepId: comp.stepId,
            });
          }
          return {
            snapshot: cloneSnapshot(snapshot, {
              status: "compensating",
              failedStepIds: [...snapshot.failedStepIds, step.stepId],
              lastError: result.error,
              compensationStepId: step.compensateStepId,
              activeStepIds: [],
            }),
            nextStepIds: [],
            halted: false,
            status: "compensating",
          };
        }
        return {
          snapshot: cloneSnapshot(snapshot, {
            status: "failed",
            failedStepIds: [...snapshot.failedStepIds, step.stepId],
            lastError: result.error,
            activeStepIds: [],
          }),
          nextStepIds: [],
          halted: false,
          status: "failed",
        };
      }

      return {
        snapshot: cloneSnapshot(snapshot, {
          completedStepIds: [...completed, step.stepId],
          variables: { ...runtime.vars },
        }),
        nextStepIds: [...step.successors],
        halted: Boolean(result.halt),
        status: "running",
      };
    }

    return {
      snapshot: cloneSnapshot(snapshot, {
        completedStepIds: [...completed, step.stepId],
      }),
      nextStepIds: [...step.successors],
      halted: false,
      status: "running",
    };
  }

  private async runBranch(
    branchId: string,
    entryStepId: string,
    snapshot: ExecutionStateSnapshot,
    runtime: BotRuntimeContext,
    transport: TransportAdapter,
  ): Promise<{ branchId: string; branchState: import("./executionState.js").BranchRuntimeState }> {
    const completed: string[] = [];
    let current = entryStepId;
    let status: import("./executionIr.js").ExecutionStatus = "running";
    let error: string | undefined;
    const maxBranchSteps = 500;

    for (let i = 0; i < maxBranchSteps && current; i += 1) {
      const step = getExecutionStep(this.plan, current);
      if (!step) break;
      const outcome = await this.executeStep(step, snapshot, runtime, transport);
      completed.push(step.stepId);
      if (outcome.status === "failed") {
        status = "failed";
        error = outcome.snapshot.lastError;
        break;
      }
      if (!outcome.nextStepIds.length) {
        status = "completed";
        break;
      }
      current = outcome.nextStepIds[0];
    }

    return {
      branchId,
      branchState: Object.freeze({
        branchId,
        status,
        completedStepIds: Object.freeze(completed),
        ...(error ? { error } : {}),
      }),
    };
  }
}

export function createExecutionScheduler(plan: ExecutionIrPlan): ExecutionScheduler {
  return new ExecutionScheduler(plan);
}
