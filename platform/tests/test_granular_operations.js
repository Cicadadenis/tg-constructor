/**
 * Granular graph operations — no snapshot ReplaceGraphDocument in runtime UI.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGraphEditorStore } from '../../src/constructor/graph_document/graph_editor_store.js';
import { GRAPH_OPERATION_TYPES } from '../../src/constructor/graph_document/graph_schema.js';
import { documentToBootstrapOperations } from '../../src/constructor/graph_document/graph_import.js';
import { migrateGraphDocument } from '../../src/constructor/graph_document/graph_migration.js';
import { moveStack, appendStacks, removeNode } from '../../src/constructor/graph_document/graph_ui_orchestrator.js';
import { createGraphDocument } from '../../src/constructor/graph_document/graph_document.js';
import { scanSourceForForbiddenGraphMutations } from '../../src/constructor/graph_document/graph_mutation_guard.js';

const root = path.join(fileURLToPath(new URL('../..', import.meta.url)));
const appSource = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');

assert.ok(!GRAPH_OPERATION_TYPES.includes('ReplaceGraphDocument'));
assert.ok(GRAPH_OPERATION_TYPES.includes('RemoveNode'));
assert.ok(GRAPH_OPERATION_TYPES.includes('AddEdge'));
assert.ok(GRAPH_OPERATION_TYPES.includes('UpdateEdge'));

assert.ok(!appSource.includes('ReplaceGraphDocument'), 'App must not dispatch ReplaceGraphDocument');
assert.ok(!appSource.includes('buildReplaceGraphFromStacks'), 'App must not use buildReplaceGraphFromStacks');

const forbidden = scanSourceForForbiddenGraphMutations(appSource);
assert.equal(forbidden.length, 0, JSON.stringify(forbidden));

const store = createGraphEditorStore();
const graph = {
  dispatch: (...args) => store.dispatch(...args),
  getGraphDocument: () => store.getGraphDocument(),
  importGraph: (doc) => migrateGraphDocument(graph, doc),
};

store.dispatch('AddNode', { nodeId: 'a', type: 'start', position: { x: 10, y: 10 } });
store.dispatch('AddNode', { nodeId: 'b', type: 'message', position: { x: 10, y: 122 } });
store.dispatch('AddEdge', { edgeId: 'e_ab', source: 'a', target: 'b' });

const stacks = [{ id: 'stack_a', x: 10, y: 10, blocks: [{ id: 'a', type: 'start', props: {} }, { id: 'b', type: 'message', props: {} }] }];
moveStack(graph, stacks, 'stack_a', 50, 60);
assert.equal(store.getGraphDocument().nodes.a.position.x, 50);
assert.equal(store.getGraphDocument().nodes.b.position.y, 60 + 112);

store.undo();
store.undo();
assert.equal(store.getGraphDocument().nodes.a.position.x, 10);

store.redo();
store.redo();
assert.equal(store.getGraphDocument().nodes.a.position.x, 50);

removeNode(graph, 'b');
assert.equal(store.getGraphDocument().nodes.b, undefined);
assert.equal(Object.values(store.getGraphDocument().edges).length, 0);

store.undo();
assert.ok(store.getGraphDocument().nodes.b);

const fresh = createGraphEditorStore();
const bootstrap = documentToBootstrapOperations(createGraphDocument({
  nodes: [{ id: 'n1', type: 'start', position: { x: 0, y: 0 } }],
  edges: [],
}));
assert.equal(bootstrap.length, 1);
assert.equal(bootstrap[0].type, 'AddNode');
migrateGraphDocument(
  { dispatch: (...a) => fresh.dispatch(...a), getGraphDocument: () => fresh.getGraphDocument() },
  createGraphDocument({ nodes: [{ id: 'n1', type: 'start', position: { x: 0, y: 0 } }], edges: [] }),
);
assert.ok(fresh.getGraphDocument().nodes.n1);

console.log('test_granular_operations.js: ok');
