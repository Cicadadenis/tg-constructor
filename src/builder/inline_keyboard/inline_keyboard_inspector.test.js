import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeInlineKeyboardData,
  serializeInlineKeyboardData,
  formatKeyboardCanvasPreview,
  emptyInlineKeyboardData,
} from './inline_keyboard_model.js';
import {
  addRow,
  addButton,
  bindButtonHandler,
  duplicateButton,
  removeButton,
} from './inline_keyboard_editor.js';
import { linkKeyboardButtonToHandler, ensureKeyboardNodeForOwner } from '../../constructor/graph_document/graph_keyboard_operations.js';
import { createGraphDocument } from '../../constructor/graph_document/graph_document.js';
import { buildGraphReferenceIndex, listInlineKeyboardActionRefs } from '../../constructor/graph_document/graph_reference_registry.js';
import { collectKeyboardButtonDiagnostics } from '../../constructor/graph_document/graph_keyboard_nodes.js';
import { keyboardNodeToStackBlock } from '../../constructor/graph_document/graph_keyboard_nodes.js';
import { bindStacksForCodegen } from '../../../core/codegen/ast/bindKeyboards.js';
import { graphDocumentToStacks } from '../../constructor/graph_document/stacks_bridge.js';
import { importGraphDocument } from '../../constructor/graph_document/graph_serializer.js';

test('empty inline keyboard model', () => {
  const data = emptyInlineKeyboardData('inline_keyboard');
  assert.equal(data.rows.length, 0);
  const m = normalizeInlineKeyboardData(data);
  assert.equal(m.rows.length, 0);
});

test('add button and canvas preview', () => {
  let m = normalizeInlineKeyboardData({ rows: [] });
  m = addButton(m, 0, 'inline_keyboard', 'Да');
  m = addButton(m, 0, 'inline_keyboard', 'Нет');
  const preview = formatKeyboardCanvasPreview(m);
  assert.match(preview, /Да/);
  assert.match(preview, /Нет/);
  const serialized = serializeInlineKeyboardData(m);
  assert.equal(serialized.rows[0].buttons.length, 2);
});

test('bind handler ref uses node id not raw callback_data', () => {
  let m = addButton(normalizeInlineKeyboardData({ rows: [] }), 0, 'inline_keyboard', 'OK');
  const btnId = m.rows[0][0].id;
  m = bindButtonHandler(m, 0, btnId, {
    ownerNodeId: 'cb_handler_1',
    compileValue: 'callback_ok',
    id: 'graphref:callback_inline:cb_handler_1',
  });
  const btn = m.rows[0][0];
  assert.equal(btn.handlerNodeId, 'cb_handler_1');
  assert.equal(btn.callbackRef, 'cb_handler_1');
});

test('linkKeyboardButtonToHandler patches graph node', () => {
  const doc = createGraphDocument({
    nodes: {
      ikb: {
        id: 'ikb',
        type: 'inline_keyboard',
        position: { x: 0, y: 0 },
        data: { rows: [{ buttons: [{ id: 'b1', text: 'Go', callbackId: 'cb_go' }] }] },
      },
      cb: { id: 'cb', type: 'callback', position: { x: 200, y: 0 }, data: { data: 'cb_go' } },
    },
    edges: {},
  });
  const out = linkKeyboardButtonToHandler(doc, 'ikb', 'b1', 'cb', { callbackId: 'cb_go' });
  assert.equal(out.ok, true);
  assert.equal(out.document.nodes.ikb.data.rows[0].buttons[0].handlerNodeId, 'cb');
});

test('registry lists callback handler nodes', () => {
  const doc = createGraphDocument({
    nodes: {
      cb: { id: 'cb', type: 'callback', position: { x: 0, y: 0 }, data: { data: 'cb_x', label: 'X' } },
    },
    edges: {},
  });
  const index = buildGraphReferenceIndex(doc);
  const refs = listInlineKeyboardActionRefs(index);
  assert.ok(refs.some((r) => r.ownerNodeId === 'cb' && r.compileValue === 'cb_x'));
});

test('missing handler warning vs strict error', () => {
  const doc = createGraphDocument({
    nodes: {
      ikb: {
        id: 'ikb',
        type: 'inline_keyboard',
        position: { x: 0, y: 0 },
        data: { rows: [{ buttons: [{ id: 'b', text: 'Orphan', callbackId: 'cb_orphan' }] }] },
      },
    },
    edges: {},
  });
  const soft = collectKeyboardButtonDiagnostics(doc, { allowMissingHandlers: true });
  assert.equal(soft[0].severity, 'warning');
  const strict = collectKeyboardButtonDiagnostics(doc, { allowMissingHandlers: false });
  assert.equal(strict[0].severity, 'error');
});

test('keyboardNodeToStackBlock resolves callback from handler node', () => {
  const doc = createGraphDocument({
    nodes: {
      ikb: {
        id: 'ikb',
        type: 'inline_keyboard',
        position: { x: 0, y: 0 },
        data: {
          rows: [{
            buttons: [{
              id: 'b',
              text: 'OK',
              handlerNodeId: 'cb',
              callbackId: '',
            }],
          }],
        },
      },
      cb: { id: 'cb', type: 'callback', position: { x: 0, y: 0 }, data: { data: 'resolved_cb' } },
    },
    edges: {},
  });
  const block = keyboardNodeToStackBlock(doc.nodes.ikb, doc);
  assert.match(block.props.buttons, /resolved_cb/);
});

test('ensureKeyboardNodeForOwner creates node and edge', () => {
  const doc = createGraphDocument({
    nodes: {
      m: { id: 'm', type: 'message', position: { x: 0, y: 0 }, data: { text: 'Hi' } },
    },
    edges: {},
  });
  const out = ensureKeyboardNodeForOwner(doc, 'm', 'inline');
  assert.equal(out.ok, true);
  assert.equal(out.created, true);
  assert.ok(out.document.nodes[out.keyboardNodeId]);
});

test('migrate old uiAttachments project', () => {
  const raw = {
    schema_version: 1,
    nodes: [{
      id: 'p',
      type: 'message',
      position: { x: 0, y: 0 },
      data: { text: 'Pick' },
      meta: {
        uiAttachments: {
          inline: [{ id: 'u1', text: 'Yes', callback: 'yes_cb' }],
          buttons: [],
          replies: [],
          media: [],
          transitions: [],
        },
      },
    }],
    edges: [],
  };
  const { document } = importGraphDocument(raw);
  const kb = Object.values(document.nodes).find((n) => n.type === 'inline_keyboard');
  assert.ok(kb);
  const stacks = graphDocumentToStacks(document);
  const bind = bindStacksForCodegen(stacks);
  assert.equal(bind.ok, true);
});

test('duplicate and remove button', () => {
  let m = addButton(normalizeInlineKeyboardData({ rows: [] }), 0, 'inline_keyboard', 'A');
  const id = m.rows[0][0].id;
  m = duplicateButton(m, 0, id);
  assert.equal(m.rows.flat().length, 2);
  const dupId = m.rows[0].find((b) => b.id !== id)?.id;
  m = removeButton(m, 0, dupId);
  assert.equal(m.rows.flat().length, 1);
});
