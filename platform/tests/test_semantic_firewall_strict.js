/**
 * Strict semantic firewall — formal compiler / runtime / VM isolation.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGraphEditorStore } from '../../src/constructor/graph_document/graph_editor_store.js';
import { GRAPH_OPERATION_TYPES } from '../../src/constructor/graph_document/graph_schema.js';
import { createGraphDocument } from '../../src/constructor/graph_document/graph_document.js';
import { applyOperation, createOperation } from '../../src/constructor/graph_document/graph_operations.js';
import { replayOperations } from '../../src/constructor/graph_document/graph_history.js';
import {
  applyComposition,
  dispatchOp,
} from '../../src/constructor/graph_document/graph_operation_client.js';
import {
  appendStacks,
  moveStack,
} from '../../src/constructor/graph_document/graph_ui_orchestrator.js';
import {
  compileAppendStacks,
  validateCompositionOperations,
} from '../../src/constructor/graph_document/graph_ui_compositions.js';
import {
  STRICT_VM_SEMANTICS_MODE,
  analyzeLayerDependencyGraph,
  scanCompilerLayerSource,
  scanRuntimeClientSource,
  scanVmLayerSource,
  validateStrictDispatch,
  FORBIDDEN_LAYER_IMPORTS,
} from '../../src/constructor/graph_document/graph_compiler_vm_contract.js';
import { scanLayerDependencyViolations } from '../../src/constructor/graph_document/graph_composition_guard.js';
import { graphDocumentToStacks, stacksToGraphDocument } from '../../src/constructor/graph_document/stacks_bridge.js';
import { migrateGraphDocument } from '../../src/constructor/graph_document/graph_migration.js';

const root = path.join(fileURLToPath(new URL('../..', import.meta.url)));
const docDir = path.join(root, 'src/constructor/graph_document');

function readModule(name) {
  const filePath = path.join(docDir, name);
  return { filePath, source: fs.readFileSync(filePath, 'utf8') };
}

assert.equal(STRICT_VM_SEMANTICS_MODE, true);

const compiler = readModule('graph_ui_compositions.js');
const client = readModule('graph_operation_client.js');
const orchestrator = readModule('graph_ui_orchestrator.js');
const vm = readModule('graph_operations.js');

assert.equal(scanCompilerLayerSource(compiler.source, { filePath: compiler.filePath }).length, 0);
assert.equal(scanRuntimeClientSource(client.source, { filePath: client.filePath }).length, 0);
assert.equal(scanVmLayerSource(vm.source, { filePath: vm.filePath }).length, 0);

assert.ok(!client.source.includes("from './graph_ui_compositions.js'"));
assert.ok(!compiler.source.includes("from './graph_operations.js'"));
assert.ok(!vm.source.includes("from './graph_ui_compositions.js'"));
assert.ok(!vm.source.includes("from './graph_operation_client.js'"));
assert.ok(orchestrator.source.includes('graph_ui_compositions'));
assert.ok(orchestrator.source.includes('graph_operation_client'));

const graphScan = scanLayerDependencyViolations([
  compiler,
  client,
  orchestrator,
  vm,
]);
assert.equal(graphScan.hits.length, 0, JSON.stringify(graphScan.hits, null, 2));

for (const [layer, blocked] of Object.entries(FORBIDDEN_LAYER_IMPORTS)) {
  assert.ok(Array.isArray(blocked) && blocked.length > 0, layer);
}

function makeGraph(store) {
  return {
    dispatch: (...args) => store.dispatch(...args),
    getGraphDocument: () => store.getGraphDocument(),
  };
}

function migrateStacks(store, stacks) {
  return migrateGraphDocument(makeGraph(store), stacksToGraphDocument(stacks), { clear: true });
}

const badDispatch = validateStrictDispatch('FakeOp', {});
assert.equal(badDispatch.ok, false);

const badPayload = validateStrictDispatch('MoveNode', { nodeId: 'a' });
assert.equal(badPayload.ok, false);

const incoming = [
  {
    id: 's1',
    x: 0,
    y: 0,
    blocks: [
      { id: 'n1', type: 'start', props: {} },
      { id: 'n2', type: 'message', props: { text: 'hi' } },
    ],
  },
];

const compiled = compileAppendStacks(incoming);
assert.equal(validateCompositionOperations(compiled.operations).ok, true);
for (const op of compiled.operations) {
  assert.ok(GRAPH_OPERATION_TYPES.includes(op.type));
}

const storeA = createGraphEditorStore();
applyComposition(makeGraph(storeA), compiled);

const storeB = createGraphEditorStore();
appendStacks(makeGraph(storeB), [], incoming);

function snap(doc) {
  return JSON.stringify({
    nodes: Object.keys(doc.nodes).sort(),
    edges: Object.keys(doc.edges).sort(),
  });
}

assert.equal(snap(storeA.getGraphDocument()), snap(storeB.getGraphDocument()));

const bypassStore = createGraphEditorStore();
const bypass = applyComposition(makeGraph(bypassStore), {
  ok: true,
  operations: [{ type: 'NotReal', payload: {} }],
});
assert.equal(bypass.ok, false);

const strictBypass = dispatchOp(makeGraph(createGraphEditorStore()), 'MutateGraph', {});
assert.equal(strictBypass.ok, false);

const vmReplay = replayOperations(
  createGraphDocument({}),
  compiled.operations.map((op) => createOperation(op.type, op.payload)),
);
assert.equal(vmReplay.ok, true);

const det1 = createGraphEditorStore();
const det2 = createGraphEditorStore();
applyComposition(makeGraph(det1), compiled);
applyComposition(makeGraph(det2), compiled);
assert.equal(
  det1.getGraphDocument().metadata.revision,
  det2.getGraphDocument().metadata.revision,
);

const moveStore = createGraphEditorStore();
migrateStacks(moveStore, incoming);
const stacks = graphDocumentToStacks(moveStore.getGraphDocument());
moveStack(makeGraph(moveStore), stacks, stacks[0].id, 50, 50);
assert.equal(moveStore.getGraphDocument().nodes.n1.position.x, 50);

const vmOnly = applyOperation(createGraphDocument({}), createOperation('AddNode', {
  nodeId: 'solo',
  type: 'start',
  position: { x: 1, y: 2 },
}));
assert.equal(vmOnly.ok, true);

console.log('test_semantic_firewall_strict.js: ok');
