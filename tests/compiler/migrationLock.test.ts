import assert from "node:assert/strict";

import {
  registerMigration,
  resetMigrationRegistry,
} from "../../core/execution/migrationRegistry";
import {
  freezeMigrationRegistry,
  isMigrationRegistryFrozen,
  MigrationRegistryFrozenError,
  unfreezeMigrationRegistry,
} from "../../core/execution/migrationLock";
import { prepareExecutionGraph } from "../../core/execution/prepareExecutionGraph";
import type { ExecutionGraph } from "../../core/execution/executionContract";

const graph: ExecutionGraph = {
  version: "1.0",
  nodes: [
    { id: "a", type: "command", data: {} },
    { id: "b", type: "message", data: {} },
  ],
  edges: [{ from: "a", to: "b", trigger: "next" }],
};

resetMigrationRegistry();
assert.equal(isMigrationRegistryFrozen(), false);

freezeMigrationRegistry();
assert.equal(isMigrationRegistryFrozen(), true);

assert.throws(
  () =>
    registerMigration("1.0", "1.1", (g, ctx) => ({
      ...g,
      version: ctx.toVersion,
    })),
  MigrationRegistryFrozenError,
);

resetMigrationRegistry();
assert.equal(isMigrationRegistryFrozen(), false);

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";

try {
  prepareExecutionGraph(graph);
  assert.equal(isMigrationRegistryFrozen(), true);

  assert.throws(
    () =>
      registerMigration("1.0", "1.1", (g, ctx) => ({
        ...g,
        version: ctx.toVersion,
      })),
    MigrationRegistryFrozenError,
  );

  resetMigrationRegistry();
  assert.equal(isMigrationRegistryFrozen(), false);
} finally {
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
  resetMigrationRegistry();
}

console.log("migrationLock test OK");
