/**
 * UI composition contract — stack helpers compile to GRAPH_OPERATION_TYPES only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGraphEditorStore } from '../../src/constructor/graph_document/graph_editor_store.js';
import { GRAPH_OPERATION_TYPES } from '../../src/constructor/graph_document/graph_schema.js';
import { applyComposition } from '../../src/constructor/graph_document/graph_operation_client.js';
import {
  moveStack,
  mergeStacks,
  appendStacks,
  removeNode,
} from '../../src/constructor/graph_document/graph_ui_orchestrator.js';
import {
  compileMoveStack,
  compileAppendStacks,
  compileMergeStacks,
  validateCompositionOperations,
  UI_COMPOSITION_COMPILE_FNS,
} from '../../src/constructor/graph_document/graph_ui_compositions.js';
import { migrateGraphDocument } from '../../src/constructor/graph_document/graph_migration.js';
import { graphDocumentToStacks, stacksToGraphDocument } from '../../src/constructor/graph_document/stacks_bridge.js';
import { scanSourceForHiddenCompositionDSL } from '../../src/constructor/graph_document/graph_composition_guard.js';

const root = path.join(fileURLToPath(new URL('../..', import.meta.url)));

const compositionsSource = fs.readFileSync(
  path.join(root, 'src/constructor/graph_document/graph_ui_compositions.js'),
  'utf8',
);
assert.ok(!compositionsSource.includes('graph.dispatch'), 'compiler must not dispatch');
assert.ok(!compositionsSource.includes('.dispatch('), 'compiler must not call dispatch');

const clientSource = fs.readFileSync(
  path.join(root, 'src/constructor/graph_document/graph_operation_client.js'),
  'utf8',
);
const orchestratorSource = fs.readFileSync(
  path.join(root, 'src/constructor/graph_document/graph_ui_orchestrator.js'),
  'utf8',
);
for (const name of ['moveStack', 'mergeStacks', 'appendStacks']) {
  assert.ok(
    orchestratorSource.includes(`compile${name.charAt(0).toUpperCase()}${name.slice(1)}`),
    `${name} must delegate to compile* in orchestrator`,
  );
  assert.ok(orchestratorSource.includes('applyComposition'), `${name} must use applyComposition`);
}
assert.ok(!clientSource.includes('graph_ui_compositions'), 'runtime client must not import compiler');

const stackOpsSource = fs.readFileSync(
  path.join(root, 'src/constructor/graph_document/graph_stack_ops.js'),
  'utf8',
);
assert.ok(!stackOpsSource.match(/function\s+\w+/), 'graph_stack_ops must have no function definitions');

function makeGraph(store) {
  return {
    dispatch: (...args) => store.dispatch(...args),
    getGraphDocument: () => store.getGraphDocument(),
  };
}

function migrateStacks(store, stacks) {
  return migrateGraphDocument(makeGraph(store), stacksToGraphDocument(stacks), { clear: true });
}

function assertCanonicalOps(operations) {
  const v = validateCompositionOperations(operations);
  assert.equal(v.ok, true, v.error);
  for (const op of operations) {
    assert.ok(GRAPH_OPERATION_TYPES.includes(op.type), `unexpected type ${op.type}`);
  }
}

for (const fn of UI_COMPOSITION_COMPILE_FNS) {
  assert.equal(typeof globalThis[fn], 'undefined');
}
assert.equal(UI_COMPOSITION_COMPILE_FNS.length, 8);

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

const compiledAppend = compileAppendStacks(incoming);
assertCanonicalOps(compiledAppend.operations);
assert.equal(compiledAppend.operations.length, 3);

const viaCompile = createGraphEditorStore();
applyComposition(makeGraph(viaCompile), compiledAppend);

const viaRunner = createGraphEditorStore();
appendStacks(makeGraph(viaRunner), [], incoming);

function layoutSnapshot(doc) {
  const nodes = {};
  for (const [id, node] of Object.entries(doc.nodes || {})) {
    nodes[id] = { type: node.type, position: node.position };
  }
  const edges = Object.values(doc.edges || {}).map((e) => `${e.source}->${e.target}`).sort();
  return { nodes, edges };
}

assert.deepEqual(
  layoutSnapshot(viaCompile.getGraphDocument()),
  layoutSnapshot(viaRunner.getGraphDocument()),
  'compile+apply ≡ appendStacks runner',
);

const moveStore = createGraphEditorStore();
migrateStacks(moveStore, incoming);
const stacksView = graphDocumentToStacks(moveStore.getGraphDocument());
const compiledMove = compileMoveStack(stacksView, stacksView[0].id, 200, 300);
assertCanonicalOps(compiledMove.operations);

const directMove = createGraphEditorStore();
migrateStacks(directMove, incoming);
const directStacks = graphDocumentToStacks(directMove.getGraphDocument());
applyComposition(makeGraph(directMove), compiledMove);

const runnerMove = createGraphEditorStore();
migrateStacks(runnerMove, incoming);
const runnerStacks = graphDocumentToStacks(runnerMove.getGraphDocument());
moveStack(makeGraph(runnerMove), runnerStacks, runnerStacks[0].id, 200, 300);

assert.deepEqual(
  directMove.getGraphDocument().nodes.n1.position,
  runnerMove.getGraphDocument().nodes.n1.position,
);

runnerMove.undo();
runnerMove.undo();
assert.equal(runnerMove.getGraphDocument().nodes.n1.position.x, 40);

const badDsl = "graph.dispatch('ReplaceGraphDocument', { document: {} });";
const hits = scanSourceForHiddenCompositionDSL(badDsl);
assert.ok(hits.length > 0, 'hidden DSL must be detected');

const appSource = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const appHits = scanSourceForHiddenCompositionDSL(appSource, { filePath: 'src/App.jsx' });
assert.equal(appHits.length, 0, JSON.stringify(appHits));

console.log('test_ui_composition_contract.js: ok');
