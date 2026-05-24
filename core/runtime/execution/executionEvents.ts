/**
 * Append-only execution event log (event-sourced runtime).
 */

import { createHash } from "node:crypto";

export const EXECUTION_EVENT_VERSION = "1.0";

export type ExecutionEventType =
  | "execution.started"
  | "execution.resumed"
  | "execution.suspended"
  | "execution.completed"
  | "execution.failed"
  | "step.scheduled"
  | "step.completed"
  | "step.failed"
  | "fork.started"
  | "fork.branch_completed"
  | "join.progress"
  | "join.satisfied"
  | "action.attempt"
  | "action.side_effect_recorded"
  | "action.failed"
  | "compensation.triggered"
  | "compensation.completed"
  | "variables.updated"
  | "halt.reached";

export interface ExecutionEvent {
  readonly eventVersion: string;
  readonly sequence: number;
  readonly executionId: string;
  readonly planId: string;
  readonly type: ExecutionEventType;
  /** Wall-clock metadata for operators; reducer ignores for transitions. */
  readonly timestamp: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey?: string;
}

export type ExecutionEventInput = Omit<ExecutionEvent, "sequence" | "eventVersion" | "timestamp"> & {
  sequence?: number;
  eventVersion?: string;
  timestamp?: string;
};

export function freezeExecutionEvent(event: ExecutionEvent): ExecutionEvent {
  return Object.freeze({
    ...event,
    payload: Object.freeze({ ...event.payload }),
  });
}

export function buildSideEffectIdempotencyKey(
  executionId: string,
  stepId: string,
  capabilityId: string,
  attempt: number,
): string {
  const raw = `${executionId}|${stepId}|${capabilityId}|${attempt}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function hasAppliedIdempotencyKey(
  appliedKeys: readonly string[] | ReadonlySet<string>,
  key: string,
): boolean {
  if (appliedKeys instanceof Set) return appliedKeys.has(key);
  return appliedKeys.includes(key);
}
