import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import {
  buildGraphReferenceIndex,
  listCallbackButtonRefs,
  REF_CATEGORY,
} from './graph_reference_registry.js';
import { bindingPatchFromReference } from './graph_reference_bindings.js';

describe('graph_reference_registry', () => {
  it('indexes inline buttons by display label not raw path', () => {
    const doc = createGraphDocument({
      nodes: [
        {
          id: 'p',
          type: 'photo',
          position: { x: 0, y: 0 },
          data: { url: 'x.jpg' },
          meta: {
            uiAttachments: {
              inline: [
                { id: 'u1', text: 'Да', callback: 'callback_да' },
                { id: 'u2', text: 'Нет', callback: 'callback_нет' },
              ],
              buttons: [],
              replies: [],
              media: [],
              transitions: [],
            },
          },
        },
      ],
      edges: [],
    });
    const index = buildGraphReferenceIndex(doc);
    const buttons = listCallbackButtonRefs(index);
    assert.equal(buttons.length, 2);
    assert.ok(buttons.some((r) => r.displayLabel === 'Да' && r.compileValue === 'callback_да'));
    assert.ok(buttons.some((r) => r.displayLabel === 'Нет'));
    assert.equal(buttons[0].category, REF_CATEGORY.CALLBACK_INLINE);
  });

  it('bindingPatchFromReference sets graph ref id and compile fields', () => {
    const ref = {
      id: 'graphref:callback_inline:p:u1',
      category: REF_CATEGORY.CALLBACK_INLINE,
      displayLabel: 'Да',
      compileValue: 'callback_да',
      bindField: 'data',
    };
    const patch = bindingPatchFromReference(ref);
    assert.equal(patch._graphRefId, ref.id);
    assert.equal(patch.data, 'callback_да');
    assert.equal(patch.label, '');
  });
});
