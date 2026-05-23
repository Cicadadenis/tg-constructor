import fs from "fs";
import assert from "node:assert/strict";

import { compileGraph } from "../../core/compiler/codegen";
import { getNextTargets } from "../../core/execution/executionContract";

const graph = JSON.parse(
  fs.readFileSync("./examples/simpleGraph.json", "utf-8"),
);

(async () => {
  const result = await compileGraph(graph);
  const { execution } = result;

  assert.ok(execution);
  assert.equal(execution.nodes.length, 2);
  assert.equal(execution.edges.length, 1);
  assert.equal(execution.nodes[0].type, "command");
  assert.deepEqual(getNextTargets(execution, "start_handler"), ["welcome"]);

  assert.ok(result.python.includes("# EDGE: start_handler -> welcome [next]"));
  assert.ok(result.python.includes("# EXECUTION GRAPH VERSION: 1.0"));

  console.log("compiler test OK");
  console.log(result.python);
})();
