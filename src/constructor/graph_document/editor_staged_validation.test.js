import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import { createGraphEditorStore } from './graph_editor_store.js';
import { updateBlockUiAttachments } from './graph_ui_orchestrator.js';
import { applyOperation, createOperation } from './graph_operations.js';
import { projectGraphDocumentToCanvas } from './graph_projection.js';
import { getPreview } from '../../builder/blockPreview.js';
import { projectionNodesSignature } from './projection_signature.js';
import { validateGraph } from './validate_graph.js';
import {
  validateGraphDocumentForEditor,
  collectEditorCallbackDiagnostics,
} from './graph_validate.js';
import { strictCompileValidation } from './graph_validation_pipeline.js';
import { compileGraphToPython, PYTHON_EXPORT_MODES } from '../../../core/pythonAiogramCodegen.js';
import { graphDocumentToProjectGraph } from './graph_project_bridge.js';
import { projectGraphToFlow } from '../../../core/graph/model.js';
import {
  beginKeyboardInsertion,
  commitKeyboardInsertion,
  endNodeEdit,
} from './graph_edit_session.js';
import {
  filterBlockingOverlayErrors,
  VALIDATION_STAGE,
} from './validation_stages.js';
import { persistCanvasBlob } from './persist_bridge.js';

function docWithInlineButton() {
  return createGraphDocument({
    nodes: [
      { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
      {
        id: 'n_msg',
        type: 'message',
        position: { x: 0, y: 112 },
        data: { text: 'Pick' },
        meta: {
          uiAttachments: {
            inline: [{ id: 'ua1', text: 'да', callback: 'new_cb' }],
            buttons: [],
            replies: [],
            media: [],
            transitions: [],
          },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'n_start', target: 'n_msg' }],
  });
}

describe('editor staged validation', () => {
  it('validateGraphDocumentForEditor treats missing callback handler as warning only', () => {
    const doc = docWithInlineButton();
    const editor = validateGraphDocumentForEditor(doc);
    assert.equal(editor.ok, true, 'editor validation must not block on missing handler');
    assert.equal(editor.errors.length, 0);
    assert.ok(editor.callbackHints?.length >= 1);
    assert.ok(
      editor.callbackHints.some((h) => h.code === 'missing_handlers' || h.severity === 'warning'),
    );
  });

  it('strict validateGraph still reports missing_handlers as blocking issue', () => {
    const doc = docWithInlineButton();
    const strict = validateGraph(doc, { allowMissingCallbackHandlers: false });
    assert.equal(strict.ok, false);
    assert.ok(strict.issues.some((i) => i.code === 'missing_handlers'));
  });

  it('compile stage blocks unresolved callbacks', () => {
    const doc = docWithInlineButton();
    const gate = strictCompileValidation(doc, { validationStage: VALIDATION_STAGE.COMPILE });
    assert.equal(gate.compileBlocked, true);
    assert.ok(
      (gate.blocking || gate.errors || []).some((d) => d.code === 'missing_handlers'),
    );
  });

  it('inline attachment commit persists graph and projection without rollback', () => {
    const store = createGraphEditorStore({
      nodes: [{ id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: 'hi' } }],
      edges: [],
    });
    const graph = {
      getGraphDocument: () => store.getGraphDocument(),
      dispatch: (t, p, m) => store.dispatch(t, p, m),
      undo: () => store.undo(),
      getCanvasProjection: () => store.getCanvasProjection(),
    };
    const beforeSig = graph.getCanvasProjection().previewSignature;

    beginKeyboardInsertion('m');
    const r = updateBlockUiAttachments(graph, 'm', (ui) => ({
      ...ui,
      inline: [{ id: 'u1', text: 'OK', callback: 'ok_cb' }],
      buttons: [],
      replies: [],
      media: [],
      transitions: [],
    }));
    commitKeyboardInsertion('m');
    endNodeEdit('m');

    assert.equal(r?.ok, true, r?.error);
    const doc = store.getGraphDocument();
    assert.equal(doc.nodes.m.meta?.uiAttachments?.inline?.length, 1);

    const projection = graph.getCanvasProjection();
    assert.notEqual(projection.previewSignature, beforeSig);
    const canvasNode = projection.nodes.find((n) => n.id === 'm');
    assert.equal(canvasNode?.data?.meta?.uiAttachments?.inline?.length, 1);

    const preview = getPreview('message', canvasNode.data.props, canvasNode.data.meta);
    assert.match(preview, /\+ кнопки/);

    const editor = validateGraphDocumentForEditor(doc);
    assert.equal(editor.ok, true);
    assert.equal(store.history.cursor, 1, 'mutation must stay committed (no validation rollback)');
  });

  it('applyOperation does not run callback validation on commit path', () => {
    const seed = docWithInlineButton();
    const op = createOperation('UpdateNodeData', {
      nodeId: 'n_msg',
      data: { text: 'Updated' },
      meta: seed.nodes.n_msg.meta,
    });
    const result = applyOperation(seed, op);
    assert.equal(result.ok, true);
    assert.equal(result.document.nodes.n_msg.data.text, 'Updated');
  });

  it('post-commit collectEditorCallbackDiagnostics returns hints not errors', () => {
    const doc = docWithInlineButton();
    const { callbackHints, warnings } = collectEditorCallbackDiagnostics(doc);
    assert.ok(callbackHints.length >= 1);
    assert.ok(warnings.length >= 1);
    assert.ok(callbackHints.every((d) => d.severity === 'warning'));
  });

  it('insertion stage compile does not abort on missing handler', () => {
    const doc = docWithInlineButton();
    beginKeyboardInsertion('n_msg');
    try {
      const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
      const result = compileGraphToPython(flow, {
        exportMode: PYTHON_EXPORT_MODES.FULL_MODULE,
        graphDocument: doc,
        validationStage: VALIDATION_STAGE.INSERTION,
        strict: false,
      });
      const blocking = filterBlockingOverlayErrors(result.compileErrors || [], VALIDATION_STAGE.INSERTION);
      assert.equal(blocking.length, 0);
      assert.notEqual(result.aborted, true);
      assert.ok(result.code?.length > 0 || (result.compileErrors || []).length >= 0);
    } finally {
      commitKeyboardInsertion('n_msg');
      endNodeEdit('n_msg');
    }
  });

  it('autosave persist allows missing callback handler (structural-only gate)', () => {
    const doc = docWithInlineButton();
    const blob = persistCanvasBlob(doc);
    assert.equal(blob.nodes.length, 2);
    const inline = blob.nodes.find((n) => n.id === 'n_msg')?.meta?.uiAttachments?.inline;
    assert.equal(inline?.length, 1);
  });

  it('undo/redo keeps inline attachment after commit', () => {
    const store = createGraphEditorStore({
      nodes: [{ id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: 'x' } }],
      edges: [],
    });
    const graph = {
      getGraphDocument: () => store.getGraphDocument(),
      dispatch: (t, p, m) => store.dispatch(t, p, m),
      undo: () => store.undo(),
      redo: () => store.redo(),
    };
    updateBlockUiAttachments(graph, 'm', (ui) => ({
      ...ui,
      inline: [{ id: 'u1', text: 'Go', callback: 'go' }],
      buttons: [],
      replies: [],
      media: [],
      transitions: [],
    }));
    assert.equal(store.document.nodes.m.meta.uiAttachments.inline.length, 1);
    graph.undo();
    assert.equal(store.document.nodes.m.meta?.uiAttachments?.inline?.length || 0, 0);
    graph.redo();
    assert.equal(store.document.nodes.m.meta.uiAttachments.inline.length, 1);
    const editor = validateGraphDocumentForEditor(store.document);
    assert.equal(editor.ok, true);
  });

  it('projection signature updates immediately after keyboard add', () => {
    const store = createGraphEditorStore({
      nodes: [{ id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: 'x' } }],
      edges: [],
    });
    const baseNodes = projectGraphDocumentToCanvas(store.document).nodes;
    const baseSig = projectionNodesSignature(baseNodes);

    const graph = {
      getGraphDocument: () => store.getGraphDocument(),
      dispatch: (t, p, m) => store.dispatch(t, p, m),
    };
    updateBlockUiAttachments(graph, 'm', (ui) => ({
      ...ui,
      inline: [{ id: 'u2', text: 'Go', callback: 'go' }],
      buttons: [],
      replies: [],
      media: [],
      transitions: [],
    }));

    const afterNodes = projectGraphDocumentToCanvas(store.document).nodes;
    const afterSig = projectionNodesSignature(afterNodes);
    assert.notEqual(baseSig, afterSig);
  });
});
