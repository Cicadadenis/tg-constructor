/**
 * Single mutation model — GraphEditorStore.dispatch is the only write path.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGraphEditorStore } from '../../src/constructor/graph_document/graph_editor_store.js';
import { documentToBootstrapOperations } from '../../src/constructor/graph_document/graph_import.js';
import { migrateGraphDocument } from '../../src/constructor/graph_document/graph_migration.js';
import { stacksToGraphDocument } from '../../src/constructor/graph_document/stacks_bridge.js';
import { scanSourceForForbiddenGraphMutations } from '../../src/constructor/graph_document/graph_mutation_guard.js';
import { GRAPH_OPERATION_TYPES } from '../../src/constructor/graph_document/graph_schema.js';

const root = path.join(fileURLToPath(new URL('../..', import.meta.url)));

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const hookSource = read('src/constructor/graph_document/useGraphEditor.js');
const storeSource = read('src/constructor/graph_document/graph_editor_store.js');
const appSource = read('src/App.jsx');
const clientSource = read('src/constructor/graph_document/graph_operation_client.js');

const forbiddenHook = [
  'mutateStacks',
  'replaceStacks',
  'replaceDocument',
  'importStacks',
  'importGraph',
  'stacksView',
  'dispatchCanvasEvent',
  'store,',
  '.store',
];
for (const term of forbiddenHook) {
  assert.ok(!hookSource.includes(term), `useGraphEditor must not expose ${term}`);
}

assert.ok(!storeSource.includes('replaceDocument'), 'GraphEditorStore must not expose replaceDocument');
assert.ok(!storeSource.includes('replay('), 'GraphEditorStore must not expose replay()');

for (const term of [
  'mutateStacks',
  'replaceStacks',
  'graph.importStacks',
  'graph.importGraph',
  'ReplaceGraphDocument',
  'buildReplaceGraphFromStacks',
]) {
  assert.ok(!appSource.includes(term), `App.jsx must not use ${term}`);
}

assert.ok(appSource.includes('migrateGraphDocument'), 'App uses GraphDocument migration for load');
assert.ok(!clientSource.includes('importStacks'), 'operation client must not expose importStacks');
assert.ok(!clientSource.includes('importGraph'), 'operation client must not expose importGraph');

const forbiddenInApp = scanSourceForForbiddenGraphMutations(appSource);
assert.equal(
  forbiddenInApp.length,
  0,
  `App.jsx forbidden mutations: ${JSON.stringify(forbiddenInApp)}`,
);

assert.ok(!GRAPH_OPERATION_TYPES.includes('ReplaceGraphDocument'));

const store = createGraphEditorStore();
store.dispatch('AddNode', { nodeId: 'n1', type: 'start', position: { x: 0, y: 0 } });
store.dispatch('AddNode', { nodeId: 'n2', type: 'message', position: { x: 100, y: 0 } });
assert.equal(Object.keys(store.getGraphDocument().nodes).length, 2);

const ops = documentToBootstrapOperations(store.getGraphDocument());
assert.ok(ops.every((op) => GRAPH_OPERATION_TYPES.includes(op.type)));

store.dispatch('RemoveNode', { nodeId: 'n2' });
assert.equal(Object.keys(store.getGraphDocument().nodes).length, 1);
store.undo();
assert.equal(Object.keys(store.getGraphDocument().nodes).length, 2);
store.redo();
assert.equal(Object.keys(store.getGraphDocument().nodes).length, 1);

const graphFacade = {
  dispatch: (type, payload, meta) => store.dispatch(type, payload, meta),
  getGraphDocument: () => store.getGraphDocument(),
};
migrateGraphDocument(graphFacade, stacksToGraphDocument([{
  id: 's1',
  x: 0,
  y: 0,
  blocks: [{ id: 'a', type: 'start', props: {} }],
}]), { clear: true });
assert.equal(Object.keys(store.getGraphDocument().nodes).length, 1);
assert.equal(store.getGraphDocument().nodes.a.type, 'start');

console.log('test_single_mutation_model.js: ok');
