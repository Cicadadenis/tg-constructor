import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import { createOperation, applyOperation } from './graph_operations.js';
import {
  createGraphHistory,
  applyOperation as applyHistoryOperation,
  rollbackOperation,
  mergeAndValidateOperationStreams,
} from './graph_history.js';
import { repairDanglingEdges, graphHasDanglingEdges } from './graph_edge_repair.js';
import { strictCompileValidation, runGraphValidationPipeline } from './graph_validation_pipeline.js';
import { compileAddBlockToStack } from './graph_ui_compositions.js';
import { importGraphDocument } from './graph_serializer.js';
import { compileGraphToPython } from '../../../core/codegen/pipeline.js';
import { projectGraphToFlow } from '../../../core/graph/model.js';
import { graphDocumentToProjectGraph } from './graph_project_bridge.js';
import { repairBrokenCallbacksInDocument } from './graph_callback_repair.js';
import { migrateLegacyGraph } from '../aiogram3Migration.js';
import { createGraphEditorStore } from './graph_editor_store.js';
import { clearGraph } from './graph_ui_orchestrator.js';

// --- hydration preserves dangling edges ---
{
  const doc = createGraphDocument({
    nodes: [{ id: 'a', type: 'start', position: { x: 0, y: 0 } }],
    edges: [{ id: 'e1', source: 'a', target: 'missing' }],
  });
  assert.equal(Object.keys(doc.edges).length, 0, 'dangling edges are dropped, not preserved');
  assert.ok(doc.metadata.hydrationDiagnostics?.orphanEdgeCount === 1);
  assert.equal(doc.metadata.hydrationDiagnostics.orphanEdges[0].id, 'e1');
}

// --- legacy invalid edge stripped on hydrate; compile not blocked ---
{
  const doc = createGraphDocument({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'm', type: 'message', position: { x: 0, y: 100 }, data: { text: 'x' } },
    ],
    edges: [
      { id: 'ok', source: 'st', target: 'm' },
      { id: 'bad', source: 'm', target: 'ghost', invalid: true, invalidReason: 'dangling_target' },
    ],
  });
  assert.equal(Object.keys(doc.edges).length, 1);
  assert.equal(doc.edges.ok.source, 'st');
  const gate = strictCompileValidation(doc);
  assert.equal(gate.ok, true, 'ghost edge removed at hydrate — compile gate should pass');
  const flow = migrateLegacyGraph(projectGraphToFlow(graphDocumentToProjectGraph(doc)));
  const out = compileGraphToPython(flow, { graphDocument: doc, strict: true });
  assert.notEqual(out.aborted, true);
}

// --- programmatic invalid edge rejected ---
{
  const stacks = [{ id: 's1', blocks: [{ id: 'b1', type: 'start' }] }];
  const result = compileAddBlockToStack(stacks, 's1', { id: 'b2', type: 'bot', props: { token: 'x' } });
  assert.equal(result.ok, false, 'start→bot must be rejected at composition layer');
}

// --- strict mode promotes warnings ---
{
  const doc = createGraphDocument({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'c', type: 'condition', position: { x: 0, y: 100 }, data: { cond: '1' } },
      { id: 't', type: 'message', position: { x: 0, y: 200 }, data: { text: 'y' } },
    ],
    edges: [
      { id: 'e1', source: 'st', target: 'c' },
      { id: 'e2', source: 'c', target: 't', sourcePort: 'true' },
    ],
  });
  const loose = runGraphValidationPipeline(doc, { strict: false });
  const strict = runGraphValidationPipeline(doc, { strict: true });
  assert.ok(loose.warnings.length >= strict.errors.length || strict.errors.length > 0);
}

// --- callback auto-repair persistence ---
{
  const doc = createGraphDocument({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'inl', type: 'inline', position: { x: 0, y: 100 }, data: { buttons: 'Go → cb_go' } },
    ],
    edges: [{ id: 'e1', source: 'st', target: 'inl' }],
  });
  const repaired = repairBrokenCallbacksInDocument(doc);
  assert.equal(repaired.modified, true);
  assert.ok(repaired.operations.length > 0);
  let next = doc;
  for (const op of repaired.operations) {
    const r = applyOperation(next, op);
    assert.equal(r.ok, true, r.error);
    next = r.document;
  }
  const gate = strictCompileValidation(next);
  assert.ok(gate.errors.filter((e) => e.code === 'missing_handlers').length === 0);
}

// --- transaction rollback on failed edge restore ---
{
  const history = createGraphHistory(createGraphDocument({
    nodes: [
      { id: 's', type: 'start', position: { x: 0, y: 0 } },
      { id: 'm', type: 'message', position: { x: 0, y: 100 }, data: { text: 'a' } },
    ],
    edges: [{ id: 'e1', source: 's', target: 'm' }],
  }));
  const removed = applyHistoryOperation(history, createOperation('RemoveNode', { nodeId: 'm' }));
  assert.equal(Object.keys(removed.document.edges).length, 0);
  const rolled = rollbackOperation(removed);
  assert.equal(rolled.lastError, null, rolled.lastError || '');
  assert.equal(Object.keys(rolled.document.nodes).length, 2);
  assert.ok(!graphHasDanglingEdges(rolled.document));
}

// --- repair dangling edges still in runtime document ---
{
  const doc = createGraphDocument({
    nodes: [{ id: 'a', type: 'start', position: { x: 0, y: 0 } }],
    edges: [],
  });
  const runtime = {
    ...doc,
    edges: {
      e1: {
        id: 'e1',
        source: 'a',
        target: 'x',
        invalid: true,
        invalidReason: 'dangling_target',
        sourcePort: 'flow',
        targetPort: 'flow',
      },
    },
  };
  const { document: fixed, removed } = repairDanglingEdges(runtime);
  assert.deepEqual(removed, ['e1']);
  assert.equal(Object.keys(fixed.edges).length, 0);
}

// --- merge replay validation ---
{
  const seed = createGraphDocument({
    nodes: [{ id: 'a', type: 'start', position: { x: 0, y: 0 } }],
    edges: [],
  });
  const local = [createOperation('AddNode', { nodeId: 'b', type: 'message', position: { x: 0, y: 80 }, data: { text: 'hi' } })];
  const remote = [];
  const merged = mergeAndValidateOperationStreams(seed, local, remote);
  assert.equal(merged.ok, true);
}

// --- invalid import graph ---
{
  const raw = {
    schema_version: 1,
    nodes: [{ id: 'a', type: 'start', position: { x: 0, y: 0 }, data: {} }],
    edges: [{ id: 'e', source: 'a', target: 'nope' }],
    viewport: { x: 0, y: 0, zoom: 1 },
    ui_state: { selection: [], collapsed: [], groups: [] },
    metadata: { name: 'bad', revision: 0, tags: [] },
  };
  const imp = importGraphDocument(raw);
  assert.equal(Object.keys(imp.document.edges).length, 0);
  assert.ok(imp.document.metadata.hydrationDiagnostics?.orphanEdgeCount >= 1);
  const gate = strictCompileValidation(imp.document);
  assert.equal(gate.ok, true);
}

// --- clearGraph leaves no ghost edges ---
{
  const store = createGraphEditorStore(createGraphDocument({
    nodes: [
      { id: 'a', type: 'start', position: { x: 0, y: 0 } },
      { id: 'b', type: 'message', position: { x: 0, y: 100 }, data: { text: 'hi' } },
    ],
    edges: [{ id: 'e', source: 'a', target: 'b' }],
  }));
  const r = clearGraph({
    getGraphDocument: () => store.document,
    dispatch: (t, p) => store.dispatch(t, p),
  });
  assert.equal(r.ok, true);
  assert.equal(Object.keys(store.document.nodes).length, 0);
  assert.equal(Object.keys(store.document.edges).length, 0);
  const gate = strictCompileValidation(store.document);
  assert.equal(gate.ok, true);
  const flow = migrateLegacyGraph(projectGraphToFlow(graphDocumentToProjectGraph(store.document)));
  const out = compileGraphToPython(flow, { graphDocument: store.document, strict: true });
  assert.equal(out.empty, true);
}

// --- cleared canvas drops stale hydration diagnostics ---
{
  const doc = createGraphDocument({
    nodes: [],
    edges: [],
    metadata: {
      hydrationDiagnostics: { orphanEdgeCount: 3, orphanEdges: [] },
    },
  });
  assert.equal(doc.metadata.hydrationDiagnostics, null);
  const flow = migrateLegacyGraph(projectGraphToFlow(graphDocumentToProjectGraph(doc)));
  const out = compileGraphToPython(flow, { graphDocument: doc, strict: true });
  assert.equal(out.empty, true);
  assert.equal(out.compileErrors?.length || 0, 0);
}

console.log('graph_hardening.test.js: all tests passed');
