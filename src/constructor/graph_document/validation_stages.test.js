import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  beginNodeEdit,
  beginKeyboardInsertion,
  commitKeyboardInsertion,
  endNodeEdit,
  isGraphInEditMode,
  isKeyboardInsertionActive,
} from './graph_edit_session.js';
import {
  extractCallbackHints,
  filterBlockingOverlayErrors,
  filterErrorsForStage,
  shouldShowCompileOverlay,
  VALIDATION_STAGE,
} from './validation_stages.js';
import { getPreview } from '../../builder/blockPreview.js';
import { projectionNodesSignature } from './projection_signature.js';

describe('validation stages', () => {
  it('filters callback handler errors in edit stage', () => {
    const errors = [
      { code: 'MissingCallbackHandlerError', message: 'Нет handler' },
      { code: 'dangling_edge', message: 'broken edge' },
    ];
    const filtered = filterErrorsForStage(errors, VALIDATION_STAGE.EDIT);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].code, 'dangling_edge');
  });

  it('insertion stage defers callback blocking like edit', () => {
    const errors = [{ code: 'missing_handlers', message: 'Нет реакции на «да»' }];
    assert.equal(filterBlockingOverlayErrors(errors, VALIDATION_STAGE.INSERTION).length, 0);
    assert.equal(shouldShowCompileOverlay(VALIDATION_STAGE.INSERTION, errors), false);
    assert.equal(extractCallbackHints(errors, VALIDATION_STAGE.COMMITTED).length, 1);
  });

  it('committed stage keeps callback as hint not overlay blocker', () => {
    const errors = [{ code: 'MissingCallbackHandlerError', message: 'Нет реакции' }];
    assert.equal(filterBlockingOverlayErrors(errors, VALIDATION_STAGE.COMMITTED).length, 0);
    assert.equal(shouldShowCompileOverlay(VALIDATION_STAGE.COMMITTED, errors), false);
  });

  it('tracks node edit session', () => {
    beginNodeEdit('n1');
    assert.equal(isGraphInEditMode(), true);
    endNodeEdit('n1');
    assert.equal(isGraphInEditMode(), false);
  });

  it('keyboard insertion transaction', () => {
    beginKeyboardInsertion('n2');
    assert.equal(isKeyboardInsertionActive('n2'), true);
    assert.equal(isGraphInEditMode(), true);
    commitKeyboardInsertion('n2');
    assert.equal(isKeyboardInsertionActive('n2'), false);
    endNodeEdit('n2');
  });
});

describe('block preview keyboard sync', () => {
  it('shows + кнопки when uiAttachments present', () => {
    const preview = getPreview('message', { text: 'Hi' }, {
      uiAttachments: {
        inline: [{ id: 'ua1', text: 'да', callback: 'да' }],
        buttons: [],
        replies: [],
        media: [],
        transitions: [],
      },
    });
    assert.match(preview, /\+ кнопки/);
    assert.match(preview, /1 кн/);
  });

  it('changes projection signature when uiAttachments change', () => {
    const base = [{ id: 'n1', data: { type: 'message', props: { text: 'x' }, meta: {} } }];
    const withKb = [{
      id: 'n1',
      data: {
        type: 'message',
        props: { text: 'x' },
        meta: { uiAttachments: { inline: [{ text: 'a', callback: 'a' }] } },
      },
    }];
    assert.notEqual(projectionNodesSignature(base), projectionNodesSignature(withKb));
  });
});
