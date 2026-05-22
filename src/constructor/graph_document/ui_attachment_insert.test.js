import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphEditorStore } from './graph_editor_store.js';
import { updateBlockUiAttachments } from './graph_ui_orchestrator.js';
import { canAttach, canRenderUi } from '../../../core/capabilityEngine.js';

describe('ui attachment insert', () => {
  it('message and photo accept inline capability', () => {
    assert.equal(canRenderUi('message'), true);
    assert.equal(canAttach('inline', 'message'), true);
    assert.equal(canAttach('inline', 'photo'), true);
  });

  it('persists inline uiAttachments on message node', () => {
    const store = createGraphEditorStore({
      nodes: [{ id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: 'hi' } }],
      edges: [],
    });
    const graph = {
      getGraphDocument: () => store.getGraphDocument(),
      dispatch: (t, p, m) => store.dispatch(t, p, m),
      undo: () => store.undo(),
    };
    const r = updateBlockUiAttachments(graph, 'm', (ui) => ({
      ...ui,
      inline: [{ id: 'u1', text: 'OK', callback: 'ok_cb' }],
      buttons: [],
      replies: [],
      media: [],
      transitions: [],
    }));
    assert.equal(r?.ok, true, r?.error);
    const att = store.getGraphDocument().nodes.m.meta?.uiAttachments;
    assert.equal(att?.inline?.length, 1);
    assert.equal(att.inline[0].callback, 'ok_cb');
  });
});
