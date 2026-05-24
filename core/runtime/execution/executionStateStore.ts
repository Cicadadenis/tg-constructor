/**
 * In-memory persistent execution state store (production interface; swap for DB).
 */

import type { ExecutionStateSnapshot } from "./executionState.js";

export interface ExecutionStateStore {
  save(snapshot: ExecutionStateSnapshot): Promise<void>;
  load(executionId: string): Promise<ExecutionStateSnapshot | null>;
  delete(executionId: string): Promise<boolean>;
  list(): Promise<string[]>;
}

export class InMemoryExecutionStateStore implements ExecutionStateStore {
  private readonly data = new Map<string, ExecutionStateSnapshot>();

  async save(snapshot: ExecutionStateSnapshot): Promise<void> {
    this.data.set(snapshot.executionId, snapshot);
  }

  async load(executionId: string): Promise<ExecutionStateSnapshot | null> {
    return this.data.get(executionId) ?? null;
  }

  async delete(executionId: string): Promise<boolean> {
    return this.data.delete(executionId);
  }

  async list(): Promise<string[]> {
    return [...this.data.keys()].sort();
  }

  clear(): void {
    this.data.clear();
  }
}

let defaultStore: InMemoryExecutionStateStore | null = null;

export function getDefaultExecutionStateStore(): InMemoryExecutionStateStore {
  if (!defaultStore) defaultStore = new InMemoryExecutionStateStore();
  return defaultStore;
}
