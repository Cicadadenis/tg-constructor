import assert from "node:assert/strict";
import { createGraphDocument } from "../../src/constructor/graph_document/graph_document.js";
import { graphDocumentToProjectGraph } from "../../src/constructor/graph_document/graph_project_bridge.js";
import { projectGraphToFlow } from "../../core/graph/model.js";
import { compileFlowToPython } from "../../core/mappers/compileFlowGraph.mjs";

// Start node only — preview must not throw
{
  const doc = createGraphDocument({
    nodes: [{ id: "st", type: "start", position: { x: 0, y: 0 } }],
    edges: [],
  });
  const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
  const out = compileFlowToPython(flow, { graphDocument: doc });
  assert.equal(out.empty, true);
  assert.equal(out.code, "");
  assert.equal(out.compileErrors.length, 0);
}

// Flow with undefined node entry — must not throw
{
  const out = compileFlowToPython(
    {
      nodes: [undefined, { id: "st", type: "cicada", position: { x: 0, y: 0 }, data: { type: "start" } }],
      edges: [],
    },
    { strict: false },
  );
  assert.equal(out.empty, true);
  assert.equal(out.compileErrors.length, 0);
}

// Strict mode surfaces missing edges as compile error
{
  const doc = createGraphDocument({
    nodes: [{ id: "st", type: "start", position: { x: 0, y: 0 } }],
    edges: [],
  });
  const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
  const out = compileFlowToPython(flow, { graphDocument: doc, strict: true });
  assert.equal(out.empty, true);
  assert.equal(out.compileErrors.length, 1);
  assert.equal(out.compileErrors[0].code, "MISSING_EDGES");
}

// Valid graph compiles
{
  const doc = createGraphDocument({
    nodes: [
      { id: "st", type: "start", position: { x: 0, y: 0 } },
      { id: "m", type: "message", position: { x: 0, y: 80 }, data: { text: "hi" } },
    ],
    edges: [{ id: "e", source: "st", target: "m" }],
  });
  const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
  const out = compileFlowToPython(flow, { graphDocument: doc });
  assert.equal(out.empty, false);
  assert.ok(out.code.length > 0);
  assert.equal(out.compileErrors.length, 0);
}

console.log("compileFlowGraph.test.mjs: ok");
