import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import { createGraphHistory, applyOperation as applyHistoryOperation } from './graph_history.js';
import { createOperation } from './graph_operations.js';
import { persistCanvasBlob, loadPersistedCanvasBlob } from './persist_bridge.js';
import { strictCompileValidation } from './graph_validation_pipeline.js';
import { compileGraphToPython } from '../../../core/codegen/pipeline.js';
import { graphDocumentToProjectGraph } from './graph_project_bridge.js';
import { projectGraphToFlow } from '../../../core/graph/model.js';
import { migrateLegacyGraph } from '../aiogram3Migration.js';
import { clearGraph } from './graph_ui_orchestrator.js';
import { createGraphEditorStore } from './graph_editor_store.js';

// Simulate: user deletes all nodes visually but legacy autosave had invalid edges
{
  const corrupted = {
    schema_version: 1,
    nodes: [],
    edges: [
      { id: 'ghost_e1', source: 'deleted_a', target: 'deleted_b', invalid: true },
      { id: 'ghost_e2', source: 'x', target: 'y' },
    ],
    metadata: {
      hydrationDiagnostics: { orphanEdgeCount: 5, orphanEdges: [{ id: 'old' }] },
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    ui_state: { selection: ['deleted_a'], collapsed: [], groups: [] },
  };
  const loaded = loadPersistedCanvasBlob(corrupted);
  assert.equal(Object.keys(loaded.document.nodes).length, 0);
  assert.equal(Object.keys(loaded.document.edges).length, 0);
  assert.equal(loaded.document.ui_state.selection.length, 0);
  const gate = strictCompileValidation(loaded.document);
  assert.equal(gate.ok, true, 'compile gate must pass after sanitize');
  const flow = migrateLegacyGraph(projectGraphToFlow(graphDocumentToProjectGraph(loaded.document)));
  const out = compileGraphToPython(flow, { graphDocument: loaded.document, strict: true });
  assert.equal(out.empty, true);
  assert.equal(out.compileErrors?.length || 0, 0);
}

// Persist round-trip never writes invalid edges
{
  const doc = createGraphDocument({
    nodes: [{ id: 's', type: 'start', position: { x: 0, y: 0 } }],
    edges: [{ id: 'e', source: 's', target: 'missing' }],
  });
  const blob = persistCanvasBlob(doc);
  assert.equal(blob.edges.length, 0);
}

// clearGraph after partial delete leaves compile clean
{
  const history = createGraphHistory(createGraphDocument({
    nodes: [
      { id: 'st', type: 'start', position: { x: 0, y: 0 } },
      { id: 'm', type: 'message', position: { x: 0, y: 80 }, data: { text: 'x' } },
    ],
    edges: [{ id: 'e', source: 'st', target: 'm' }],
  }));
  let h = applyHistoryOperation(history, createOperation('RemoveNode', { nodeId: 'm' }));
  assert.equal(Object.keys(h.document.edges).length, 0);
  const store = createGraphEditorStore(h.document);
  clearGraph({
    getGraphDocument: () => store.document,
    dispatch: (t, p) => store.dispatch(t, p),
  });
  assert.equal(strictCompileValidation(store.document).ok, true);
}

console.log('graph_corruption.test.js: ok');
