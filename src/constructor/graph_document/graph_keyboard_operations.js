/**
 * Graph mutations: keyboard nodes, inline buttons, auto callback handlers.
 */

import { createOperation, applyOperation } from './graph_operations.js';
import { createGraphDocument } from './graph_document.js';
import {
  emptyKeyboardData,
  generateCallbackId,
  normalizeKeyboardNodeData,
  findKeyboardNodeForOwner,
} from './graph_keyboard_nodes.js';
import {
  isReplyCapable,
  KEYBOARD_EDGE_SOURCE_PORT,
  KEYBOARD_EDGE_TARGET_PORT,
} from '../../../core/keyboard_topology.js';
import { createCallbackHandlerForReference } from './graph_reference_actions.js';
import { makeRefId, REF_CATEGORY } from './graph_reference_registry.js';

function uid(prefix = 'n') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(2, 6)}`;
}

function collectUsedCallbackIds(document) {
  const used = new Set();
  for (const node of Object.values(document.nodes || {})) {
    if (node.type !== 'inline_keyboard') continue;
    const data = normalizeKeyboardNodeData(node.data, node.type);
    for (const row of data.rows) {
      for (const btn of row.buttons) {
        if (btn.callbackId) used.add(btn.callbackId);
      }
    }
  }
  for (const node of Object.values(document.nodes || {})) {
    if (node.type !== 'callback') continue;
    const d = String(node.data?.data || '').trim();
    if (d) used.add(d);
  }
  return used;
}

/**
 * Ensure inline_keyboard or reply_keyboard node linked to owner via keyboard port.
 * @returns {{ document: object, keyboardNodeId: string, operations: object[], created: boolean }}
 */
export function ensureKeyboardNodeForOwner(document, ownerNodeId, kind = 'inline') {
  const doc = createGraphDocument(document);
  const owner = doc.nodes[ownerNodeId];
  if (!owner || !isReplyCapable(owner.type)) {
    return { document: doc, keyboardNodeId: null, operations: [], created: false, ok: false };
  }

  const existing = findKeyboardNodeForOwner(doc, ownerNodeId);
  if (existing) {
    return {
      document: doc,
      keyboardNodeId: existing.id,
      operations: [],
      created: false,
      ok: true,
    };
  }

  const kbType = kind === 'buttons' || kind === 'reply' ? 'reply_keyboard' : 'inline_keyboard';
  const kbId = uid(kbType === 'inline_keyboard' ? 'ikb' : 'rkb');
  const ownerX = Number(owner.position?.x) || 120;
  const ownerY = Number(owner.position?.y) || 120;
  let next = doc;
  const operations = [];

  const push = (type, payload) => {
    const op = createOperation(type, payload);
    const result = applyOperation(next, op);
    if (!result.ok) return false;
    next = result.document;
    operations.push(op);
    return true;
  };

  push('AddNode', {
    nodeId: kbId,
    type: kbType,
    position: { x: ownerX, y: ownerY + 52 },
    data: emptyKeyboardData(kbType),
    meta: { keyboardParentId: ownerNodeId },
  });

  push('AddEdge', {
    edgeId: uid('edge'),
    source: ownerNodeId,
    target: kbId,
    sourcePort: KEYBOARD_EDGE_SOURCE_PORT,
    targetPort: KEYBOARD_EDGE_TARGET_PORT,
  });

  return {
    document: next,
    keyboardNodeId: kbId,
    operations,
    created: true,
    ok: true,
  };
}

/**
 * Add inline button to owner's keyboard; optional auto-create callback handler.
 */
export function addInlineButtonToOwner(document, ownerNodeId, options = {}) {
  const label = String(options.label || 'Кнопка').trim() || 'Кнопка';
  const autoHandler = options.autoCreateHandler !== false;

  let doc = createGraphDocument(document);
  const ensured = ensureKeyboardNodeForOwner(doc, ownerNodeId, 'inline');
  if (!ensured.ok || !ensured.keyboardNodeId) {
    return { document: doc, ok: false, reason: 'no_reply_capable_owner' };
  }
  doc = ensured.document;

  const kbId = ensured.keyboardNodeId;
  const kbNode = doc.nodes[kbId];
  const used = collectUsedCallbackIds(doc);
  const callbackId = generateCallbackId(label, used);
  const buttonId = uid('btn');
  const graphRefId = makeRefId(REF_CATEGORY.CALLBACK_INLINE, ownerNodeId, buttonId);

  const data = normalizeKeyboardNodeData(kbNode.data, kbNode.type);
  const rows = data.rows.length ? [...data.rows] : [{ buttons: [] }];
  const lastRow = rows[rows.length - 1];
  lastRow.buttons = [
    ...(lastRow.buttons || []),
    {
      id: buttonId,
      text: label,
      callbackId,
      graphRefId,
    },
  ];

  let next = doc;
  const operations = [...(ensured.operations || [])];
  const patchOp = createOperation('UpdateNodeData', {
    nodeId: kbId,
    data: { ...data, rows },
  });
  const patchResult = applyOperation(next, patchOp);
  if (!patchResult.ok) {
    return { document: doc, ok: false, reason: 'patch_failed' };
  }
  next = patchResult.document;
  operations.push(patchOp);

  let handlerNodeId = null;
  if (autoHandler) {
    const ref = {
      id: graphRefId,
      category: REF_CATEGORY.CALLBACK_INLINE,
      displayLabel: label,
      compileValue: callbackId,
      ownerNodeId: kbId,
      ownerType: 'inline_keyboard',
      attachmentId: buttonId,
      bindField: 'data',
    };
    const created = createCallbackHandlerForReference(next, ref);
    next = created.document;
    handlerNodeId = created.handlerNodeId;
    operations.push(...(created.operations || []));

    if (handlerNodeId) {
      const btnRow = rows[rows.length - 1].buttons;
      const btn = btnRow[btnRow.length - 1];
      btn.handlerNodeId = handlerNodeId;
      const linkOp = createOperation('UpdateNodeData', {
        nodeId: kbId,
        data: { ...data, rows },
      });
      const linkResult = applyOperation(next, linkOp);
      if (linkResult.ok) {
        next = linkResult.document;
        operations.push(linkOp);
      }
    }
  }

  return {
    document: next,
    ok: true,
    keyboardNodeId: kbId,
    buttonId,
    callbackId,
    handlerNodeId,
    operations,
    graphRefId,
  };
}

/** Add reply keyboard button (reply_keyboard node). */
export function addReplyButtonToOwner(document, ownerNodeId, options = {}) {
  const label = String(options.label || 'Кнопка').trim() || 'Кнопка';
  let doc = createGraphDocument(document);
  const ensured = ensureKeyboardNodeForOwner(doc, ownerNodeId, 'buttons');
  if (!ensured.ok || !ensured.keyboardNodeId) {
    return { document: doc, ok: false, reason: 'no_reply_capable_owner' };
  }
  doc = ensured.document;
  const kbId = ensured.keyboardNodeId;
  const kbNode = doc.nodes[kbId];
  const data = normalizeKeyboardNodeData(kbNode.data, kbNode.type);
  const rows = data.rows.length ? [...data.rows] : [{ buttons: [] }];
  const lastRow = rows[rows.length - 1];
  const buttonId = uid('btn');
  lastRow.buttons = [
    ...(lastRow.buttons || []),
    { id: buttonId, text: label, callbackId: label, graphRefId: '' },
  ];
  const operations = [...(ensured.operations || [])];
  const patchOp = createOperation('UpdateNodeData', { nodeId: kbId, data: { ...data, rows } });
  const patchResult = applyOperation(doc, patchOp);
  if (!patchResult.ok) return { document: doc, ok: false, reason: 'patch_failed' };
  operations.push(patchOp);
  return {
    document: patchResult.document,
    ok: true,
    keyboardNodeId: kbId,
    buttonId,
    operations,
  };
}

/**
 * Bind an inline keyboard button to an existing callback handler node.
 */
export function linkKeyboardButtonToHandler(document, keyboardNodeId, buttonId, handlerNodeId, options = {}) {
  const doc = createGraphDocument(document);
  const kbNode = doc.nodes[keyboardNodeId];
  if (!kbNode || kbNode.type !== 'inline_keyboard') {
    return { document: doc, ok: false, operations: [] };
  }
  const data = normalizeKeyboardNodeData(kbNode.data, kbNode.type);
  let found = false;
  const rows = data.rows.map((row) => ({
    buttons: row.buttons.map((btn) => {
      if (btn.id !== buttonId) return btn;
      found = true;
      return {
        ...btn,
        handlerNodeId,
        callbackRef: handlerNodeId,
        callbackId: options.callbackId || btn.callbackId,
        graphRefId: options.graphRefId || btn.graphRefId,
      };
    }),
  }));
  if (!found) return { document: doc, ok: false, operations: [] };
  const op = createOperation('UpdateNodeData', { nodeId: keyboardNodeId, data: { ...data, rows } });
  const result = applyOperation(doc, op);
  if (!result.ok) return { document: doc, ok: false, operations: [] };
  return { document: result.document, ok: true, operations: [op] };
}
