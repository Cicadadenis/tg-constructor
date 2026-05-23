import assert from "node:assert/strict";

import {
  DEFAULT_EXECUTION_POLICY,
  resolveExecutionPolicy,
} from "../../core/execution/executionPolicy";

assert.equal(DEFAULT_EXECUTION_POLICY.migration.strict, true);
assert.equal(DEFAULT_EXECUTION_POLICY.migration.validateMode, "each-step");

const partial = resolveExecutionPolicy({
  migration: { validateMode: "final-only" },
});
assert.equal(partial.migration.strict, true);
assert.equal(partial.migration.validateMode, "final-only");

console.log("executionPolicy test OK");
