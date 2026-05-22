import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import { createOperation, applyOperation } from './graph_operations.js';
import { deepMergePlainObjects } from './graph_data_merge.js';

assert.deepEqual(
  deepMergePlainObjects({ rows: 'a', meta: { x: 1 } }, { meta: { y: 2 } }),
  { rows: 'a', meta: { x: 1, y: 2 } },
);

const doc = createGraphDocument({
  nodes: [{
    id: 'n1',
    type: 'buttons',
    position: { x: 0, y: 0 },
    data: { rows: 'Old', extra: { a: 1 } },
  }],
  edges: [],
});

const result = applyOperation(
  doc,
  createOperation('UpdateNodeData', {
    nodeId: 'n1',
    patch: { extra: { b: 2 } },
  }),
);
assert.equal(result.ok, true);
assert.deepEqual(result.document.nodes.n1.data, {
  rows: 'Old',
  extra: { a: 1, b: 2 },
});

console.log('graph_data_merge.test.js: ok');
