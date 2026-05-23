import assert from "node:assert/strict";

import { DEFAULT_EXECUTION_POLICY } from "../../core/execution/executionPolicy";
import {
  executeMigrationChain,
  getMigrationPath,
  MigrationChainError,
  registerMigration,
  resetMigrationRegistry,
} from "../../core/execution/migrationRegistry";
import { prepareExecutionGraph } from "../../core/execution/prepareExecutionGraph";
import { CURRENT_VERSION } from "../../core/execution/version";
import type { ExecutionGraph } from "../../core/execution/executionContract";

resetMigrationRegistry();

const graphV10: ExecutionGraph = {
  version: "1.0",
  nodes: [
    { id: "a", type: "command", data: {} },
    { id: "b", type: "message", data: { text: "hi" } },
  ],
  edges: [{ from: "a", to: "b", trigger: "next" }],
};

const noop = prepareExecutionGraph(graphV10, CURRENT_VERSION);
assert.equal(noop.migration.stepsApplied.length, 0);
assert.equal(noop.execution.version, "1.0");

const to11 = prepareExecutionGraph(graphV10, "1.1");
assert.deepEqual(to11.migration.stepsApplied, ["1.0 → 1.1"]);
assert.equal(to11.execution.version, "1.1");

const pathTo20 = getMigrationPath("1.0", "2.0");
assert.deepEqual(
  pathTo20.map((step) => `${step.fromVersion} → ${step.toVersion}`),
  ["1.0 → 1.1", "1.1 → 1.2", "1.2 → 2.0"],
);

assert.throws(
  () => executeMigrationChain(graphV10, pathTo20, DEFAULT_EXECUTION_POLICY),
  (err: MigrationChainError) => {
    assert.equal(err.trace.stepIndex, 3);
    assert.equal(err.trace.validationCode, "INCOMPATIBLE_VERSION");
    return true;
  },
);

assert.throws(
  () => prepareExecutionGraph(graphV10, "2.0"),
  (err: MigrationChainError) => {
    assert.equal(err.code, "MIGRATION_CHAIN_FAILED");
    assert.equal(err.trace.validationCode, "INCOMPATIBLE_VERSION");
    return true;
  },
);

registerMigration("1.0", "1.1", (graph, context) => ({
  ...graph,
  version: context.toVersion,
  nodes: graph.nodes.map((node) => ({
    ...node,
    data: { ...node.data, schemaVersion: context.toVersion },
  })),
}));

const withRegistryHook = prepareExecutionGraph(graphV10, "1.1");
assert.equal(withRegistryHook.execution.nodes[0]?.data.schemaVersion, "1.1");

resetMigrationRegistry();

const prepared = prepareExecutionGraph(graphV10);
assert.equal(prepared.execution.version, CURRENT_VERSION);
assert.equal(prepared.migration.stepsApplied.length, 0);

console.log("migrateExecutionGraph test OK");
