/**
 * Media nodes: keyboard stack compatibility, UI capabilities, codegen reply_markup.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_KEYBOARD_CAPABLE_TYPES,
  canStackBlockBelow,
  getCompatibleBlockTypes,
} from '../blockRegistry.js';
import { canAttach } from '../capabilityEngine.js';
import { getPreview } from '../../src/builder/blockPreview.js';
import { stackToPython } from '../pythonAiogramCodegen.js';
import { bindStacksForCodegen } from '../codegen/ast/bindKeyboards.js';
import { createGraphDocument } from '../../src/constructor/graph_document/graph_document.js';
import { validateGraph } from '../../src/constructor/graph_document/validate_graph.js';
import { composeModules } from '../../src/modules/composition/module_compose.js';
import { GRAPH_MODULE_REGISTRY } from '../../src/modules/graph/registry.js';

test('media types allow buttons and inline in stack compatibility', () => {
  for (const type of MEDIA_KEYBOARD_CAPABLE_TYPES) {
    const children = getCompatibleBlockTypes(type);
    assert.ok(children.includes('buttons'), `${type} should allow buttons below`);
    assert.ok(children.includes('inline'), `${type} should allow inline below`);
    assert.ok(canStackBlockBelow(type, 'buttons'), `${type} canStack buttons`);
    assert.ok(canStackBlockBelow(type, 'inline'), `${type} canStack inline`);
    assert.ok(canAttach('buttons', type), `${type} canAttach buttons`);
    assert.ok(canAttach('inline', type), `${type} canAttach inline`);
  }
});

test('photo preview shows keyboard attachment count', () => {
  const plain = getPreview('photo', { url: 'https://x/1.jpg', caption: 'Привет' }, {});
  const withKb = getPreview('photo', { url: 'https://x/1.jpg', caption: 'Привет' }, {
    uiAttachments: {
      inline: [{ text: 'да', callback: 'да' }],
      buttons: [],
      replies: [],
      media: [],
      transitions: [],
    },
  });
  assert.ok(!plain.includes('+ кнопки'));
  assert.ok(withKb.includes('+ кнопки'));
  assert.ok(withKb.includes('1 кн.'));
});

test('photo + inline uiAttachments → answer_photo with reply_markup', () => {
  const py = stackToPython({
    blocks: [
      { id: 's', type: 'start', props: {} },
      {
        id: 'p',
        type: 'photo',
        props: { url: 'https://example.com/a.jpg', caption: 'Смотри' },
        uiAttachments: {
          inline: [{ id: 'ua1', text: 'OK', callback: 'ok_cb' }],
          buttons: [],
          replies: [],
          media: [],
          transitions: [],
        },
      },
      { id: 'cb', type: 'callback', props: { data: 'ok_cb' } },
      { id: 'r', type: 'message', props: { text: 'done' } },
    ],
  });
  assert.match(py, /answer_photo\(/);
  assert.match(py, /caption=/);
  assert.match(py, /reply_markup=kb_/);
  assert.match(py, /InlineKeyboardMarkup/);
});

test('video + reply keyboard stack bind', () => {
  const bind = bindStacksForCodegen([{
    blocks: [
      { id: 's', type: 'start', props: {} },
      { id: 'v', type: 'video', props: { url: 'https://example.com/v.mp4' } },
      { id: 'k', type: 'buttons', props: { rows: 'Далее' } },
    ],
  }]);
  assert.equal(bind.ok, true);
  const video = bind.stacks[0].blocks.find((b) => b.id === 'v');
  assert.equal(video?.boundKeyboard?.type, 'buttons');
});

test('graph validate accepts photo with uiAttachments and flow successor', () => {
  const doc = createGraphDocument({
    nodes: [
      { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
      {
        id: 'n_photo',
        type: 'photo',
        position: { x: 0, y: 112 },
        data: { url: 'x', caption: 'cap' },
        meta: {
          uiAttachments: {
            inline: [{ id: 'ua1', text: 'Go', callback: 'go_cb' }],
            buttons: [],
            replies: [],
            media: [],
            transitions: [],
          },
        },
      },
      { id: 'n_cb', type: 'callback', position: { x: 400, y: 0 }, data: { data: 'go_cb' } },
      { id: 'n_msg', type: 'message', position: { x: 0, y: 224 }, data: { text: 'ok' } },
    ],
    edges: [
      { id: 'e1', source: 'n_start', target: 'n_photo' },
      { id: 'e2', source: 'n_photo', target: 'n_msg' },
    ],
  });
  const result = validateGraph(doc);
  const blocking = (result.issues || []).filter((i) => i.severity === 'error' && i.code !== 'missing_handlers');
  assert.equal(blocking.length, 0, JSON.stringify(blocking));
});

test('graph modules compose without breaking keyboard-capable output nodes', () => {
  const result = composeModules(
    ['admin_by_id', 'admin_menu'],
    GRAPH_MODULE_REGISTRY,
    { strict: false },
  );
  assert.equal(result.ok, true, result.error);
  const types = Object.values(result.document?.nodes || {}).map((n) => n.type);
  assert.ok(types.includes('message'), 'composed graph has message output nodes');
});
