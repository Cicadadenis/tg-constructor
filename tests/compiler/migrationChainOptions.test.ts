import assert from "node:assert/strict";

import {
  DEFAULT_EXECUTION_POLICY,
  resolveExecutionPolicy,
} from "../../core/execution/executionPolicy";
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

registerMigration("1.1", "1.2", (graph, context) => ({
  ...graph,
  version: context.toVersion,
  edges: [{ from: "a", to: "b", trigger: "next" }],
}));

const path = getMigrationPath("1.0", "1.2");
const defaultPolicy = DEFAULT_EXECUTION_POLICY;

assert.throws(
  () => executeMigrationChain(graphV10, path, defaultPolicy),
  (err: MigrationChainError) => {
    assert.equal(err.trace.stepIndex, 1);
    assert.equal(err.trace.validationCode, "MISSING_EDGES");
    assert.equal(err.trace.validateMode, "each-step");
    return true;
  },
);

const finalOnlyPolicy = resolveExecutionPolicy({
  migration: { validateMode: "final-only" },
});

const finalOnly = executeMigrationChain(graphV10, path, finalOnlyPolicy);
assert.equal(finalOnly.execution.version, "1.2");
assert.equal(finalOnly.execution.edges.length, 1);

const noStrictPolicy = resolveExecutionPolicy({
  migration: { strict: false },
});

const noStrict = executeMigrationChain(
  {
    ...graphV10,
    edges: [],
  },
  getMigrationPath("1.0", "1.1"),
  noStrictPolicy,
);
assert.equal(noStrict.execution.edges.length, 0);

assert.throws(
  () =>
    executeMigrationChain(
      {
        ...graphV10,
        edges: [],
      },
      getMigrationPath("1.0", "1.1"),
      finalOnlyPolicy,
    ),
  (err: MigrationChainError) => {
    assert.equal(err.trace.validationCode, "MISSING_EDGES");
    assert.equal(err.trace.validateMode, "final-only");
    return true;
  },
);

resetMigrationRegistry();

console.log("migrationChainOptions test OK");
