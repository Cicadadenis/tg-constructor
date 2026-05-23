import assert from "node:assert/strict";

import { DEFAULT_EXECUTION_POLICY } from "../../core/execution/executionPolicy";
import {
  executeMigrationChain,
  getMigrationPath,
  MigrationChainError,
  listRegisteredMigrations,
  resetMigrationRegistry,
} from "../../core/execution/migrationRegistry";
import type { ExecutionGraph } from "../../core/execution/executionContract";

const graphV10: ExecutionGraph = {
  version: "1.0",
  nodes: [
    { id: "a", type: "command", data: {} },
    { id: "b", type: "message", data: {} },
  ],
  edges: [{ from: "a", to: "b", trigger: "next" }],
};

const path = getMigrationPath("1.0", "2.0");
assert.equal(path.length, 3);

const pathTo11 = getMigrationPath("1.0", "1.1");
const to11 = executeMigrationChain(graphV10, pathTo11, DEFAULT_EXECUTION_POLICY);
assert.equal(to11.execution.version, "1.1");
assert.deepEqual(to11.stepsApplied, ["1.0 → 1.1"]);

assert.throws(
  () => executeMigrationChain(graphV10, path, DEFAULT_EXECUTION_POLICY),
  (err: MigrationChainError) => {
    assert.equal(err.code, "MIGRATION_CHAIN_FAILED");
    assert.equal(err.trace.stepIndex, 3);
    assert.equal(err.trace.fromVersion, "1.2");
    assert.equal(err.trace.toVersion, "2.0");
    assert.equal(err.trace.validationCode, "INCOMPATIBLE_VERSION");
    assert.match(err.message, /validation code: INCOMPATIBLE_VERSION/);
    return true;
  },
);

assert.ok(
  listRegisteredMigrations().some(
    (step) => step.fromVersion === "1.2" && step.toVersion === "2.0",
  ),
);

resetMigrationRegistry();

console.log("migrationRegistry test OK");
