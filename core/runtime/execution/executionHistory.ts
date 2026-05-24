/**
 * Execution history persistence + time-travel debugging API.
 */

import type { ExecutionEvent } from "./executionEvents.js";
import type { ExecutionEventStore } from "./executionEventStore.js";
import { getDefaultExecutionEventStore } from "./executionEventStore.js";
import {
  diffStates,
  replayExecutionEvents,
  replayToCheckpoint,
  type ReplayResult,
} from "./executionReplayEngine.js";
import type { ExecutionStateSnapshot } from "./executionState.js";
import type { ExecutionStateStore } from "./executionStateStore.js";
import { getDefaultExecutionStateStore } from "./executionStateStore.js";

export interface TimelineEntry {
  readonly sequence: number;
  readonly type: string;
  readonly status: ExecutionStateSnapshot["status"];
  readonly activeStepIds: readonly string[];
  readonly timestamp: string;
}

export interface TimeTravelDebugSession {
  readonly executionId: string;
  readonly events: readonly ExecutionEvent[];
  stateAt(sequence: number): ReplayResult;
  timeline(): Promise<TimelineEntry[]>;
  diff(fromSequence: number, toSequence: number): Record<string, { before: unknown; after: unknown }>;
}

export class ExecutionHistory {
  constructor(
    private readonly eventStore: ExecutionEventStore = getDefaultExecutionEventStore(),
    private readonly projectionStore: ExecutionStateStore = getDefaultExecutionStateStore(),
  ) {}

  async loadEvents(executionId: string): Promise<readonly ExecutionEvent[]> {
    return this.eventStore.load(executionId);
  }

  async recoverState(executionId: string): Promise<ExecutionStateSnapshot> {
    const events = await this.eventStore.load(executionId);
    if (!events.length) {
      const cached = await this.projectionStore.load(executionId);
      if (cached) return cached;
      throw new Error(`No events or projection for execution: ${executionId}`);
    }
    return replayExecutionEvents(events).state;
  }

  async persistProjection(snapshot: ExecutionStateSnapshot): Promise<void> {
    await this.projectionStore.save(snapshot);
  }

  async stateAt(executionId: string, sequence: number): Promise<ExecutionStateSnapshot> {
    const events = await this.eventStore.load(executionId);
    return replayToCheckpoint(events, sequence).state;
  }

  async createDebugSession(executionId: string): Promise<TimeTravelDebugSession> {
    const events = await this.eventStore.load(executionId);
    return {
      executionId,
      events,
      stateAt: (sequence: number) => replayToCheckpoint(events, sequence),
      timeline: async () => buildTimeline(events),
      diff: (fromSequence: number, toSequence: number) => {
        const before = replayToCheckpoint(events, fromSequence).state;
        const after = replayToCheckpoint(events, toSequence).state;
        return diffStates(before, after);
      },
    };
  }
}

export async function buildTimeline(
  events: readonly ExecutionEvent[],
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const slice = events.slice(0, i + 1);
    const { state } = replayExecutionEvents(slice, { strict: false });
    const event = events[i];
    entries.push(Object.freeze({
      sequence: event.sequence,
      type: event.type,
      status: state.status,
      activeStepIds: Object.freeze([...state.activeStepIds]),
      timestamp: event.timestamp,
    }));
  }
  return Object.freeze(entries);
}

export function createExecutionHistory(
  eventStore?: ExecutionEventStore,
  projectionStore?: ExecutionStateStore,
): ExecutionHistory {
  return new ExecutionHistory(eventStore, projectionStore);
}
