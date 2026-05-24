import assert from "node:assert/strict";

import { graphToBotIR, BOT_IR_VERSION } from "../../core/ir/bot_ir";

const ir = graphToBotIR({
  nodes: [
    {
      id: "start_1",
      type: "start",
      position: { x: 0, y: 0 },
      data: { cmd: "start" },
    },
    {
      id: "msg_1",
      type: "message",
      position: { x: 0, y: 120 },
      data: { text: "Hello" },
    },
  ],
  edges: [
    {
      id: "e1",
      source: "start_1",
      target: "msg_1",
      sourcePort: "flow",
      targetPort: "flow",
    },
  ],
});

assert.equal(ir.version, BOT_IR_VERSION);
assert.equal(ir.nodes.length, 2);
assert.equal(ir.edges.length, 1);
const startNode = ir.nodes.find((n) => n.id === "start_1");
assert.ok(startNode);
assert.equal(startNode!.type, "start");
assert.equal(startNode!.payload.cmd, "start");
assert.ok(Array.isArray(startNode!.inputs));
assert.ok(Array.isArray(startNode!.outputs));
assert.equal(startNode!.capabilities.async, false);
assert.ok(Array.isArray(startNode!.capabilities.outputs));
assert.ok(startNode!.capabilities.outputs.includes("flow"));
assert.equal(ir.context.nodeCount, 2);
assert.equal(ir.context.edgeCount, 1);
assert.ok(ir.visualDb);
assert.equal(ir.visualDb.nodeCount, 0);

console.log("bot_ir test OK");
