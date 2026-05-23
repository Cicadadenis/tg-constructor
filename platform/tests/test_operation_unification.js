/**
 * Operation domain consolidation — stack helpers must reduce to canonical GRAPH_OPERATION_TYPES.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGraphEditorStore } from '../../src/constructor/graph_document/graph_editor_store.js';
import { GRAPH_OPERATION_TYPES } from '../../src/constructor/graph_document/graph_schema.js';
import { GraphOperations } from '../../src/constructor/graph_document/graph_operation_client.js';
import {
  appendStacks,
  mergeStacks,
  moveStack,
  removeNode,
} from '../../src/constructor/graph_document/graph_ui_orchestrator.js';
import {
  documentToBootstrapOperations,
} from '../../src/constructor/graph_document/graph_import.js';
import { migrateGraphDocument } from '../../src/constructor/graph_document/graph_migration.js';
import { createGraphDocument } from '../../src/constructor/graph_document/graph_document.js';
import { graphDocumentToStacks, stacksToGraphDocument } from '../../src/constructor/graph_document/stacks_bridge.js';

const root = path.join(fileURLToPath(new URL('../..', import.meta.url)));

const stackOpsSource = fs.readFileSync(
  path.join(root, 'src/constructor/graph_document/graph_stack_ops.js'),
  'utf8',
);
assert.ok(
  stackOpsSource.includes('@deprecated'),
  'graph_stack_ops.js must be marked deprecated',
);
assert.ok(
  stackOpsSource.includes("from './graph_ui_orchestrator.js'"),
  'graph_stack_ops.js must re-export via orchestrator shim',
);
assert.ok(
  !stackOpsSource.includes('function moveStack'),
  'graph_stack_ops.js must not define stack operations',
);
assert.ok(
  !stackOpsSource.includes('function mergeStacks'),
  'graph_stack_ops.js must not define mergeStacks',
);

const clientSource = fs.readFileSync(
  path.join(root, 'src/constructor/graph_document/graph_operation_client.js'),
  'utf8',
);
const compositionsSource = fs.readFileSync(
  path.join(root, 'src/constructor/graph_document/graph_ui_compositions.js'),
  'utf8',
);
assert.ok(compositionsSource.includes('export function compileMoveStack'));
assert.ok(!compositionsSource.includes('.dispatch('), 'UI compiler must not dispatch');
assert.ok(!clientSource.includes('graph_ui_compositions'), 'client must not import compiler');
assert.ok(
  fs.readFileSync(path.join(root, 'src/constructor/graph_document/graph_ui_orchestrator.js'), 'utf8').includes('applyComposition'),
  'orchestrator must apply compiled ops',
);
const forbiddenDispatchTypes = ['ReplaceGraphDocument', 'MutateStacks', 'ReplaceStacks'];
for (const bad of forbiddenDispatchTypes) {
  assert.ok(!clientSource.includes(`'${bad}'`), `client must not dispatch ${bad}`);
}

for (const key of ['removeNode', 'moveNode', 'addNode', 'addEdge', 'patchNodeData', 'setNodeData']) {
  assert.equal(typeof GraphOperations[key], 'function', `GraphOperations.${key}`);
}
assert.deepEqual(GraphOperations.TYPES, GRAPH_OPERATION_TYPES);

function makeGraph(store) {
  return {
    dispatch: (...args) => store.dispatch(...args),
    getGraphDocument: () => store.getGraphDocument(),
    store,
  };
}

function migrateStacks(store, stacks) {
  return migrateGraphDocument(makeGraph(store), stacksToGraphDocument(stacks), { clear: true });
}

function layoutSnapshot(doc) {
  const nodes = {};
  for (const [id, node] of Object.entries(doc.nodes || {})) {
    nodes[id] = { type: node.type, position: node.position };
  }
  const edges = Object.values(doc.edges || {})
    .map((e) => `${e.source}->${e.target}`)
    .sort();
  return { nodes, edges };
}

// appendStacks ≡ bootstrap replay for the same stacks payload
const incoming = [
  {
    id: 's1',
    x: 40,
    y: 80,
    blocks: [
      { id: 'n1', type: 'start', props: {} },
      { id: 'n2', type: 'message', props: { text: 'hi' } },
    ],
  },
];

const viaAppend = createGraphEditorStore();
appendStacks(makeGraph(viaAppend), [], incoming);

const viaMigrate = createGraphEditorStore();
migrateStacks(viaMigrate, incoming);

assert.deepEqual(
  layoutSnapshot(viaAppend.getGraphDocument()),
  layoutSnapshot(viaMigrate.getGraphDocument()),
  'appendStacks layout matches stacksToGraphDocument replay',
);

// moveStack only changes positions (MoveNode semantics)
const moveStore = createGraphEditorStore();
migrateStacks(moveStore, incoming);
const graphMove = makeGraph(moveStore);
const stacksView = graphDocumentToStacks(moveStore.getGraphDocument());
moveStack(graphMove, stacksView, stacksView[0].id, 200, 300);
assert.equal(moveStore.getGraphDocument().nodes.n1.position.x, 200);
assert.equal(moveStore.getGraphDocument().nodes.n2.position.y, 300 + 112);
moveStore.undo();
moveStore.undo();
assert.equal(moveStore.getGraphDocument().nodes.n1.position.x, 40);

// mergeStacks bridge edge + reposition matches manual granular sequence
const twoStackSeed = [
  { id: 'sa', x: 10, y: 10, blocks: [{ id: 'a', type: 'start', props: {} }] },
  { id: 'sb', x: 200, y: 10, blocks: [{ id: 'b', type: 'message', props: {} }] },
];

const mergeSeed = createGraphEditorStore();
migrateStacks(mergeSeed, twoStackSeed);

const manual = createGraphEditorStore();
migrateStacks(manual, twoStackSeed);
const manualGraph = makeGraph(manual);
manualGraph.dispatch('AddEdge', { edgeId: 'edge_a_b', source: 'a', target: 'b' });
manualGraph.dispatch('MoveNode', { nodeId: 'b', position: { x: 10, y: 122 } });

const merged = createGraphEditorStore();
migrateStacks(merged, twoStackSeed);
const mergedStacks = graphDocumentToStacks(merged.getGraphDocument());
const dragStack = mergedStacks.find((s) => s.blocks[0]?.id === 'b');
const targetStack = mergedStacks.find((s) => s.blocks[0]?.id === 'a');
mergeStacks(makeGraph(merged), mergedStacks, dragStack.id, targetStack.id);

assert.deepEqual(
  JSON.parse(JSON.stringify(manual.getGraphDocument().edges)),
  JSON.parse(JSON.stringify(merged.getGraphDocument().edges)),
);
assert.deepEqual(
  manual.getGraphDocument().nodes.b.position,
  merged.getGraphDocument().nodes.b.position,
);

// removeNode clears incident edges (no stack-specific delete path)
const delStore = createGraphEditorStore();
migrateStacks(delStore, incoming);
removeNode(makeGraph(delStore), 'n1');
assert.equal(delStore.getGraphDocument().nodes.n1, undefined);
assert.equal(Object.keys(delStore.getGraphDocument().edges).length, 0);

// document import stream uses only canonical types
const bootstrap = documentToBootstrapOperations(createGraphDocument({
  nodes: [
    { id: 'x', type: 'start', position: { x: 0, y: 0 } },
    { id: 'y', type: 'message', position: { x: 0, y: 112 } },
  ],
  edges: [{ id: 'e_xy', source: 'x', target: 'y' }],
}));
assert.ok(bootstrap.every((op) => GRAPH_OPERATION_TYPES.includes(op.type)));

console.log('test_operation_unification.js: ok');
