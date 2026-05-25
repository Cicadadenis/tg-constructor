/**
 * Deterministic replay engine — rebuild execution state from event log.
 */

import type { ExecutionEvent } from "./executionEvents.js";
import { foldExecutionEvents } from "./executionStateReducer.js";
import type { ExecutionStateSnapshot } from "./executionState.js";

export interface ReplayOptions {
  /** Replay events up to and including this sequence (time-travel). */
  untilSequence?: number;
  /** Validate monotonic sequences (default true). */
  strict?: boolean;
}

export interface ReplayResult {
  readonly state: ExecutionStateSnapshot;
  readonly eventsReplayed: number;
  readonly lastSequence: number;
}

function validateEventLog(events: readonly ExecutionEvent[], strict: boolean): void {
  if (!strict || events.length === 0) return;
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].sequence !== i + 1) {
      throw new Error(
        `Event log gap at index ${i}: expected sequence ${i + 1}, got ${sorted[i].sequence}`,
      );
    }
  }
}

export function replayExecutionEvents(
  events: readonly ExecutionEvent[],
  options: ReplayOptions = {},
): ReplayResult {
  const strict = options.strict !== false;
  validateEventLog(events, strict);

  const filtered = options.untilSequence != null
    ? events.filter((e) => e.sequence <= options.untilSequence!)
    : events;

  const state = foldExecutionEvents(filtered, {
    untilSequence: options.untilSequence,
  });

  const lastSequence = filtered.length
    ? Math.max(...filtered.map((e) => e.sequence))
    : 0;

  return Object.freeze({
    state,
    eventsReplayed: filtered.length,
    lastSequence,
  });
}

export function replayToCheckpoint(
  events: readonly ExecutionEvent[],
  checkpoint: number,
): ReplayResult {
  return replayExecutionEvents(events, { untilSequence: checkpoint });
}

export function diffStates(
  before: ExecutionStateSnapshot,
  after: ExecutionStateSnapshot,
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ] as (keyof ExecutionStateSnapshot)[]);

  for (const key of keys) {
    const b = before[key as keyof ExecutionStateSnapshot];
    const a = after[key as keyof ExecutionStateSnapshot];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes[String(key)] = { before: b, after: a };
    }
  }
  return changes;
}
