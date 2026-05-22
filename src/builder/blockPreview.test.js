import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPreview } from './blockPreview.js';
import { projectionNodesSignature } from '../constructor/graph_document/projection_signature.js';

describe('blockPreview', () => {
  it('updates when inline attachment added', () => {
    const before = getPreview('message', { text: 'Привет' }, {});
    const after = getPreview('message', { text: 'Привет' }, {
      uiAttachments: { inline: [{ text: 'да', callback: 'да' }], buttons: [], replies: [], media: [], transitions: [] },
    });
    assert.ok(!before.includes('+ кнопки'));
    assert.ok(after.includes('+ кнопки'));
  });

  it('photo shows + кнопки with uiAttachments', () => {
    const after = getPreview('photo', { url: 'id', caption: 'Cap' }, {
      uiAttachments: { inline: [{ text: 'x', callback: 'x' }], buttons: [], replies: [], media: [], transitions: [] },
    });
    assert.ok(after.includes('+ кнопки'));
    assert.ok(after.includes('Cap'));
  });
});

describe('projection signature', () => {
  it('changes when meta uiAttachments change', () => {
    const base = [{ id: 'n1', data: { type: 'message', props: { text: 'x' }, meta: {} } }];
    const withKb = [{
      id: 'n1',
      data: {
        type: 'message',
        props: { text: 'x' },
        meta: { uiAttachments: { inline: [{ text: 'a' }] } },
      },
    }];
    assert.notEqual(projectionNodesSignature(base), projectionNodesSignature(withKb));
  });
});
