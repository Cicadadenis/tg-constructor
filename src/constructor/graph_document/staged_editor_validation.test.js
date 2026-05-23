import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import { createGraphEditorStore } from './graph_editor_store.js';
import { updateBlockUiAttachments } from './graph_ui_orchestrator.js';
import { projectGraphDocumentToCanvas } from './graph_projection.js';
import { validateGraphDocumentForEditor } from './graph_validate.js';
import { validateGraph } from './validate_graph.js';
import { runGraphValidationPipeline, strictCompileValidation } from './graph_validation_pipeline.js';
import { compileGraphToPython, PYTHON_EXPORT_MODES } from '../../../core/pythonAiogramCodegen.js';
import { graphDocumentToProjectGraph } from './graph_project_bridge.js';
import { projectGraphToFlow } from '../../../core/graph/model.js';
import { VALIDATION_STAGE } from './validation_stages.js';
import { getPreview } from '../../builder/blockPreview.js';

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

describe('staged editor validation', () => {
  it('validateGraphDocumentForEditor treats missing handler as non-blocking warning', () => {
    const doc = docWithInlineButton();
    const out = validateGraphDocumentForEditor(doc);
    assert.equal(out.ok, true, 'editor validate must not fail on missing callback handler');
    assert.equal(out.errors.length, 0);
    assert.ok(out.callbackHints?.length >= 1 || out.warnings?.length >= 0);
    const pipe = runGraphValidationPipeline(doc, { allowMissingCallbackHandlers: true });
    const cb = pipe.diagnostics.filter((d) => d.code === 'missing_handlers');
    assert.ok(cb.length >= 1);
    assert.equal(cb[0].severity, 'warning');
    assert.equal(pipe.errors.filter((d) => d.code === 'missing_handlers').length, 0);
  });

  it('inline attachment commit is visible in projection without handler', () => {
    const store = createGraphEditorStore({
      nodes: [{ id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: 'hi' } }],
      edges: [],
    });
    const graph = {
      getGraphDocument: () => store.getGraphDocument(),
      dispatch: (t, p, m) => store.dispatch(t, p, m),
    };
    const before = projectGraphDocumentToCanvas(store.getGraphDocument());
    const r = updateBlockUiAttachments(graph, 'm', (ui) => ({
      ...ui,
      inline: [{ id: 'u1', text: 'OK', callback: 'ok_cb' }],
      buttons: [],
      replies: [],
      media: [],
      transitions: [],
    }));
    assert.equal(r?.ok, true, r?.error);
    const after = projectGraphDocumentToCanvas(store.getGraphDocument());
    const projNode = after.nodes.find((n) => n.id === 'm');
    assert.ok(projNode?.data?.meta?.uiAttachments?.inline?.length === 1);
    assert.notDeepEqual(before.nodes, after.nodes);
    const preview = getPreview('message', { text: 'hi' }, projNode.data.meta);
    assert.match(preview, /\+ кнопки/);
  });

  it('mutation path does not rollback when callback handler is missing', () => {
    const doc = docWithInlineButton();
    const store = createGraphEditorStore(doc);
    const revBefore = store.document.metadata.revision;
    const graph = {
      getGraphDocument: () => store.getGraphDocument(),
      dispatch: (t, p, m) => store.dispatch(t, p, m),
    };
    const r = updateBlockUiAttachments(graph, 'n_msg', (ui) => ({
      ...ui,
      inline: [...(ui.inline || []), { id: 'ua2', text: 'нет', callback: 'orphan2' }],
    }));
    assert.equal(r?.ok, true);
    assert.ok(store.document.metadata.revision >= revBefore);
    assert.equal(store.document.nodes.n_msg.meta.uiAttachments.inline.length, 2);
  });

  it('compile strict mode still blocks unresolved callbacks', () => {
    const doc = docWithInlineButton();
    const gate = strictCompileValidation(doc, { validationStage: VALIDATION_STAGE.COMPILE });
    assert.equal(gate.compileBlocked, true);
    assert.ok(gate.blocking.some((d) => d.code === 'missing_handlers'));

    const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
    const compiled = compileGraphToPython(flow, {
      exportMode: PYTHON_EXPORT_MODES.FULL_MODULE,
      graphDocument: doc,
      validationStage: VALIDATION_STAGE.COMPILE,
      strict: true,
      skipGraphGate: false,
    });
    assert.equal(compiled.compileBlocked || compiled.aborted, true);
    assert.ok((compiled.compileErrors || []).some((e) => (
      e.code === 'missing_handlers' || e.code === 'MissingCallbackHandlerError'
    )));
  });

  it('editor validateGraph ok with warnings; strict validateGraph fails', () => {
    const doc = docWithInlineButton();
    const soft = validateGraph(doc, { allowMissingCallbackHandlers: true });
    assert.equal(soft.ok, true);
    assert.ok((soft.diagnostics || []).some((d) => d.code === 'missing_handlers' && d.severity === 'warning'));

    const hard = validateGraph(doc, { strict: true, validationStage: VALIDATION_STAGE.COMPILE });
    assert.equal(hard.ok, false);
    assert.ok(hard.issues.some((i) => i.code === 'missing_handlers'));
  });
});
