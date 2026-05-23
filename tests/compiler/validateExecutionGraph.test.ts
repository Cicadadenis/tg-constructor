import assert from "node:assert/strict";

import { prepareExecutionGraph } from "../../core/execution/prepareExecutionGraph";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";
import type { ExecutionGraph } from "../../core/execution/executionContract";

const valid: ExecutionGraph = {
  version: "1.0",
  nodes: [
    { id: "a", type: "command", data: {} },
    { id: "b", type: "message", data: { text: "hi" } },
  ],
  edges: [{ from: "a", to: "b", trigger: "next" }],
};

const orphan: ExecutionGraph = {
  version: "1.0",
  nodes: [
    { id: "a", type: "command", data: {} },
    { id: "b", type: "message", data: {} },
    { id: "orphan", type: "message", data: {} },
  ],
  edges: [{ from: "a", to: "b", trigger: "next" }],
};

const noEdges: ExecutionGraph = {
  version: "1.0",
  nodes: [{ id: "a", type: "command", data: {} }],
  edges: [],
};

const danglingEdge: ExecutionGraph = {
  version: "1.0",
  nodes: [{ id: "a", type: "command", data: {} }],
  edges: [{ from: "a", to: "missing", trigger: "next" }],
};

assert.deepEqual(prepareExecutionGraph(valid).execution.edges, valid.edges);

assert.throws(() => prepareExecutionGraph(noEdges), /MISSING_EDGES|at least one edge/);
assert.throws(() => prepareExecutionGraph(orphan), /orphan/i);
assert.throws(() => prepareExecutionGraph(danglingEdge), /unknown node/i);

const incompatibleVersion: ExecutionGraph = {
  ...valid,
  version: "2.0",
};
assert.throws(
  () => prepareExecutionGraph(incompatibleVersion),
  /major mismatch|INCOMPATIBLE_VERSION/i,
);

const newerMinor: ExecutionGraph = {
  ...valid,
  version: "1.1",
};
const newerResult = prepareExecutionGraph(newerMinor);
assert.equal(newerResult.compatibilityWarnings.length, 1);

const python = generateAiogramBot(valid);
assert.match(python, /# EXECUTION GRAPH VERSION: 1\.0/);
assert.match(python, /# EDGE: a -> b \[next\]/);
assert.doesNotMatch(python, /callbackRegistry|routerRegistry|StatesGroup/);

console.log("validateExecutionGraph test OK");
