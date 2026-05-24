import assert from "node:assert/strict";
import { createGraphDocument } from "../../src/constructor/graph_document/graph_document.js";
import { graphDocumentToProjectGraph } from "../../src/constructor/graph_document/graph_project_bridge.js";
import { projectGraphToFlow } from "../../core/graph/model.js";
import { compileFlowToPython } from "../../core/mappers/compileFlowGraph.mjs";
import {
  isExecutionGraphValidationError,
} from "../../core/mappers/executionGraphErrors.mjs";

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

// Preview: nodes without edges → warning (not silent)
{
  const doc = createGraphDocument({
    nodes: [
      { id: "st", type: "start", position: { x: 0, y: 0 } },
      { id: "m", type: "message", position: { x: 0, y: 80 }, data: { text: "hi" } },
    ],
    edges: [],
  });
  const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
  const out = compileFlowToPython(flow, { graphDocument: doc });
  assert.equal(out.empty, true);
  assert.equal(out.compileWarnings.length, 1);
  assert.equal(out.compileWarnings[0].code, "MISSING_EDGES");
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

// Arbitrary errors with `code` must not be classified as execution validation
{
  const fake = new Error("db timeout");
  fake.name = "SomeOtherError";
  fake.code = "ECONNRESET";
  assert.equal(isExecutionGraphValidationError(fake), false);

  const valid = new Error("missing edges");
  valid.name = "ExecutionGraphValidationError";
  valid.code = "MISSING_EDGES";
  assert.equal(isExecutionGraphValidationError(valid), true);
}

console.log("compileFlowGraph.test.mjs: ok");
