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
  assert.equal(execution.nodes.length, 1);
  assert.equal(execution.nodes[0].type, "command");
  assert.deepEqual(getNextTargets(execution, "start_handler"), []);

  assert.ok(result.python.includes('@router.message(Command("start"))'));
  assert.ok(result.python.includes("command: start"));

  console.log("compiler test OK");
  console.log(result.python);
})();
