import assert from "node:assert/strict";

import { createGraphDocument } from "../../src/constructor/graph_document/graph_document.js";
import { buildGraphNodeData } from "../../src/constructor/graph_document/graph_node_payload.js";
import {
  validateGraph,
  validateBotIR,
  validateCompile,
  StrictValidationError,
} from "../../core/validation/index.ts";
import { graphToBotIR } from "../../core/ir/bot_ir";
import { hasOperationContract } from "../../src/constructor/graph_document/operation_registry.js";

const goodDoc = createGraphDocument({
  schema_version: 2,
  nodes: [
    {
      id: "s1",
      type: "start",
      position: { x: 0, y: 0 },
      data: buildGraphNodeData("start", { cmd: "start" }),
    },
    {
      id: "m1",
      type: "message",
      position: { x: 200, y: 0 },
      data: buildGraphNodeData("message", { text: "hi" }),
    },
    {
      id: "stop1",
      type: "stop",
      position: { x: 400, y: 0 },
      data: buildGraphNodeData("stop", {}),
    },
  ],
  edges: [
    {
      id: "e1",
      source: "s1",
      target: "m1",
      sourcePort: "flow",
      targetPort: "flow",
    },
    {
      id: "e2",
      source: "m1",
      target: "stop1",
      sourcePort: "flow",
      targetPort: "flow",
    },
  ],
});

const graphOk = validateGraph(goodDoc);
assert.equal(graphOk.ok, true, graphOk.errors.map((e) => e.message).join("; "));

const ir = graphToBotIR(goodDoc);
const irOk = validateBotIR(ir);
assert.equal(irOk.ok, true);

const compileOk = validateCompile(goodDoc, { failFast: false });
assert.equal(compileOk.ok, true, compileOk.errors.map((e) => e.message).join("; "));

const badUnknown = {
  schema_version: 2,
  nodes: {
    bad: {
      id: "bad",
      type: "unknown",
      position: { x: 0, y: 0 },
      data: {},
    },
  },
  edges: {},
};

assert.throws(
  () => validateGraph(badUnknown, { failFast: true }),
  (err: unknown) => {
    assert.ok(err instanceof StrictValidationError);
    assert.equal(err.code, "unknown_block_type");
    return true;
  },
);

const badGraph = validateGraph(badUnknown, { failFast: false });
assert.equal(badGraph.ok, false);
assert.ok(badGraph.errors.some((e) => e.code === "unknown_block_type"));

assert.equal(hasOperationContract("start"), true);
assert.equal(hasOperationContract("unknown"), false);
assert.equal(hasOperationContract("not_a_real_block_xyz"), false);

const badIr = {
  ...ir,
  nodes: [
    ...ir.nodes,
    {
      id: "x",
      type: "unknown",
      inputs: [],
      outputs: [],
      capabilities: { async: false, outputs: [] },
      payload: {},
    },
  ],
};
const irBad = validateBotIR(badIr as typeof ir, { failFast: false });
assert.equal(irBad.ok, false);
assert.ok(irBad.errors.some((e) => e.code === "unknown_block_type"));

console.log("strict_validation_pipeline.test.ts OK");
