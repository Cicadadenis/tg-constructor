/**
 * Compiler ↔ VM separation contract tests.
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
  dispatchValidatedOperations,
} from '../../src/constructor/graph_document/graph_operation_client.js';
import { appendStacks } from '../../src/constructor/graph_document/graph_ui_orchestrator.js';
import {
  compileAppendStacks,
  compileMoveStack,
  UI_COMPOSITION_COMPILE_FNS,
  COMPILER_LAYER,
} from '../../src/constructor/graph_document/graph_ui_compositions.js';
import {
  RUNTIME_CLIENT_LAYER,
  VM_LAYER,
  validateCompiledComposition,
  scanCompilerLayerSource,
  scanRuntimeClientSource,
} from '../../src/constructor/graph_document/graph_compiler_vm_contract.js';
import { graphDocumentToStacks, stacksToGraphDocument } from '../../src/constructor/graph_document/stacks_bridge.js';
import { migrateGraphDocument } from '../../src/constructor/graph_document/graph_migration.js';

const root = path.join(fileURLToPath(new URL('../..', import.meta.url)));
const docDir = path.join(root, 'src/constructor/graph_document');

const compilerSource = fs.readFileSync(path.join(docDir, 'graph_ui_compositions.js'), 'utf8');
const clientSource = fs.readFileSync(path.join(docDir, 'graph_operation_client.js'), 'utf8');
const vmSource = fs.readFileSync(path.join(docDir, 'graph_operations.js'), 'utf8');
const contractSource = fs.readFileSync(path.join(docDir, 'graph_compiler_vm_contract.js'), 'utf8');

assert.equal(COMPILER_LAYER, 'graph_ui_compositions');
assert.equal(RUNTIME_CLIENT_LAYER, 'graph_operation_client');
assert.equal(VM_LAYER, 'graph_operations');

assert.ok(compilerSource.includes('COMPILER_LAYER'));
assert.ok(clientSource.includes('RUNTIME_CLIENT_LAYER'));
assert.ok(vmSource.includes('VM_LAYER'));

const compilerHits = scanCompilerLayerSource(compilerSource, {
  filePath: 'graph_ui_compositions.js',
});
assert.equal(compilerHits.length, 0, JSON.stringify(compilerHits));

const clientHits = scanRuntimeClientSource(clientSource);
assert.equal(clientHits.length, 0, JSON.stringify(clientHits));

assert.ok(!clientSource.match(/export\s+function\s+compile[A-Z]/));
assert.ok(vmSource.includes('applyOperation'));
assert.ok(!vmSource.match(/export\s+function\s+compileMoveStack/));
assert.ok(!compilerSource.match(/\bapplyOperation\s*\(/));
assert.ok(!compilerSource.match(/\bcreateGraphEditorStore\s*\(/));

assert.ok(contractSource.includes('validateCompositionOperationPayload'));
assert.ok(contractSource.includes('PAYLOAD_RULES') || contractSource.includes('validateCompositionOperationPayload'));

function makeGraph(store) {
  return {
    dispatch: (...args) => store.dispatch(...args),
    getGraphDocument: () => store.getGraphDocument(),
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
  const edges = Object.values(doc.edges || {}).map((e) => `${e.source}->${e.target}`).sort();
  return { nodes, edges };
}

const incoming = [
  {
    id: 's1',
    x: 10,
    y: 20,
    blocks: [
      { id: 'a', type: 'start', props: {} },
      { id: 'b', type: 'message', props: { text: 'x' } },
    ],
  },
];

for (const name of UI_COMPOSITION_COMPILE_FNS) {
  const fn = globalThis[name];
  assert.equal(typeof fn, 'undefined', `compile fn must not leak to global: ${name}`);
}

const compiled = compileAppendStacks(incoming);
const validated = validateCompiledComposition(compiled);
assert.equal(validated.ok, true, validated.error);
for (const op of validated.operations) {
  assert.ok(GRAPH_OPERATION_TYPES.includes(op.type));
}

const viaApply = createGraphEditorStore();
applyComposition(makeGraph(viaApply), compiled);

const viaDirect = createGraphEditorStore();
dispatchValidatedOperations(makeGraph(viaDirect), validated.operations);

assert.deepEqual(
  layoutSnapshot(viaApply.getGraphDocument()),
  layoutSnapshot(viaDirect.getGraphDocument()),
  'applyComposition ≡ dispatchValidatedOperations',
);

const vmReplay = replayOperations(
  createGraphDocument({}),
  validated.operations.map((op) => createOperation(op.type, op.payload)),
);
assert.equal(vmReplay.ok, true);
assert.deepEqual(
  layoutSnapshot(viaApply.getGraphDocument()),
  layoutSnapshot(vmReplay.document),
  'store apply ≡ VM replay',
);

const moveStore = createGraphEditorStore();
migrateStacks(moveStore, incoming);
const stacks = graphDocumentToStacks(moveStore.getGraphDocument());
const moveCompiled = compileMoveStack(stacks, stacks[0].id, 99, 88);
assert.equal(validateCompiledComposition(moveCompiled).ok, true);

const moveApply = createGraphEditorStore();
migrateStacks(moveApply, incoming);
const stacksA = graphDocumentToStacks(moveApply.getGraphDocument());
applyComposition(makeGraph(moveApply), compileMoveStack(stacksA, stacksA[0].id, 99, 88));

const moveDirect = createGraphEditorStore();
migrateStacks(moveDirect, incoming);
for (const op of moveCompiled.operations) {
  moveDirect.dispatch(op.type, op.payload);
}

assert.deepEqual(
  moveApply.getGraphDocument().nodes.a.position,
  moveDirect.getGraphDocument().nodes.a.position,
);

const det1 = createGraphEditorStore();
const det2 = createGraphEditorStore();
applyComposition(makeGraph(det1), compiled);
applyComposition(makeGraph(det2), compiled);
assert.deepEqual(
  det1.getGraphDocument().metadata.revision,
  det2.getGraphDocument().metadata.revision,
  'deterministic revision for identical compiled streams',
);

const badCompiled = { ok: true, operations: [{ type: 'NotARealOp', payload: {} }] };
assert.equal(validateCompiledComposition(badCompiled).ok, false);

const vmOnly = applyOperation(createGraphDocument({}), createOperation('AddNode', {
  nodeId: 'z',
  type: 'start',
  position: { x: 0, y: 0 },
}));
assert.equal(vmOnly.ok, true);

console.log('test_vm_compiler_separation.js: ok');
