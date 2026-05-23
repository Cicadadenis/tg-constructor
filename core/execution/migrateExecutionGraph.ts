import type { ExecutionGraph } from "./executionContract";
import type { ExecutionPolicy } from "./executionPolicy";
import { CURRENT_VERSION } from "./version";
import {
  cloneExecutionGraph,
  compareMigrationVersions,
  executeMigrationChain,
  ExecutionGraphMigrationError,
  getMigrationPath,
  normalizeMigrationVersion,
} from "./migrationRegistry";

export type {
  MigrationPathStep,
  MigrationTransform,
  MigrationTransformContext,
  MigrationValidateMode,
} from "./migrationRegistry";

export {
  ExecutionGraphMigrationError,
  executeMigrationChain,
  getMigrationPath,
  listRegisteredMigrations,
  MigrationChainError,
  registerMigration,
  resetMigrationRegistry,
  unregisterMigration,
} from "./migrationRegistry";

export interface MigrationResult {
  execution: ExecutionGraph;
  migratedFrom: string;
  migratedTo: string;
  stepsApplied: string[];
}

/**
 * @internal Called only from prepareExecutionGraph.
 * Migrate ExecutionGraph forward via registry-based migration chain.
 */
export function migrateExecutionGraph(
  graph: ExecutionGraph,
  targetVersion: string = CURRENT_VERSION,
  policy: ExecutionPolicy,
): MigrationResult {
  const migratedFrom = normalizeMigrationVersion(graph.version);
  const migratedTo = normalizeMigrationVersion(targetVersion);

  if (compareMigrationVersions(migratedFrom, migratedTo) === 0) {
    return {
      execution: cloneExecutionGraph(graph, migratedTo),
      migratedFrom,
      migratedTo,
      stepsApplied: [],
    };
  }

  const path = getMigrationPath(migratedFrom, migratedTo);
  const { execution, stepsApplied } = executeMigrationChain(graph, path, policy);

  return {
    execution,
    migratedFrom,
    migratedTo,
    stepsApplied,
  };
}

/**
 * @internal Migration phase for prepareExecutionGraph.
 * Never downgrades; graphs ahead of target keep their version for validation warnings.
 */
export function resolveExecutionGraphMigration(
  graph: ExecutionGraph,
  targetVersion: string = CURRENT_VERSION,
  policy: ExecutionPolicy,
): MigrationResult {
  const migratedFrom = normalizeMigrationVersion(graph.version);
  const migratedTo = normalizeMigrationVersion(targetVersion);

  if (compareMigrationVersions(migratedFrom, migratedTo) > 0) {
    return {
      execution: cloneExecutionGraph(graph, migratedFrom),
      migratedFrom,
      migratedTo: migratedFrom,
      stepsApplied: [],
    };
  }

  return migrateExecutionGraph(graph, targetVersion, policy);
}
