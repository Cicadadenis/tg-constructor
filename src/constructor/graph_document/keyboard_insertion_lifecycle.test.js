import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
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
  resolveSessionValidationStage,
  VALIDATION_STAGE,
} from './validation_stages.js';

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

describe('keyboard insertion lifecycle', () => {
  it('insertion stage does not block strictCompileValidation on missing handler', () => {
    const doc = docWithInlineButton();
    beginKeyboardInsertion('n_msg');
    try {
      const gate = strictCompileValidation(doc, { validationStage: VALIDATION_STAGE.INSERTION });
      assert.equal(gate.compileBlocked, false);
      const cb = gate.diagnostics.filter((d) => d.code === 'missing_handlers' || d.code === 'MissingCallbackHandlerError');
      assert.ok(cb.length >= 1, 'post-commit callback hint during insertion');
      assert.equal(cb[0].severity, 'warning');
      assert.equal(gate.errors.filter((d) => d.code === 'missing_handlers').length, 0);
    } finally {
      commitKeyboardInsertion('n_msg');
      endNodeEdit('n_msg');
    }
  });

  it('compile during insertion defers callback overlay errors', () => {
    const doc = docWithInlineButton();
    beginKeyboardInsertion('n_msg');
    try {
      const stage = resolveSessionValidationStage();
      assert.equal(stage, VALIDATION_STAGE.INSERTION);
      const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
      const result = compileGraphToPython(flow, {
        exportMode: PYTHON_EXPORT_MODES.FULL_MODULE,
        graphDocument: doc,
        validationStage: stage,
        strict: false,
      });
      const blocking = filterBlockingOverlayErrors(result.compileErrors || [], stage);
      assert.equal(blocking.length, 0);
      assert.ok((result.compileErrors || []).some((e) => isDeferred(e)) || !result.aborted);
    } finally {
      commitKeyboardInsertion('n_msg');
      endNodeEdit('n_msg');
    }
  });

  it('committed stage surfaces callback as non-blocking warning', () => {
    const doc = docWithInlineButton();
    const gate = strictCompileValidation(doc, { validationStage: VALIDATION_STAGE.COMMITTED });
    assert.equal(gate.compileBlocked, false);
    assert.ok(gate.warnings.some((d) => d.code === 'missing_handlers'));

    const flow = projectGraphToFlow(graphDocumentToProjectGraph(doc));
    const result = compileGraphToPython(flow, {
      exportMode: PYTHON_EXPORT_MODES.FULL_MODULE,
      graphDocument: doc,
      validationStage: VALIDATION_STAGE.COMMITTED,
      strict: false,
    });
    const blocking = filterBlockingOverlayErrors(result.compileErrors || [], VALIDATION_STAGE.COMMITTED);
    assert.equal(blocking.length, 0);
    assert.notEqual(result.aborted, true);
  });
});

function isDeferred(err) {
  const code = String(err?.code || '');
  return code === 'MissingCallbackHandlerError' || code === 'missing_handlers';
}
