/**
 * Event-sourced deterministic execution scheduler — fork/join, retry, compensation, replay recovery.
 */

import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { ExecutionContext } from "../executionContext.js";
import {
  bindNodeScope,
  bindRunScope,
  clearNodeScope,
  createExecutionContext,
} from "../executionContext.js";
import { assertGraphExecutionIrPlan } from "../legacyExecutionPolicy.mjs";
import type { TransportAdapter } from "../../transport/transportAdapter.js";
import { createTransport } from "../../transport/transportAdapter.js";
import { TELEGRAM_TRANSPORT_ID } from "../../transport/telegramAdapter.js";
import {
  ensureCapabilityExecutorsRegistered,
  executeCapability,
  type CapabilityExecuteResult,
} from "../capabilityExecutors.js";
import { applyExecutionEffects, freezeEffects } from "./executionEffects.mjs";
import type { ExecutionIrPlan, ExecutionIrStep, RetryPolicy } from "./executionIr.js";
import { getExecutionStep, getJoinBarrier } from "./executionIr.js";
import {
  manifestBlockTypeFromStep,
  requireStepExecutionContract,
  resolveStepRetryPolicy,
} from "./executionContractEnforcement.js";
import {
  buildSideEffectIdempotencyKey,
  hasAppliedIdempotencyKey,
} from "./executionEvents.js";
import { ExecutionEventJournal } from "./executionEventJournal.js";
import {
  getDefaultExecutionEventStore,
  type ExecutionEventStore,
} from "./executionEventStore.js";
import { createExecutionHistory } from "./executionHistory.js";
import {
  isJoinBarrierSatisfied,
  type BranchRuntimeState,
  type ExecutionStateSnapshot,
  type JoinProgress,
} from "./executionState.js";
import {
  getDefaultExecutionStateStore,
  type ExecutionStateStore,
} from "./executionStateStore.js";
import { ExecutionError } from "./executionErrors.mjs";
import {
  buildTraceInputs,
  buildTraceOutputs,
  ExecutionTraceCollector,
  getDefaultExecutionTraceStore,
  type InMemoryExecutionTraceStore,
} from "./executionTrace.mjs";
import type { ExecutionTraceEvent, ExecutionTraceRecord } from "./executionTrace.js";

export interface SchedulerRunOptions {
  transport?: TransportAdapter;
  transportId?: string;
  /** Unified execution kernel — vars seeded from snapshot when omitted. */
  execution?: ExecutionContext;
  /** Projection cache (derived from events). */
  store?: ExecutionStateStore;
  /** Append-only event log (source of truth). */
  eventStore?: ExecutionEventStore;
  maxSteps?: number;
  /** Replay mode — no transport side effects. */
  replayOnly?: boolean;
  /** Persist structured debugger trace events (enabled by default when store or onTraceEvent set). */
  traceStore?: InMemoryExecutionTraceStore;
  onTraceEvent?: (event: ExecutionTraceEvent) => void;
  enableTrace?: boolean;
}

export interface SchedulerRunResult {
  executionId: string;
  status: ExecutionStateSnapshot["status"];
  snapshot: ExecutionStateSnapshot;
  stepsExecuted: number;
  halted: boolean;
  eventsAppended: number;
  trace?: ExecutionTraceRecord;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: string, policy?: RetryPolicy): boolean {
  if (!policy?.retryableErrors?.length) return true;
  return policy.retryableErrors.some((code) => error.includes(code));
}

function requireExecutionStep(
  plan: ExecutionIrPlan,
  stepId: string,
  executionPath: readonly string[],
): ExecutionIrStep {
  const step = getExecutionStep(plan, stepId);
  if (!step) {
    throw ExecutionError.missingStep(stepId, executionPath);
  }
  return step;
}

function assertDeterministicSuccessors(
  plan: ExecutionIrPlan,
  step: ExecutionIrStep,
  nextStepIds: readonly string[],
  executionPath: readonly string[],
): void {
  if (nextStepIds.length > 1) {
    throw ExecutionError.invalidTransition(
      step,
      `non-deterministic fan-out: ${nextStepIds.length} successors [${nextStepIds.join(", ")}]`,
      executionPath,
    );
  }
  for (const succ of nextStepIds) {
    if (!getExecutionStep(plan, succ)) {
      throw ExecutionError.missingSuccessor(step, succ, executionPath);
    }
  }
}

async function runWithRetry(
  fn: () => Promise<CapabilityExecuteResult>,
  policy?: RetryPolicy,
  onAttempt?: (attempt: number, result: CapabilityExecuteResult) => Promise<void>,
): Promise<{ result: CapabilityExecuteResult; attempts: number }> {
  const maxAttempts = policy?.maxAttempts ?? 1;
  const backoffMs = policy?.backoffMs ?? 0;
  let last: CapabilityExecuteResult = { ok: false, capabilityId: "", error: "no attempt" };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = await fn();
    if (onAttempt) await onAttempt(attempt, last);
    if (last.ok) return { result: last, attempts: attempt };
    if (attempt >= maxAttempts) break;
    if (!isRetryableError(last.error || "error", policy)) break;
    if (backoffMs > 0) await sleep(backoffMs * attempt);
  }
  return { result: last, attempts: maxAttempts };
}

export class ExecutionScheduler {
  readonly plan: ExecutionIrPlan;

  constructor(plan: ExecutionIrPlan) {
    this.plan = plan;
    ensureCapabilityExecutorsRegistered();
  }

  async start(options: SchedulerRunOptions = {}): Promise<SchedulerRunResult> {
    const executionId = randomUUID();
    const eventStore = options.eventStore ?? getDefaultExecutionEventStore();
    const store = options.store ?? getDefaultExecutionStateStore();
    const journal = new ExecutionEventJournal(executionId, this.plan.planId, eventStore);
    await journal.appendStarted(this.plan.entryStepId);
    if (journal.currentState) await store.save(journal.currentState);
    return this.run(executionId, { ...options, eventStore, store });
  }

  async resume(
    executionId: string,
    options: SchedulerRunOptions = {},
  ): Promise<SchedulerRunResult> {
    const eventStore = options.eventStore ?? getDefaultExecutionEventStore();
    const store = options.store ?? getDefaultExecutionStateStore();
    const journal = new ExecutionEventJournal(executionId, this.plan.planId, eventStore);
    const existing = await journal.recoverFromEvents();

    if (existing.planId !== this.plan.planId) {
      throw new Error(
        `Plan mismatch: state=${existing.planId} engine=${this.plan.planId}`,
      );
    }

    await journal.appendResumed([...existing.activeStepIds]);
    if (journal.currentState) await store.save(journal.currentState);
    return this.run(executionId, { ...options, eventStore, store });
  }

  /**
   * Recover state exclusively via event replay (event-based recovery).
   */
  async recover(executionId: string, options: SchedulerRunOptions = {}): Promise<ExecutionStateSnapshot> {
    const eventStore = options.eventStore ?? getDefaultExecutionEventStore();
    const history = createExecutionHistory(eventStore, options.store);
    return history.recoverState(executionId);
  }

  async run(
    executionId: string,
    options: SchedulerRunOptions = {},
  ): Promise<SchedulerRunResult> {
    const eventStore = options.eventStore ?? getDefaultExecutionEventStore();
    const store = options.store ?? getDefaultExecutionStateStore();
    const journal = new ExecutionEventJournal(executionId, this.plan.planId, eventStore);

    let snapshot = await journal.recoverFromEvents();
    const eventsBefore = await eventStore.count(executionId);

    const transport =
      options.transport
      ?? createTransport(options.transportId ?? TELEGRAM_TRANSPORT_ID);
    const execution: ExecutionContext = options.execution ?? createExecutionContext({
      traceId: executionId,
      vars: { ...snapshot.variables },
    });
    bindRunScope(execution, { transport, replayOnly: options.replayOnly === true });

    const traceEnabled =
      options.enableTrace !== false
      && (options.traceStore != null
        || options.onTraceEvent != null
        || options.enableTrace === true);
    const trace = traceEnabled
      ? new ExecutionTraceCollector({
          traceId: execution.traceId,
          executionId,
          store: options.traceStore ?? getDefaultExecutionTraceStore(),
          onEvent: options.onTraceEvent,
        })
      : null;

    const maxSteps = options.maxSteps ?? 10_000;
    let stepsExecuted = 0;
    let halted = false;
    const runPath: string[] = [];

    while (
      snapshot.status === "running" &&
      snapshot.activeStepIds.length > 0 &&
      stepsExecuted < maxSteps
    ) {
      const nextActive: string[] = [];

      for (const stepId of snapshot.activeStepIds) {
        const stepPath = [...runPath, stepId];
        const step = requireExecutionStep(this.plan, stepId, stepPath);

        execution.temp.__executionPath = stepPath;

        const outcome = await this.executeStepTraced(
          trace,
          step,
          snapshot,
          execution,
          journal,
          executionId,
          options.replayOnly === true,
          stepPath,
        );
        stepsExecuted += 1;
        snapshot = outcome.snapshot;

        if (outcome.halted) halted = true;

        if (outcome.status === "suspended") {
          await store.save(snapshot);
          const eventsAfter = await eventStore.count(executionId);
          return {
            executionId,
            status: snapshot.status,
            snapshot,
            stepsExecuted,
            halted,
            eventsAppended: eventsAfter - eventsBefore,
            trace: trace
              ? {
                  traceId: execution.traceId,
                  executionId,
                  events: trace.events,
                }
              : undefined,
          };
        }

        assertDeterministicSuccessors(
          this.plan,
          step,
          outcome.nextStepIds,
          stepPath,
        );
        if (trace) {
          for (const nextId of outcome.nextStepIds) {
            const nextStep = getExecutionStep(this.plan, nextId);
            if (nextStep) {
              await trace.edgeTraversal(step, nextStep, execution, {
                edgeKind: "flow",
              });
            }
          }
        }
        nextActive.push(...outcome.nextStepIds);
      }

      const uniqueActive = [...new Set(nextActive)];
      runPath.push(...snapshot.activeStepIds);
      if (snapshot.status === "running") {
        if (!uniqueActive.length) {
          await journal.append("execution.completed", {});
          snapshot = journal.currentState!;
        } else {
          await journal.append("step.scheduled", { stepIds: uniqueActive });
          snapshot = journal.currentState!;
        }
      }

      await store.save(snapshot);
    }

    if (
      snapshot.status === "running" &&
      snapshot.activeStepIds.length > 0 &&
      stepsExecuted >= maxSteps
    ) {
      throw ExecutionError.runStepLimitExceeded(executionId, runPath, maxSteps);
    }

    const eventsAfter = await eventStore.count(executionId);
    return {
      executionId,
      status: snapshot.status,
      snapshot,
      stepsExecuted,
      halted,
      eventsAppended: eventsAfter - eventsBefore,
      trace: trace
        ? {
            traceId: execution.traceId,
            executionId,
            events: trace.events,
          }
        : undefined,
    };
  }

  private async executeStepTraced(
    trace: ExecutionTraceCollector | null,
    step: ExecutionIrStep,
    snapshot: ExecutionStateSnapshot,
    execution: ExecutionContext,
    journal: ExecutionEventJournal,
    executionId: string,
    replayOnly: boolean,
    executionPath: readonly string[],
  ): Promise<{
    snapshot: ExecutionStateSnapshot;
    nextStepIds: string[];
    halted: boolean;
    status: ExecutionStateSnapshot["status"];
  }> {
    if (!trace) {
      return this.executeStep(
        step,
        snapshot,
        execution,
        journal,
        executionId,
        replayOnly,
        executionPath,
      );
    }

    const inputs = buildTraceInputs(step, execution);
    const t0 = performance.now();
    await trace.nodeStart(step, execution);
    try {
      const outcome = await this.executeStep(
        step,
        snapshot,
        execution,
        journal,
        executionId,
        replayOnly,
        executionPath,
        trace,
      );
      await trace.nodeComplete(
        step,
        execution,
        buildTraceOutputs(outcome, execution),
        performance.now() - t0,
      );
      for (const nextId of outcome.nextStepIds) {
        const nextStep = getExecutionStep(this.plan, nextId);
        if (nextStep) {
          await trace.edgeTraversal(step, nextStep, execution, { edgeKind: "flow" });
        }
      }
      return outcome;
    } catch (err) {
      await trace.nodeError(step, execution, err, inputs, performance.now() - t0);
      throw err;
    }
  }

  private async executeStep(
    step: ExecutionIrStep,
    snapshot: ExecutionStateSnapshot,
    execution: ExecutionContext,
    journal: ExecutionEventJournal,
    executionId: string,
    replayOnly: boolean,
    executionPath: readonly string[],
    trace: ExecutionTraceCollector | null = null,
  ): Promise<{
    snapshot: ExecutionStateSnapshot;
    nextStepIds: string[];
    halted: boolean;
    status: ExecutionStateSnapshot["status"];
  }> {
    const state = () => journal.currentState ?? snapshot;

    if (step.kind === "halt") {
      await journal.append("halt.reached", { stepId: step.stepId });
      return {
        snapshot: state(),
        nextStepIds: [],
        halted: true,
        status: "completed",
      };
    }

    if (step.kind === "fork") {
      if (!step.forkBranches?.length) {
        throw ExecutionError.invalidStep(
          step,
          "fork step has no branches",
          executionPath,
        );
      }
      await journal.append("fork.started", { forkStepId: step.stepId });

      if (trace) {
        for (const branch of step.forkBranches) {
          const entryStep = getExecutionStep(this.plan, branch.entryStepId);
          if (entryStep) {
            await trace.edgeTraversal(step, entryStep, execution, {
              edgeKind: branch.label ?? "branch",
              branchId: branch.branchId,
            });
          }
        }
      }

      const branchResults = await Promise.all(
        step.forkBranches.map((branch) =>
          this.runBranch(
            branch.branchId,
            branch.entryStepId,
            state(),
            execution,
            journal,
            executionId,
            replayOnly,
            executionPath,
            trace,
          ),
        ),
      );

      for (const br of branchResults) {
        await journal.append("fork.branch_completed", {
          branchId: br.branchId,
          branchState: br.branchState,
        });
      }

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

      if (barrier) {
        const progress: JoinProgress = {
          barrierId: barrier.barrierId,
          completedBranchIds: Object.freeze(
            branchResults.map((b) => b.branchId),
          ),
        };
        await journal.append("join.progress", { barrierId: barrier.barrierId, progress });

        if (isJoinBarrierSatisfied(barrier, progress)) {
          await journal.append("join.satisfied", {
            joinStepId: joinStep?.stepId,
            nextStepIds: [barrier.mergeStepId],
          });
          return {
            snapshot: state(),
            nextStepIds: [barrier.mergeStepId],
            halted: false,
            status: "running",
          };
        }

        await journal.append("execution.suspended", {
          reason: `join:${barrier.barrierId}`,
          activeStepIds: [step.stepId],
        });
        return {
          snapshot: state(),
          nextStepIds: [],
          halted: false,
          status: "suspended",
        };
      }

      const forkNext = [...step.successors];
      if (forkNext.length > 1) {
        throw ExecutionError.invalidTransition(
          step,
          `fork has ${forkNext.length} successors (expected ≤1)`,
          executionPath,
        );
      }
      return {
        snapshot: state(),
        nextStepIds: forkNext,
        halted: false,
        status: "running",
      };
    }

    if (step.kind === "join") {
      if (!step.joinBarrierId) {
        throw ExecutionError.invalidStep(
          step,
          "join step missing joinBarrierId",
          executionPath,
        );
      }
      const barrier = getJoinBarrier(this.plan, step.joinBarrierId);
      if (!barrier) {
        throw ExecutionError.invalidStep(
          step,
          `unknown join barrier ${step.joinBarrierId}`,
          executionPath,
        );
      }
      const progress = state().joinProgress[barrier.barrierId];
      if (!isJoinBarrierSatisfied(barrier, progress)) {
        await journal.append("execution.suspended", {
          reason: `join:${barrier.barrierId}`,
          activeStepIds: [step.stepId],
        });
        return {
          snapshot: state(),
          nextStepIds: [],
          halted: false,
          status: "suspended",
        };
      }
      const joinNext = step.successors.length ? [...step.successors] : [];
      if (joinNext.length > 1) {
        throw ExecutionError.invalidTransition(
          step,
          `join has ${joinNext.length} successors (expected ≤1)`,
          executionPath,
        );
      }
      await journal.append("join.satisfied", {
        joinStepId: step.stepId,
        nextStepIds: joinNext,
      });
      return {
        snapshot: state(),
        nextStepIds: joinNext,
        halted: false,
        status: "running",
      };
    }

    if (step.kind === "action") {
      if (!step.capabilityId) {
        throw ExecutionError.invalidStep(
          step,
          "action step missing capabilityId",
          executionPath,
        );
      }
      const contract = requireStepExecutionContract(step);
      const retryPolicy = resolveStepRetryPolicy(contract);
      const capabilityId = step.capabilityId;
      const blockType = manifestBlockTypeFromStep(step);
      let finalAttempt = 0;
      let finalResult: CapabilityExecuteResult = {
        ok: false,
        capabilityId,
        effects: freezeEffects([]),
        error: "no attempt",
      };

      const { result, attempts } = await runWithRetry(
        async () => {
          finalAttempt += 1;
          const idempotencyKey = buildSideEffectIdempotencyKey(
            executionId,
            step.stepId,
            capabilityId,
            finalAttempt,
          );

          if (hasAppliedIdempotencyKey(state().appliedIdempotencyKeys, idempotencyKey)) {
            return {
              ok: true,
              capabilityId,
              effects: freezeEffects([]),
              halt: false,
            };
          }

          if (replayOnly) {
            return { ok: true, capabilityId, effects: freezeEffects([]) };
          }

          bindNodeScope(execution, {
            payload: step.payload,
            stepId: step.stepId,
            nodeId: step.sourceNodeId,
            blockType,
          });
          try {
            const capResult = await executeCapability(capabilityId, execution);
            if (capResult.ok) {
              await applyExecutionEffects(execution, capResult.effects, { replayOnly });
            }
            if (trace) {
              execution.temp.__lastTraceEffects = capResult.effects;
            }
            return capResult;
          } finally {
            clearNodeScope(execution);
          }
        },
        retryPolicy,
        async (attempt, attemptResult) => {
          const idempotencyKey = buildSideEffectIdempotencyKey(
            executionId,
            step.stepId,
            capabilityId,
            attempt,
          );

          await journal.append("action.attempt", {
            stepId: step.stepId,
            capabilityId,
            attempt,
          });

          if (
            hasAppliedIdempotencyKey(state().appliedIdempotencyKeys, idempotencyKey)
          ) {
            return;
          }

          if (replayOnly && !attemptResult.ok) {
            return;
          }

          if (!attemptResult.ok && attempt < (step.retry?.maxAttempts ?? 1)) {
            return;
          }

          await journal.append(
            "action.side_effect_recorded",
            {
              stepId: step.stepId,
              capabilityId,
              attempt,
              ok: attemptResult.ok,
              error: attemptResult.error,
              halt: attemptResult.halt,
              nextStepIds: attemptResult.ok ? [...step.successors] : [],
              variables: { ...execution.vars },
              status: attemptResult.ok ? "running" : "failed",
              compensateStepId: step.compensateStepId,
            },
            { idempotencyKey },
          );
        },
      );

      finalResult = result;

      if (!finalResult.ok) {
        if (step.compensateStepId && !replayOnly) {
          const comp = getExecutionStep(this.plan, step.compensateStepId);
          if (!comp) {
            throw ExecutionError.missingSuccessor(
              step,
              step.compensateStepId,
              executionPath,
            );
          }
          await journal.append("compensation.triggered", {
            stepId: step.stepId,
            compensateStepId: step.compensateStepId,
            error: finalResult.error,
          });
          if (comp?.capabilityId) {
            const compKey = buildSideEffectIdempotencyKey(
              executionId,
              comp.stepId,
              comp.capabilityId,
              1,
            );
            if (!hasAppliedIdempotencyKey(state().appliedIdempotencyKeys, compKey)) {
              bindNodeScope(execution, {
                payload: comp.payload,
                stepId: comp.stepId,
              });
              try {
                const compResult = await executeCapability(comp.capabilityId, execution);
                if (compResult.ok) {
                  await applyExecutionEffects(execution, compResult.effects, { replayOnly });
                }
              } finally {
                clearNodeScope(execution);
              }
              await journal.append(
                "action.side_effect_recorded",
                {
                  stepId: comp.stepId,
                  capabilityId: comp.capabilityId,
                  attempt: 1,
                  ok: true,
                  nextStepIds: [],
                  variables: { ...execution.vars },
                },
                { idempotencyKey: compKey },
              );
            }
          }
          await journal.append("compensation.completed", {
            stepId: step.stepId,
          });
          return {
            snapshot: state(),
            nextStepIds: [],
            halted: false,
            status: "compensating",
          };
        }

        await journal.append("step.failed", {
          stepId: step.stepId,
          error: finalResult.error,
          status: "failed",
        });

        throw ExecutionError.stepFailed(
          step,
          finalResult.error || "capability execution failed",
          executionPath,
        );
      }

      return {
        snapshot: state(),
        nextStepIds: [...step.successors],
        halted: Boolean(finalResult.halt),
        status: "running",
      };
    }

    throw ExecutionError.invalidStep(
      step,
      `unhandled step kind ${step.kind}`,
      executionPath,
    );
  }

  private async runBranch(
    branchId: string,
    entryStepId: string,
    snapshot: ExecutionStateSnapshot,
    execution: ExecutionContext,
    journal: ExecutionEventJournal,
    executionId: string,
    replayOnly: boolean,
    executionPath: readonly string[],
    trace: ExecutionTraceCollector | null = null,
  ): Promise<{ branchId: string; branchState: BranchRuntimeState }> {
    const completed: string[] = [];
    let current = entryStepId;
    const branchPath = [...executionPath, branchId];
    const maxBranchSteps = 500;

    for (let i = 0; i < maxBranchSteps && current; i += 1) {
      const stepPath = [...branchPath, current];
      const step = requireExecutionStep(this.plan, current, stepPath);
      const outcome = await this.executeStepTraced(
        trace,
        step,
        journal.currentState ?? snapshot,
        execution,
        journal,
        executionId,
        replayOnly,
        stepPath,
      );
      completed.push(step.stepId);

      if (outcome.status === "failed") {
        throw ExecutionError.stepFailed(
          step,
          outcome.snapshot.lastError || "branch step failed",
          stepPath,
        );
      }

      if (!outcome.nextStepIds.length) {
        return {
          branchId,
          branchState: Object.freeze({
            branchId,
            status: "completed",
            completedStepIds: Object.freeze(completed),
          }),
        };
      }

      if (outcome.nextStepIds.length > 1) {
        throw ExecutionError.invalidTransition(
          step,
          `branch ${branchId} has ${outcome.nextStepIds.length} successors`,
          stepPath,
        );
      }

      current = outcome.nextStepIds[0];
    }

    throw ExecutionError.branchStepLimitExceeded(branchId, branchPath, maxBranchSteps);
  }
}

export function createExecutionScheduler(plan: ExecutionIrPlan): ExecutionScheduler {
  assertGraphExecutionIrPlan(plan, "createExecutionScheduler");
  return new ExecutionScheduler(plan);
}
