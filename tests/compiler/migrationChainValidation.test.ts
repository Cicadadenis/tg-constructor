import assert from "node:assert/strict";

import { DEFAULT_EXECUTION_POLICY } from "../../core/execution/executionPolicy";
import {
  executeMigrationChain,
  getMigrationPath,
  MigrationChainError,
  registerMigration,
  resetMigrationRegistry,
} from "../../core/execution/migrationRegistry";
import type { ExecutionGraph } from "../../core/execution/executionContract";

resetMigrationRegistry();

const graphV10: ExecutionGraph = {
  version: "1.0",
  nodes: [
    { id: "a", type: "command", data: {} },
    { id: "b", type: "message", data: {} },
  ],
  edges: [{ from: "a", to: "b", trigger: "next" }],
};

registerMigration("1.0", "1.1", (graph, context) => ({
  ...graph,
  version: context.toVersion,
  edges: [],
}));

assert.throws(
  () =>
    executeMigrationChain(
      graphV10,
      getMigrationPath("1.0", "1.1"),
      DEFAULT_EXECUTION_POLICY,
    ),
  (err: MigrationChainError) => {
    assert.equal(err.trace.stepIndex, 1);
    assert.equal(err.trace.fromVersion, "1.0");
    assert.equal(err.trace.toVersion, "1.1");
    assert.equal(err.trace.validationCode, "MISSING_EDGES");
    assert.match(err.message, /step 1 \(1\.0 → 1\.1\)/);
    return true;
  },
);

resetMigrationRegistry();

console.log("migrationChain validation test OK");
