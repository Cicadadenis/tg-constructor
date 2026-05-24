import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import { createGraphEditorStore } from './graph_editor_store.js';
import { createOperation, applyOperation } from './graph_operations.js';
import {
  createGraphHistory,
  applyOperation as applyHistoryOperation,
  rollbackOperation,
  replayOperations,
  mergeOperationStreams,
} from './graph_history.js';
import { exportGraphDocument, importGraphDocument } from './graph_serializer.js';
import { validateGraphDocument } from './graph_validator.js';
import { canvasEventToOperation } from './graph_projection.js';
import { scanSourceForForbiddenGraphMutations } from './graph_mutation_guard.js';
import { documentToBootstrapOperations } from './graph_import.js';
import { replayBootstrapOperations } from './graph_migration.js';

const store = createGraphEditorStore();
let r = store.dispatch('AddNode', { nodeId: 'a', type: 'start', position: { x: 0, y: 0 } });
assert.equal(r.ok, true);
r = store.dispatch('AddNode', { nodeId: 'b', type: 'message', position: { x: 200, y: 0 } });
assert.equal(r.ok, true);
r = store.dispatch('AddEdge', { edgeId: 'e1', source: 'a', target: 'b' });
assert.equal(r.ok, true);
assert.equal(Object.keys(store.document.edges).length, 1);

const validation = validateGraphDocument(store.document);
assert.equal(validation.ok, true, JSON.stringify(validation.issues));

const projection = store.getCanvasProjection();
assert.equal(projection.__fromGraphProjection, true);
assert.equal(projection.nodes.length, 2);
assert.equal(projection.edges.length, 1);

r = store.dispatch('RemoveNode', { nodeId: 'b' });
assert.equal(r.ok, true);
const afterRemove = store.document;
assert.equal(Object.keys(afterRemove.edges).length, 0, 'edge removed with deleted node');
store.undo();
assert.equal(Object.keys(store.document.nodes).length, 2);
assert.equal(Object.keys(store.document.edges).length, 1);
store.redo();
assert.equal(Object.keys(store.document.nodes).length, 1);
assert.equal(Object.keys(store.document.edges).length, 0);

const bootstrap = documentToBootstrapOperations(createGraphDocument({
  nodes: [{ id: 'z', type: 'start', position: { x: 1, y: 2 } }],
  edges: [],
}));
assert.equal(bootstrap.length, 1);
const imported = createGraphEditorStore();
replayBootstrapOperations(imported, bootstrap);
assert.equal(imported.document.nodes.z.type, 'start');

const history = createGraphHistory();
const h1 = applyHistoryOperation(history, createOperation('AddNode', { nodeId: 'x', type: 'global' }));
const rolled = rollbackOperation(h1);
assert.equal(Object.keys(rolled.document.nodes).length, 0);
const h2 = applyHistoryOperation(rolled, createOperation('AddNode', { nodeId: 'x', type: 'global' }));
assert.equal(Object.keys(h2.document.nodes).length, 1);

const exported = exportGraphDocument(store.document);
const imp = importGraphDocument(exported);
assert.equal(imp.document.schema_version, 2);

const replayed = replayOperations({}, [
  createOperation('AddNode', { nodeId: 'r1', type: 'start' }),
  createOperation('AddNode', { nodeId: 'r2', type: 'message' }),
]);
assert.equal(replayed.ok, true);
assert.equal(Object.keys(replayed.document.nodes).length, 2);

const bad = applyOperation(createGraphDocument({}), createOperation('AddEdge', {
  edgeId: 'e',
  source: 'missing',
  target: 'also',
}));
assert.equal(bad.ok, false);

const hits = scanSourceForForbiddenGraphMutations('const [nodes, setNodes] = useState([]);');
assert.ok(hits.length > 0);

const opFromCanvas = canvasEventToOperation({
  kind: 'node_move',
  nodeId: 'a',
  position: { x: 10, y: 20 },
});
assert.equal(opFromCanvas.type, 'MoveNode');

const merged = mergeOperationStreams(
  [createOperation('AddNode', { nodeId: 'm1', type: 'start' }, { id: 'op1', timestamp: 1 })],
  [createOperation('AddNode', { nodeId: 'm2', type: 'msg' }, { id: 'op2', timestamp: 2, baseRevision: 1 })],
  { localRevision: 1, strict: true },
);
assert.equal(merged.length, 2);

const conflict = applyHistoryOperation(
  h2,
  createOperation('AddNode', { nodeId: 'conflict', type: 'global' }, { baseRevision: 0 }),
);
assert.equal(conflict.lastError?.includes('Revision conflict'), true);

const det1 = replayOperations({}, [
  createOperation('AddNode', { nodeId: 'd1', type: 'start' }),
  createOperation('MoveNode', { nodeId: 'd1', position: { x: 5, y: 5 } }),
]);
const det2 = replayOperations({}, [
  createOperation('AddNode', { nodeId: 'd1', type: 'start' }),
  createOperation('MoveNode', { nodeId: 'd1', position: { x: 5, y: 5 } }),
]);
assert.equal(
  det1.document.nodes.d1.position.x,
  det2.document.nodes.d1.position.x,
);

console.log('graph_document.test.js: ok');
