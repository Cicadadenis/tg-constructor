/**
 * Pure state reducer — deterministic fold over execution event log.
 */

import type { ExecutionEvent } from "./executionEvents.js";
import {
  cloneSnapshot,
  createInitialExecutionState,
  isJoinBarrierSatisfied,
  type BranchRuntimeState,
  type ExecutionStateSnapshot,
  type JoinProgress,
} from "./executionState.js";
import type { ExecutionStatus } from "./executionIr.js";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function withEventMeta(
  snapshot: ExecutionStateSnapshot,
  event: ExecutionEvent,
  patch: Parameters<typeof cloneSnapshot>[1],
): ExecutionStateSnapshot {
  return cloneSnapshot(snapshot, {
    ...patch,
    lastEventSequence: event.sequence,
    checkpoint: event.sequence,
  });
}

export function reduceExecutionState(
  state: ExecutionStateSnapshot | null,
  event: ExecutionEvent,
): ExecutionStateSnapshot {
  switch (event.type) {
    case "execution.started": {
      const entryStepId = asString(event.payload.entryStepId);
      const base = createInitialExecutionState(
        event.executionId,
        event.planId,
        entryStepId,
      );
      return withEventMeta(base, event, {
        status: "running",
        activeStepIds: entryStepId ? [entryStepId] : [],
        lastEventSequence: event.sequence,
        checkpoint: event.sequence,
      });
    }

    case "execution.resumed":
      if (!state) return reduceExecutionState(null, {
        ...event,
        type: "execution.started",
        payload: { entryStepId: asString(event.payload.entryStepId) },
      });
      return withEventMeta(state, event, {
        status: "running",
        suspendReason: undefined,
        activeStepIds: asStringArray(event.payload.activeStepIds).length
          ? asStringArray(event.payload.activeStepIds)
          : [...state.activeStepIds],
      });

    case "execution.suspended":
      if (!state) throw new Error("execution.suspended requires prior state");
      return withEventMeta(state, event, {
        status: "suspended",
        suspendReason: asString(event.payload.reason, "suspended"),
        activeStepIds: asStringArray(event.payload.activeStepIds).length
          ? asStringArray(event.payload.activeStepIds)
          : [...state.activeStepIds],
      });

    case "execution.completed":
      if (!state) throw new Error("execution.completed requires prior state");
      return withEventMeta(state, event, {
        status: "completed",
        activeStepIds: [],
      });

    case "execution.failed":
      if (!state) throw new Error("execution.failed requires prior state");
      return withEventMeta(state, event, {
        status: "failed",
        lastError: asString(event.payload.error),
        activeStepIds: [],
      });

    case "step.scheduled":
      if (!state) throw new Error("step.scheduled requires prior state");
      return withEventMeta(state, event, {
        activeStepIds: asStringArray(event.payload.stepIds).length
          ? asStringArray(event.payload.stepIds)
          : [...state.activeStepIds],
      });

    case "step.completed": {
      if (!state) throw new Error("step.completed requires prior state");
      const stepId = asString(event.payload.stepId);
      const completed = new Set(state.completedStepIds);
      if (stepId) completed.add(stepId);
      const nextActive = asStringArray(event.payload.nextStepIds);
      return withEventMeta(state, event, {
        completedStepIds: [...completed],
        activeStepIds: nextActive.length ? nextActive : [...state.activeStepIds],
      });
    }

    case "step.failed": {
      if (!state) throw new Error("step.failed requires prior state");
      const stepId = asString(event.payload.stepId);
      const failed = new Set(state.failedStepIds);
      if (stepId) failed.add(stepId);
      return withEventMeta(state, event, {
        status: (event.payload.status as ExecutionStatus) || "failed",
        failedStepIds: [...failed],
        lastError: asString(event.payload.error),
        activeStepIds: [],
      });
    }

    case "fork.started":
      if (!state) throw new Error("fork.started requires prior state");
      return withEventMeta(state, event, {
        completedStepIds: event.payload.forkStepId
          ? [...state.completedStepIds, asString(event.payload.forkStepId)]
          : [...state.completedStepIds],
      });

    case "fork.branch_completed": {
      if (!state) throw new Error("fork.branch_completed requires prior state");
      const branchId = asString(event.payload.branchId);
      const branchState = event.payload.branchState as BranchRuntimeState | undefined;
      const branchStates = { ...state.branchStates };
      if (branchId && branchState) {
        branchStates[branchId] = Object.freeze({
          ...branchState,
          completedStepIds: Object.freeze([...branchState.completedStepIds]),
        });
      }
      return withEventMeta(state, event, { branchStates });
    }

    case "join.progress": {
      if (!state) throw new Error("join.progress requires prior state");
      const barrierId = asString(event.payload.barrierId);
      const progress = event.payload.progress as JoinProgress | undefined;
      const joinProgress = { ...state.joinProgress };
      if (barrierId && progress) {
        joinProgress[barrierId] = Object.freeze({
          barrierId: progress.barrierId,
          completedBranchIds: Object.freeze([...progress.completedBranchIds]),
        });
      }
      return withEventMeta(state, event, { joinProgress });
    }

    case "join.satisfied":
      if (!state) throw new Error("join.satisfied requires prior state");
      return withEventMeta(state, event, {
        completedStepIds: event.payload.joinStepId
          ? [...state.completedStepIds, asString(event.payload.joinStepId)]
          : [...state.completedStepIds],
        activeStepIds: asStringArray(event.payload.nextStepIds),
      });

    case "action.attempt":
      return state ?? reduceExecutionState(null, {
        ...event,
        type: "execution.started",
        payload: { entryStepId: asString(event.payload.entryStepId) },
      });

    case "action.side_effect_recorded": {
      if (!state) throw new Error("action.side_effect_recorded requires prior state");
      const idempotencyKey = event.idempotencyKey || asString(event.payload.idempotencyKey);
      const applied = new Set(state.appliedIdempotencyKeys);
      if (idempotencyKey) applied.add(idempotencyKey);

      const stepId = asString(event.payload.stepId);
      const ok = event.payload.ok === true;
      const completed = new Set(state.completedStepIds);
      const failed = new Set(state.failedStepIds);
      const nextStepIds = asStringArray(event.payload.nextStepIds);

      if (ok && stepId) completed.add(stepId);

      if (!ok) {
        if (stepId) failed.add(stepId);
        const status = asString(event.payload.status, "failed") as ExecutionStatus;
        return withEventMeta(state, event, {
          status,
          failedStepIds: [...failed],
          appliedIdempotencyKeys: [...applied],
          lastError: asString(event.payload.error),
          compensationStepId: asString(event.payload.compensateStepId) || state.compensationStepId,
          activeStepIds: [],
          completedStepIds: [...completed],
        });
      }

      const variables = asRecord(event.payload.variables);
      return withEventMeta(state, event, {
        status: "running",
        completedStepIds: [...completed],
        appliedIdempotencyKeys: [...applied],
        activeStepIds: nextStepIds,
        variables: Object.keys(variables).length
          ? { ...state.variables, ...variables }
          : state.variables,
      });
    }

    case "action.failed":
      return reduceExecutionState(state, {
        ...event,
        type: "action.side_effect_recorded",
        payload: { ...event.payload, ok: false },
      });

    case "compensation.triggered":
      if (!state) throw new Error("compensation.triggered requires prior state");
      return withEventMeta(state, event, {
        status: "compensating",
        compensationStepId: asString(event.payload.compensateStepId),
        lastError: asString(event.payload.error),
        activeStepIds: [],
      });

    case "compensation.completed":
      if (!state) throw new Error("compensation.completed requires prior state");
      return withEventMeta(state, event, {
        status: "failed",
        activeStepIds: [],
      });

    case "variables.updated":
      if (!state) throw new Error("variables.updated requires prior state");
      return withEventMeta(state, event, {
        variables: { ...state.variables, ...asRecord(event.payload.variables) },
      });

    case "halt.reached":
      if (!state) throw new Error("halt.reached requires prior state");
      return withEventMeta(state, event, {
        status: "completed",
        activeStepIds: [],
        completedStepIds: event.payload.stepId
          ? [...state.completedStepIds, asString(event.payload.stepId)]
          : [...state.completedStepIds],
      });

    default:
      return state ?? createInitialExecutionState(
        event.executionId,
        event.planId,
        asString(event.payload.entryStepId),
      );
  }
}

export function foldExecutionEvents(
  events: readonly ExecutionEvent[],
  options: { untilSequence?: number } = {},
): ExecutionStateSnapshot {
  const maxSeq = options.untilSequence ?? Number.POSITIVE_INFINITY;
  let state: ExecutionStateSnapshot | null = null;
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  for (const event of ordered) {
    if (event.sequence > maxSeq) break;
    state = reduceExecutionState(state, event);
  }
  if (!state) {
    throw new Error("Cannot fold empty event log");
  }
  return state;
}

export function isJoinReadyFromState(
  barrier: { requiredBranchIds: readonly string[] },
  state: ExecutionStateSnapshot,
  barrierId: string,
): boolean {
  return isJoinBarrierSatisfied(barrier, state.joinProgress[barrierId]);
}
