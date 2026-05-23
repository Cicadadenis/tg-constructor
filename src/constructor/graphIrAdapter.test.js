import assert from 'node:assert/strict';
import { GraphIRAdapter, createEmptyGraphIR } from './graphIrAdapter.js';

const adapter = new GraphIRAdapter(createEmptyGraphIR());
adapter.createNode('n1', 'SendMessage', { payload: { text: 'hi' } });
adapter.createNode('n2', 'Noop');
adapter.createEdge('e1', 'n1', 'n2');
assert.equal(adapter.validateStructureOnly().length, 0);
adapter.deleteNode('n1');
assert.equal(adapter.graph.edges.length, 0);
assert.equal(Object.keys(adapter.graph.nodes).length, 1);
console.log('graphIrAdapter.test.js: ok');
