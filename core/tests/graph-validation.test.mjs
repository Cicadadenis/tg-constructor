import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from '../../src/constructor/graph_document/graph_document.js';
import { validateGraph } from '../../src/constructor/graph_document/validate_graph.js';

test('validateGraph accepts minimal valid graph', () => {
  const doc = createGraphDocument({
    nodes: [
      { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
      { id: 'n_msg', type: 'message', position: { x: 0, y: 112 }, data: { text: 'ok' } },
    ],
    edges: [{ id: 'e1', source: 'n_start', target: 'n_msg' }],
  });
  const result = validateGraph(doc);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test('validateGraph detects dangling edges and cycles', () => {
  const raw = {
    schema_version: 1,
    nodes: [
      { id: 'a', type: 'start', position: { x: 0, y: 0 }, data: {}, meta: {} },
      { id: 'b', type: 'message', position: { x: 0, y: 120 }, data: {}, meta: {} },
    ],
    edges: [
      { id: 'e_ab', source: 'a', target: 'b' },
      { id: 'e_ba', source: 'b', target: 'a' },
      { id: 'e_missing', source: 'b', target: 'ghost' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    ui_state: { selection: [], collapsed: [], groups: [] },
    metadata: { name: 'test', revision: 0, tags: [] },
  };
  const result = validateGraph(raw);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((x) => x.code === 'cycles'));
  assert.ok(result.issues.some((x) => x.code === 'dangling_edge'));
});
