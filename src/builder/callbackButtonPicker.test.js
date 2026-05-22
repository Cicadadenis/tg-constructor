import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from '../constructor/graph_document/graph_document.js';
import { collectCallbackButtonOptionsFromDocument } from './callbackButtonPicker.js';

describe('collectCallbackButtonOptionsFromDocument', () => {
  it('lists inline callbacks from uiAttachments on photo', () => {
    const doc = createGraphDocument({
      nodes: [
        {
          id: 'p',
          type: 'photo',
          position: { x: 0, y: 0 },
          data: { url: 'x.jpg' },
          meta: {
            uiAttachments: {
              inline: [{ id: 'u1', text: 'Да', callback: 'callback_да' }],
              buttons: [],
              replies: [],
              media: [],
              transitions: [],
            },
          },
        },
        { id: 'c', type: 'callback', position: { x: 0, y: 80 }, data: {} },
      ],
      edges: [],
    });
    const opts = collectCallbackButtonOptionsFromDocument(doc);
    assert.ok(opts.some((o) => o.value === 'callback_да' && o.kind === 'inline'));
  });
});
