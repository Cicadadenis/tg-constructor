/**
 * Abstracted persistence for ExecutionContext — no direct global store access.
 */

export interface ExecutionDbAccess {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

export class InMemoryExecutionDb implements ExecutionDbAccess {
  private readonly data = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.data.get(String(key));
  }

  async set(key: string, value: unknown): Promise<void> {
    this.data.set(String(key), value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(String(key));
  }

  async has(key: string): Promise<boolean> {
    return this.data.has(String(key));
  }
}

let defaultDb: ExecutionDbAccess | null = null;

export function getDefaultExecutionDb(): ExecutionDbAccess {
  if (!defaultDb) {
    defaultDb = new InMemoryExecutionDb();
  }
  return defaultDb;
}

export function setDefaultExecutionDb(db: ExecutionDbAccess): void {
  defaultDb = db;
}
