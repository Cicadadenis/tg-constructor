import type { ExecutionGraph } from "./executionContract";
import {
  DEFAULT_EXECUTION_POLICY,
  resolveExecutionPolicy,
  type ExecutionPolicy,
} from "./executionPolicy";
import { resolveExecutionGraphMigration } from "./migrateExecutionGraph";
import { freezeMigrationRegistry } from "./migrationLock";
import {
  ExecutionGraphValidationError,
  validateExecutionGraphCore,
  type ExecutionGraphValidationResult,
} from "./validateExecutionGraphCore";
import { CURRENT_VERSION, isDevEnvironment } from "./version";

export {
  DEFAULT_EXECUTION_POLICY,
  resolveExecutionPolicy,
  type ExecutionPolicy,
  type MigrationValidateMode,
} from "./executionPolicy";

export {
  ExecutionGraphMigrationError,
  executeMigrationChain,
  getMigrationPath,
  MigrationChainError,
  registerMigration,
  resetMigrationRegistry,
  type MigrationChainErrorTrace,
  type MigrationPathStep,
  type MigrationTransform,
  type MigrationTransformContext,
} from "./migrationRegistry";

export {
  freezeMigrationRegistry,
  isMigrationRegistryFrozen,
  MigrationRegistryFrozenError,
} from "./migrationLock";

export {
  ExecutionGraphValidationError,
  type ExecutionGraphValidationCode,
  type ExecutionGraphValidationResult,
} from "./validateExecutionGraphCore";

export interface PreparedExecutionGraphResult extends ExecutionGraphValidationResult {
  policy: ExecutionPolicy;
  migration: {
    migratedFrom: string;
    migratedTo: string;
    stepsApplied: string[];
  };
}

/**
 * Single deterministic ExecutionGraph pipeline entry point.
 * migrate → validate (validateExecutionGraphCore runs only after migration).
 */
export function prepareExecutionGraph(
  graph: ExecutionGraph,
  targetVersion: string = CURRENT_VERSION,
  policy: ExecutionPolicy = DEFAULT_EXECUTION_POLICY,
): PreparedExecutionGraphResult {
  const resolvedPolicy = resolveExecutionPolicy(policy);
  const migrated = resolveExecutionGraphMigration(
    graph,
    targetVersion,
    resolvedPolicy,
  );
  const validated = validateExecutionGraphCore(
    migrated.execution,
    resolvedPolicy,
  );

  const result = {
    ...validated,
    policy: resolvedPolicy,
    migration: {
      migratedFrom: migrated.migratedFrom,
      migratedTo: migrated.migratedTo,
      stepsApplied: migrated.stepsApplied,
    },
  };

  if (!isDevEnvironment()) {
    freezeMigrationRegistry();
  }

  return result;
}

/** Marker type: graph that went through prepareExecutionGraph. */
export type PreparedExecutionGraph = ExecutionGraph;

export function assertPreparedExecutionGraph(
  graph: ExecutionGraph,
): asserts graph is PreparedExecutionGraph {
  if (!graph?.version) {
    throw new Error("Expected prepared ExecutionGraph with version");
  }
}
