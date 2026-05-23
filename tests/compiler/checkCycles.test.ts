import assert from "node:assert/strict";

import { checkCycles } from "../../core/execution/checkCycles";
import {
  getSubgraph,
  highlightCycles,
  printExecutionGraph,
  tracePath,
} from "../../core/debug/executionGraphInspector";
import { prepareExecutionGraph } from "../../core/execution/prepareExecutionGraph";
import type { ExecutionGraph } from "../../core/execution/executionContract";

const acyclic: ExecutionGraph = {
  version: "1.0",
  nodes: [
    { id: "a", type: "command", data: {} },
    { id: "b", type: "command", data: {} },
    { id: "c", type: "command", data: {} },
  ],
  edges: [
    { from: "a", to: "b", trigger: "next" },
    { from: "b", to: "c", trigger: "next" },
  ],
};

const cyclic: ExecutionGraph = {
  version: "1.0",
  nodes: [
    { id: "a", type: "command", data: {} },
    { id: "b", type: "callback", data: { callback: "btn" } },
    { id: "c", type: "fsm", data: { state: "S1" } },
  ],
  edges: [
    { from: "a", to: "b", trigger: "next" },
    { from: "b", to: "c", trigger: "callback", condition: "btn" },
    { from: "c", to: "a", trigger: "state", condition: "S1" },
  ],
};

const selfLoop: ExecutionGraph = {
  version: "1.0",
  nodes: [{ id: "a", type: "command", data: {} }],
  edges: [{ from: "a", to: "a", trigger: "next" }],
};

assert.equal(checkCycles(acyclic).hasCycle, false);
assert.equal(checkCycles(cyclic).hasCycle, true);
assert.equal(checkCycles(selfLoop).hasCycle, true);

const cycle = checkCycles(cyclic);
assert.equal(cycle.cycles.length, 1);
assert.deepEqual(cycle.cycles[0], ["a", "b", "c", "a"]);
assert.equal(cycle.edgeChains[0]?.length, 3);

const path = tracePath(acyclic, "a", "c");
assert.equal(path.found, true);
assert.deepEqual(path.nodes, ["a", "b", "c"]);

const subgraph = getSubgraph(acyclic, "a");
assert.deepEqual(
  subgraph.nodes.map((node) => node.id).sort(),
  ["a", "b", "c"],
);

prepareExecutionGraph(acyclic);
assert.throws(() => prepareExecutionGraph(cyclic), /cyclic execution flow/i);
assert.throws(() => prepareExecutionGraph(selfLoop), /cyclic execution flow/i);

assert.match(printExecutionGraph(cyclic), /callback/);
assert.match(highlightCycles(cyclic), /Cycle 1:/);

console.log("checkCycles test OK");
