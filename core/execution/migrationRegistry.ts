import type { ExecutionGraph, ExecutionNode } from "./executionContract";
import { sortEdges } from "./executionContract";
import {
  assertMigrationRegistryMutable,
  unfreezeMigrationRegistry,
} from "./migrationLock";
import {
  ExecutionGraphValidationError,
  validateExecutionGraphCore,
  type ExecutionGraphValidationCode,
} from "./validateExecutionGraphCore";
import type { ExecutionPolicy } from "./executionPolicy";
import { parseExecutionGraphVersion } from "./version";

export interface MigrationTransformContext {
  fromVersion: string;
  toVersion: string;
}

export type MigrationTransform = (
  graph: ExecutionGraph,
  context: MigrationTransformContext,
) => ExecutionGraph;

export interface MigrationPathStep {
  fromVersion: string;
  toVersion: string;
  transform: MigrationTransform;
}

export class ExecutionGraphMigrationError extends Error {
  readonly code = "MIGRATION_FAILED" as const;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ExecutionGraphMigrationError";
    this.details = details;
  }
}

export interface MigrationChainErrorTrace {
  stepIndex: number;
  fromVersion: string;
  toVersion: string;
  validationCode: ExecutionGraphValidationCode;
  validateMode?: MigrationValidateMode;
}

export type { MigrationValidateMode } from "./executionPolicy";

export class MigrationChainError extends Error {
  readonly code = "MIGRATION_CHAIN_FAILED" as const;
  readonly trace: MigrationChainErrorTrace;
  readonly details?: unknown;

  constructor(
    trace: MigrationChainErrorTrace,
    message: string,
    details?: unknown,
  ) {
    super(
      [
        `Migration chain failed at step ${trace.stepIndex} (${trace.fromVersion} → ${trace.toVersion})`,
        `validation code: ${trace.validationCode}`,
        trace.validateMode ? `validate mode: ${trace.validateMode}` : "",
        message,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    this.name = "MigrationChainError";
    this.trace = trace;
    this.details = details;
  }
}

function migrationKey(fromVersion: string, toVersion: string): string {
  return `${fromVersion}\0${toVersion}`;
}

function formatVersion(parts: { major: number; minor: number }): string {
  return `${parts.major}.${parts.minor}`;
}

export function normalizeMigrationVersion(version: string): string {
  const parsed = parseExecutionGraphVersion(version);
  if (!parsed) {
    throw new ExecutionGraphMigrationError(
      `Cannot migrate ExecutionGraph with invalid version "${version}"`,
      { version },
    );
  }
  return formatVersion(parsed);
}

export function compareMigrationVersions(a: string, b: string): number {
  const pa = parseExecutionGraphVersion(a);
  const pb = parseExecutionGraphVersion(b);
  if (!pa || !pb) {
    throw new ExecutionGraphMigrationError(
      `Cannot compare invalid ExecutionGraph versions "${a}" and "${b}"`,
      { a, b },
    );
  }
  if (pa.major !== pb.major) return pa.major - pb.major;
  return pa.minor - pb.minor;
}

function cloneNode(node: ExecutionNode): ExecutionNode {
  return {
    id: node.id,
    type: node.type,
    data: { ...node.data },
  };
}

export function cloneExecutionGraph(
  graph: ExecutionGraph,
  version: string,
): ExecutionGraph {
  return {
    version,
    nodes: graph.nodes.map((node) => cloneNode(node)),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
}

const registry = new Map<string, MigrationTransform>();

export function registerMigration(
  fromVersion: string,
  toVersion: string,
  transform: MigrationTransform,
): void {
  assertMigrationRegistryMutable("register migration");

  const from = normalizeMigrationVersion(fromVersion);
  const to = normalizeMigrationVersion(toVersion);

  if (compareMigrationVersions(from, to) >= 0) {
    throw new ExecutionGraphMigrationError(
      `Migration must move forward (${from} → ${to})`,
      { fromVersion: from, toVersion: to },
    );
  }

  registry.set(migrationKey(from, to), transform);
}

export function unregisterMigration(
  fromVersion: string,
  toVersion: string,
): boolean {
  assertMigrationRegistryMutable("unregister migration");

  const from = normalizeMigrationVersion(fromVersion);
  const to = normalizeMigrationVersion(toVersion);
  return registry.delete(migrationKey(from, to));
}

export function getRegisteredMigration(
  fromVersion: string,
  toVersion: string,
): MigrationTransform | undefined {
  const from = normalizeMigrationVersion(fromVersion);
  const to = normalizeMigrationVersion(toVersion);
  return registry.get(migrationKey(from, to));
}

function getOutgoingMigrationSteps(fromVersion: string): MigrationPathStep[] {
  const from = normalizeMigrationVersion(fromVersion);
  const steps: MigrationPathStep[] = [];

  for (const [key, transform] of registry.entries()) {
    const [stepFrom, stepTo] = key.split("\0");
    if (stepFrom !== from) continue;
    steps.push({
      fromVersion: stepFrom,
      toVersion: stepTo,
      transform,
    });
  }

  steps.sort((a, b) =>
    compareMigrationVersions(a.toVersion, b.toVersion),
  );

  return steps;
}

/**
 * Shortest forward migration path using registered steps.
 * Supports cross-major chains when steps are registered (e.g. 1.2 → 2.0).
 */
export function getMigrationPath(
  fromVersion: string,
  toVersion: string,
): MigrationPathStep[] {
  const from = normalizeMigrationVersion(fromVersion);
  const to = normalizeMigrationVersion(toVersion);

  if (from === to) return [];

  if (compareMigrationVersions(from, to) > 0) {
    throw new ExecutionGraphMigrationError(
      `Cannot downgrade ExecutionGraph from ${from} to ${to}`,
      { fromVersion: from, toVersion: to },
    );
  }

  const queue: Array<{ version: string; path: MigrationPathStep[] }> = [
    { version: from, path: [] },
  ];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const step of getOutgoingMigrationSteps(current.version)) {
      if (visited.has(step.toVersion)) continue;
      visited.add(step.toVersion);

      const nextPath = [...current.path, step];
      if (step.toVersion === to) return nextPath;

      queue.push({ version: step.toVersion, path: nextPath });
    }
  }

  throw new ExecutionGraphMigrationError(
    `No migration path registered from ${from} to ${to}`,
    { fromVersion: from, toVersion: to },
  );
}

function resolveMigrationSettings(policy: ExecutionPolicy) {
  return {
    strict: policy.migration.strict,
    validateMode: policy.migration.validateMode,
  };
}

function assertMigrationChainValid(
  execution: ExecutionGraph,
  trace: Omit<MigrationChainErrorTrace, "validationCode">,
  policy: ExecutionPolicy,
): void {
  try {
    validateExecutionGraphCore(execution, policy);
  } catch (err) {
    if (err instanceof ExecutionGraphValidationError) {
      throw new MigrationChainError(
        {
          ...trace,
          validationCode: err.code,
        },
        err.message,
        err.details,
      );
    }
    throw err;
  }
}

export function executeMigrationChain(
  graph: ExecutionGraph,
  path: MigrationPathStep[],
  policy: ExecutionPolicy,
): { execution: ExecutionGraph; stepsApplied: string[] } {
  const resolved = resolveMigrationSettings(policy);
  let execution = cloneExecutionGraph(
    graph,
    normalizeMigrationVersion(graph.version),
  );
  const stepsApplied: string[] = [];

  for (let index = 0; index < path.length; index++) {
    const step = path[index]!;
    const context: MigrationTransformContext = {
      fromVersion: step.fromVersion,
      toVersion: step.toVersion,
    };
    execution = step.transform(execution, context);
    execution.version = step.toVersion;

    if (resolved.strict && resolved.validateMode === "each-step") {
      assertMigrationChainValid(
        execution,
        {
          stepIndex: index + 1,
          fromVersion: step.fromVersion,
          toVersion: step.toVersion,
          validateMode: resolved.validateMode,
        },
        policy,
      );
    }

    stepsApplied.push(`${step.fromVersion} → ${step.toVersion}`);
  }

  if (resolved.strict && resolved.validateMode === "final-only") {
    const lastStep = path.at(-1);
    assertMigrationChainValid(
      execution,
      {
        stepIndex: path.length > 0 ? path.length : 0,
        fromVersion:
          lastStep?.fromVersion ??
          normalizeMigrationVersion(graph.version),
        toVersion: lastStep?.toVersion ?? execution.version,
        validateMode: resolved.validateMode,
      },
      policy,
    );
  }

  return { execution, stepsApplied };
}

function registerMigrationUnchecked(
  fromVersion: string,
  toVersion: string,
  transform: MigrationTransform,
): void {
  const from = normalizeMigrationVersion(fromVersion);
  const to = normalizeMigrationVersion(toVersion);

  if (compareMigrationVersions(from, to) >= 0) {
    throw new ExecutionGraphMigrationError(
      `Migration must move forward (${from} → ${to})`,
      { fromVersion: from, toVersion: to },
    );
  }

  registry.set(migrationKey(from, to), transform);
}

function registerIdentityMigration(fromVersion: string, toVersion: string): void {
  registerMigrationUnchecked(fromVersion, toVersion, (graph, context) =>
    cloneExecutionGraph(graph, context.toVersion),
  );
}

function registerDefaultMigrations(): void {
  registry.clear();

  registerMigrationUnchecked("1.0", "1.1", (graph, context) => ({
    ...cloneExecutionGraph(graph, context.toVersion),
    edges: sortEdges(graph.edges),
  }));

  registerIdentityMigration("1.1", "1.2");
  registerIdentityMigration("1.2", "2.0");
}

registerDefaultMigrations();

/** Restore built-in migration chain after test overrides. */
export function resetMigrationRegistry(): void {
  unfreezeMigrationRegistry();
  registerDefaultMigrations();
}

export function listRegisteredMigrations(): Array<{
  fromVersion: string;
  toVersion: string;
}> {
  return [...registry.keys()].map((key) => {
    const [fromVersion, toVersion] = key.split("\0");
    return { fromVersion, toVersion };
  });
}
