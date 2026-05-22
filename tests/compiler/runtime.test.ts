import fs from "fs";
import assert from "node:assert/strict";

import { compileGraph } from "../../core/compiler/codegen";
import { buildFSM } from "../../core/execution/buildFSM";
import { buildCallbackRoutes } from "../../core/execution/buildCallbackRoutes";
import { projectFsmFromExecution } from "../../core/execution/buildFSM";
import { projectCallbackRoutesFromExecution } from "../../core/execution/buildCallbackRoutes";

const graph = JSON.parse(
  fs.readFileSync("./examples/runtimeGraph.json", "utf-8"),
);

(async () => {
  const result = await compileGraph(graph);
  const { execution } = result;

  assert.ok(execution, "execution graph required");
  assert.equal(execution.edges.length, 1);
  assert.equal(execution.edges[0].trigger, "next");
  assert.equal(execution.edges[0].from, "start");
  assert.equal(execution.edges[0].to, "welcome");

  for (const node of execution.nodes) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(node, "next"),
      false,
      `node ${node.id} must not expose node.next`,
    );
  }

  const fsm = buildFSM(execution);
  const fsmProjected = projectFsmFromExecution(execution);
  assert.deepEqual(fsm, fsmProjected);

  const callbacks = buildCallbackRoutes(execution);
  const callbacksProjected = projectCallbackRoutesFromExecution(execution);
  assert.deepEqual(callbacks, callbacksProjected);

  assert.ok(result.python.includes("# EDGE start -> welcome [next]"));
  assert.ok(result.python.includes("command: start"));

  console.log("runtime invariants OK");
  console.log(result.runtime);
  console.log(result.python);
})();
