/**
 * Append-only execution event persistence (history log).
 */

import {
  EXECUTION_EVENT_VERSION,
  freezeExecutionEvent,
  type ExecutionEvent,
  type ExecutionEventInput,
  type ExecutionEventType,
} from "./executionEvents.js";

export interface ExecutionEventStore {
  append(executionId: string, event: ExecutionEventInput): Promise<ExecutionEvent>;
  appendMany(executionId: string, events: readonly ExecutionEventInput[]): Promise<ExecutionEvent[]>;
  load(executionId: string): Promise<readonly ExecutionEvent[]>;
  loadRange(
    executionId: string,
    fromSequence: number,
    toSequence?: number,
  ): Promise<readonly ExecutionEvent[]>;
  count(executionId: string): Promise<number>;
  delete(executionId: string): Promise<boolean>;
  listExecutionIds(): Promise<string[]>;
}

export class InMemoryExecutionEventStore implements ExecutionEventStore {
  private readonly logs = new Map<string, ExecutionEvent[]>();

  async append(executionId: string, event: ExecutionEventInput): Promise<ExecutionEvent> {
    const log = this.logs.get(executionId) ?? [];
    const sequence = log.length + 1;
    const stored = freezeExecutionEvent({
      eventVersion: event.eventVersion ?? EXECUTION_EVENT_VERSION,
      sequence,
      executionId,
      planId: event.planId,
      type: event.type,
      timestamp: event.timestamp ?? new Date().toISOString(),
      payload: event.payload,
      ...(event.idempotencyKey ? { idempotencyKey: event.idempotencyKey } : {}),
    });
    log.push(stored);
    this.logs.set(executionId, log);
    return stored;
  }

  async appendMany(
    executionId: string,
    events: readonly ExecutionEventInput[],
  ): Promise<ExecutionEvent[]> {
    const out: ExecutionEvent[] = [];
    for (const event of events) {
      out.push(await this.append(executionId, event));
    }
    return out;
  }

  async load(executionId: string): Promise<readonly ExecutionEvent[]> {
    return Object.freeze([...(this.logs.get(executionId) ?? [])]);
  }

  async loadRange(
    executionId: string,
    fromSequence: number,
    toSequence?: number,
  ): Promise<readonly ExecutionEvent[]> {
    const log = this.logs.get(executionId) ?? [];
    const max = toSequence ?? Number.POSITIVE_INFINITY;
    return Object.freeze(
      log.filter((e) => e.sequence >= fromSequence && e.sequence <= max),
    );
  }

  async count(executionId: string): Promise<number> {
    return (this.logs.get(executionId) ?? []).length;
  }

  async delete(executionId: string): Promise<boolean> {
    return this.logs.delete(executionId);
  }

  async listExecutionIds(): Promise<string[]> {
    return [...this.logs.keys()].sort();
  }

  clear(): void {
    this.logs.clear();
  }
}

let defaultEventStore: InMemoryExecutionEventStore | null = null;

export function getDefaultExecutionEventStore(): InMemoryExecutionEventStore {
  if (!defaultEventStore) defaultEventStore = new InMemoryExecutionEventStore();
  return defaultEventStore;
}

export function buildEventInput(
  executionId: string,
  planId: string,
  type: ExecutionEventType,
  payload: Record<string, unknown>,
  extras: { idempotencyKey?: string } = {},
): ExecutionEventInput {
  return {
    executionId,
    planId,
    type,
    payload,
    ...extras,
  };
}
