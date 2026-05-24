import assert from "node:assert/strict";

import { createGraphDocument } from "../../src/constructor/graph_document/graph_document.js";
import { buildGraphNodeData } from "../../src/constructor/graph_document/graph_node_payload.js";
import {
  compileGraphDocumentToPython,
  lowerGraphDocumentToExecution,
} from "../../core/compiler/unifiedCompilePipeline.ts";
import { graphToBotIR } from "../../core/ir/bot_ir";
import { botIrToExecutionGraph } from "../../core/ir/botIrToExecutionGraph.ts";
import { resolveFlowNodeType } from "../../core/ir/resolveFlowNodeType.js";
import { validateCompile } from "../../core/validation/index.ts";
import { compileGraph } from "../../core/compiler/codegen";

const doc = createGraphDocument({
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
      data: buildGraphNodeData("message", { text: "Hello" }),
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

assert.equal(validateCompile(doc, { failFast: false }).ok, true);

const ir = graphToBotIR(doc);
assert.ok(ir.nodes.every((n) => n.type === doc.nodes[n.id]?.type));
assert.ok(!("type" in (ir.nodes[0]?.payload || {})));

const lowered = lowerGraphDocumentToExecution(doc, { skipValidation: true });
assert.equal(lowered.execution.nodes.length, 3);
assert.ok(lowered.execution.edges.length >= 2);

const compiled = compileGraphDocumentToPython(doc, { skipValidation: true });
assert.equal(compiled.success, true);
assert.ok(compiled.python.includes("aiogram"));

const viaCodegen = await compileGraph(doc, { skipValidation: true });
assert.equal(viaCodegen.success, true);
assert.ok(viaCodegen.botIr);

const legacyNode = {
  id: "x",
  type: "command",
  data: { type: "start", cmd: "oops" },
};
assert.equal(resolveFlowNodeType(legacyNode), "command");

assert.throws(
  () =>
    botIrToExecutionGraph({
      ...ir,
      nodes: [
        ...ir.nodes,
        {
          id: "bad",
          type: "not_registered_xyz",
          inputs: [],
          outputs: [],
          capabilities: { async: false, outputs: [] },
          payload: {},
        },
      ],
    }),
  /Unknown block type|capability map/,
);

console.log("unified_compile_pipeline.test.ts OK");
