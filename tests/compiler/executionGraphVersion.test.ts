import assert from "node:assert/strict";

import {
  CURRENT_VERSION,
  checkVersionCompatibility,
  isCompatible,
  parseExecutionGraphVersion,
} from "../../core/execution/version";
import { prepareExecutionGraph } from "../../core/execution/prepareExecutionGraph";
import type { ExecutionGraph } from "../../core/execution/executionContract";

assert.equal(CURRENT_VERSION, "1.0");
assert.equal(isCompatible("1.0"), true);
assert.equal(isCompatible("1.0.0"), true);
assert.equal(isCompatible("1.2.3"), true);
assert.equal(isCompatible("1.1"), true);
assert.equal(isCompatible("0.9"), false);
assert.equal(isCompatible("2.0"), false);
assert.equal(isCompatible("invalid"), false);
assert.equal(parseExecutionGraphVersion("1.2.3")?.minor, 2);

const compat10 = checkVersionCompatibility("1.0");
assert.equal(compat10.compatible, true);
assert.equal(compat10.warnings.length, 0);

const compat11 = checkVersionCompatibility("1.1");
assert.equal(compat11.compatible, true);
assert.equal(compat11.warnings.length, 1);

const compat20 = checkVersionCompatibility("2.0");
assert.equal(compat20.compatible, false);

const graphBase: ExecutionGraph = {
  version: "1.0",
  nodes: [
    { id: "a", type: "command", data: {} },
    { id: "b", type: "message", data: {} },
  ],
  edges: [{ from: "a", to: "b", trigger: "next" }],
};

const futureMinor: ExecutionGraph = {
  ...graphBase,
  version: "1.1",
};

const nextMajor: ExecutionGraph = {
  ...graphBase,
  version: "2.0",
};

const stable = prepareExecutionGraph(graphBase);
assert.equal(stable.compatibilityWarnings.length, 0);

const ahead = prepareExecutionGraph(futureMinor);
assert.equal(ahead.execution.version, "1.1");
assert.equal(ahead.compatibilityWarnings.length, 1);
assert.match(ahead.compatibilityWarnings[0]!, /minor 1/i);

assert.throws(
  () => prepareExecutionGraph(nextMajor),
  (err: Error & { code?: string }) => {
    assert.equal(err.code, "INCOMPATIBLE_VERSION");
    return /major mismatch/i.test(err.message);
  },
);

console.log("executionGraph version test OK");
