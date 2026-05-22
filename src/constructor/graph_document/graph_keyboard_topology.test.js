import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphDocument } from './graph_document.js';
import { graphDocumentToStacks } from './stacks_bridge.js';
import { validateGraph } from './validate_graph.js';
import {
  migrateUiAttachmentsToKeyboardNodes,
  validateReplyChain,
  generateCallbackId,
} from './graph_keyboard_nodes.js';
import { addInlineButtonToOwner } from './graph_keyboard_operations.js';
import { bindStacksForCodegen } from '../../../core/codegen/ast/bindKeyboards.js';
import { stackToPython } from '../../../core/pythonAiogramCodegen.js';
import { importGraphDocument } from './graph_serializer.js';

test('photo + inline keyboard graph node validates and codegen reply_markup', () => {
  const doc = createGraphDocument({
    nodes: [
      { id: 's', type: 'start', position: { x: 0, y: 0 } },
      { id: 'p', type: 'photo', position: { x: 0, y: 80 }, data: { url: 'https://x/a.jpg', caption: 'Hi' } },
      {
        id: 'ikb',
        type: 'inline_keyboard',
        position: { x: 0, y: 132 },
        data: {
          rows: [{ buttons: [{ id: 'b1', text: 'OK', callbackId: 'callback_ok' }] }],
        },
      },
      { id: 'cb', type: 'callback', position: { x: 220, y: 0 }, data: { data: 'callback_ok', label: 'OK' } },
    ],
    edges: [
      { id: 'e1', source: 's', target: 'p' },
      { id: 'ek', source: 'p', target: 'ikb', sourcePort: 'keyboard', targetPort: 'keyboard' },
    ],
  });
  const chainIssues = validateReplyChain(doc, { strict: true });
  assert.equal(chainIssues.length, 0, chainIssues.map((i) => i.message).join('; '));
  const stacks = graphDocumentToStacks(doc);
  const bind = bindStacksForCodegen(stacks);
  assert.equal(bind.ok, true);
  const photo = bind.stacks[0].blocks.find((b) => b.id === 'p');
  assert.equal(photo?.boundKeyboard?.type, 'inline');
  const py = stackToPython({ blocks: bind.stacks[0].blocks });
  assert.match(py, /reply_markup=kb_/);
});

test('message + reply_keyboard node', () => {
  const doc = createGraphDocument({
    nodes: [
      { id: 's', type: 'start', position: { x: 0, y: 0 } },
      { id: 'm', type: 'message', position: { x: 0, y: 80 }, data: { text: 'Pick' } },
      {
        id: 'rkb',
        type: 'reply_keyboard',
        position: { x: 0, y: 132 },
        data: { rows: [{ buttons: [{ id: 'b1', text: 'Далее', callbackId: 'Далее' }] }] },
      },
    ],
    edges: [
      { id: 'e1', source: 's', target: 'm' },
      { id: 'ek', source: 'm', target: 'rkb', sourcePort: 'keyboard', targetPort: 'keyboard' },
    ],
  });
  assert.equal(validateReplyChain(doc).length, 0);
  const bind = bindStacksForCodegen(graphDocumentToStacks(doc));
  assert.equal(bind.stacks[0].blocks.find((b) => b.id === 'm')?.boundKeyboard?.type, 'buttons');
});

test('auto callback generation is unique', () => {
  const used = new Set();
  const a = generateCallbackId('Да', used);
  const b = generateCallbackId('Да', used);
  assert.notEqual(a, b);
  assert.match(a, /^callback_/);
});

test('migration moves uiAttachments to keyboard node', () => {
  const raw = {
    schema_version: 1,
    nodes: [
      { id: 'p', type: 'photo', position: { x: 0, y: 0 }, data: { url: 'x' }, meta: {
        uiAttachments: {
          inline: [{ id: 'ua1', text: 'Go', callback: 'go_cb' }],
          buttons: [], replies: [], media: [], transitions: [],
        },
      } },
    ],
    edges: [],
  };
  const { document, trace } = importGraphDocument(raw);
  assert.ok(trace.includes('ui-attachments-to-keyboard-nodes-v2'));
  assert.equal(document.schema_version, 2);
  const kbEdge = Object.values(document.edges).find((e) => e.source === 'p');
  assert.ok(kbEdge);
  assert.equal(document.nodes[kbEdge.target].type, 'inline_keyboard');
  assert.equal(document.nodes.p.meta?.uiAttachments?.inline?.length || 0, 0);
});

test('addInlineButtonToOwner creates handler edge', () => {
  const doc = createGraphDocument({
    nodes: [
      { id: 's', type: 'start', position: { x: 0, y: 0 } },
      { id: 'm', type: 'message', position: { x: 0, y: 80 }, data: { text: 'Hi' } },
    ],
    edges: [{ id: 'e1', source: 's', target: 'm' }],
  });
  const result = addInlineButtonToOwner(doc, 'm', { label: 'Да', autoCreateHandler: true });
  assert.equal(result.ok, true);
  const kb = result.document.nodes[result.keyboardNodeId];
  assert.equal(kb.type, 'inline_keyboard');
  assert.ok(result.document.nodes[result.handlerNodeId]);
  const btn = kb.data.rows[0].buttons[0];
  assert.equal(btn.text, 'Да');
  assert.match(btn.callbackId, /^callback_/);
});

test('graph validate: media+inline keyboard no blocking errors', () => {
  const doc = createGraphDocument({
    nodes: [
      { id: 's', type: 'start', position: { x: 0, y: 0 } },
      { id: 'p', type: 'photo', position: { x: 0, y: 80 }, data: { url: 'x' } },
      {
        id: 'ikb',
        type: 'inline_keyboard',
        position: { x: 0, y: 132 },
        data: { rows: [{ buttons: [{ id: 'b', text: 'X', callbackId: 'cb_x' }] }] },
      },
      { id: 'cb', type: 'callback', position: { x: 200, y: 0 }, data: { data: 'cb_x' } },
    ],
    edges: [
      { id: 'e1', source: 's', target: 'p' },
      { id: 'ek', source: 'p', target: 'ikb', sourcePort: 'keyboard', targetPort: 'keyboard' },
    ],
  });
  const v = validateGraph(doc, { allowMissingCallbackHandlers: true });
  const blocking = (v.issues || []).filter((i) => i.severity === 'error');
  assert.equal(blocking.length, 0, JSON.stringify(blocking));
});
