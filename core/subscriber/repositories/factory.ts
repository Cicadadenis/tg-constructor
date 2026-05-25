import type { ExecutionDbAccess } from "../../runtime/executionDb.js";
import { getDefaultExecutionDb } from "../../runtime/executionDb.js";
import type { SubscriberRepositories } from "./interfaces.js";
import { createInMemorySubscriberRepositories } from "./inMemoryRepositories.js";
import { createExecutionDbSubscriberRepositories } from "./executionDbRepositories.js";

export type SubscriberPersistenceMode = "memory" | "executionDb";

export interface CreateSubscriberRepositoriesOptions {
  mode?: SubscriberPersistenceMode;
  /** Required when mode is executionDb; defaults to global execution db. */
  db?: ExecutionDbAccess;
}

/**
 * Factory for subscriber persistence — swap backends without touching services.
 */
export function createSubscriberRepositories(
  options: CreateSubscriberRepositoriesOptions = {},
): SubscriberRepositories {
  const mode = options.mode ?? "memory";
  if (mode === "executionDb") {
    return createExecutionDbSubscriberRepositories(options.db ?? getDefaultExecutionDb());
  }
  return createInMemorySubscriberRepositories();
}
