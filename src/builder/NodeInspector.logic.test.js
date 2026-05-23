/**
 * NodeInspector persistence logic (no DOM) — mirrors flush/draft ref behavior.
 */
import assert from 'node:assert/strict';
import { createGraphEditorStore } from '../constructor/graph_document/graph_editor_store.js';
import { getOperationContract, validateNodeProps } from '../constructor/graph_document/operation_registry.js';
import { patchNodeData } from '../constructor/graph_document/graph_operation_client.js';

const store = createGraphEditorStore();
const graph = {
  getGraphDocument: () => store.getGraphDocument(),
  dispatch: (...args) => store.dispatch(...args),
};

store.dispatch('AddNode', {
  nodeId: 'msg1',
  type: 'message',
  position: { x: 0, y: 0 },
  data: { text: 'Hello' },
});

const contract = getOperationContract('message');
const draftRef = { current: { text: 'Hello', markup: '' } };
const dirtyKeys = new Set(['text']);

const snapshot = { ...draftRef.current, text: 'Fast typed value' };
const reason = validateNodeProps('message', snapshot);
assert.equal(reason, null);

const patch = {};
for (const k of dirtyKeys) {
  if (contract.inspectorSchema.some((f) => f.key === k)) {
    patch[k] = snapshot[k] ?? '';
  }
}
patchNodeData(graph, 'msg1', patch);

assert.equal(store.getGraphDocument().nodes.msg1.data.text, 'Fast typed value');

console.log('NodeInspector.logic.test.js: ok');
