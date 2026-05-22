/**
 * Graph keyboard nodes — rows/buttons/callback refs, topology, migration from uiAttachments.
 */

import {
  GRAPH_KEYBOARD_NODE_TYPES,
  isGraphKeyboardNode,
  isReplyCapable,
  KEYBOARD_EDGE_SOURCE_PORT,
  KEYBOARD_EDGE_TARGET_PORT,
} from '../../../core/keyboard_topology.js';
import {
  keyboardDataToCodegenProps,
  normalizeKeyboardRows,
  keyboardNodeToStackBlock as coreKeyboardNodeToStackBlock,
} from '../../../core/keyboard_codegen.js';
import { normalizeUiAttachments } from '../../../core/capabilityEngine.js';
import { createGraphDocument } from './graph_document.js';

function uid(prefix = 'kb') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(2, 6)}`;
}

/** Auto callback id from button label (stable slug, no raw user callback_data in UI). */
export function generateCallbackId(label, existing = new Set()) {
  const base = String(label || 'button')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'button';
  let id = `callback_${base}`;
  let n = 2;
  while (existing.has(id)) {
    id = `callback_${base}_${n}`;
    n += 1;
  }
  existing.add(id);
  return id;
}

export function emptyKeyboardData(kind = 'inline_keyboard') {
  return {
    layout: kind === 'reply_keyboard' ? 'reply' : 'inline',
    resizeKeyboard: true,
    oneTimeKeyboard: false,
    rows: [],
  };
}

export function normalizeKeyboardNodeData(data, nodeType = 'inline_keyboard') {
  const kb = normalizeKeyboardRows(data, nodeType);
  return {
    ...kb,
    rows: kb.rows.map((row) => ({
      buttons: row.buttons.map((btn) => ({
        ...btn,
        id: String(btn.id || uid('btn')),
      })),
    })),
  };
}

export function countKeyboardButtons(data) {
  const kb = normalizeKeyboardNodeData(data);
  return kb.rows.reduce((n, row) => n + (row.buttons?.length || 0), 0);
}

export { keyboardDataToCodegenProps };

export function keyboardNodeToStackBlock(node, document = null) {
  const data = normalizeKeyboardNodeData(node?.data || node?.props, node.type);
  const nodes = document?.nodes || {};
  const resolved = {
    ...data,
    rows: data.rows.map((row) => ({
      buttons: row.buttons.map((btn) => {
        if (btn.url) return btn;
        const handlerId = String(btn.handlerNodeId || btn.callbackRef || '').trim();
        const handler = handlerId ? nodes[handlerId] : null;
        if (handler?.type === 'callback') {
          const fromHandler = String(handler.data?.data || '').trim();
          if (fromHandler) {
            return { ...btn, callbackId: fromHandler };
          }
        }
        return btn;
      }),
    })),
  };
  const block = coreKeyboardNodeToStackBlock({
    id: node.id,
    type: node.type,
    data: resolved,
  });
  return block;
}

function buildAdjacency(document) {
  const nodes = document?.nodes || {};
  const outgoing = new Map();
  const incoming = new Map();
  for (const id of Object.keys(nodes)) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const edge of Object.values(document?.edges || {})) {
    if (edge.invalid) continue;
    outgoing.get(edge.source)?.push(edge);
    incoming.get(edge.target)?.push(edge);
  }
  return { nodes, outgoing, incoming };
}

export function findKeyboardEdgeForOwner(document, ownerNodeId) {
  const { outgoing } = buildAdjacency(document);
  return (outgoing.get(ownerNodeId) || []).find(
    (e) => (e.sourcePort || 'flow') === KEYBOARD_EDGE_SOURCE_PORT,
  ) || null;
}

export function findKeyboardNodeForOwner(document, ownerNodeId) {
  const edge = findKeyboardEdgeForOwner(document, ownerNodeId);
  if (!edge) return null;
  return document.nodes[edge.target] || null;
}

export function findReplyOwnerForKeyboard(document, keyboardNodeId) {
  const { nodes, incoming } = buildAdjacency(document);
  const kb = nodes[keyboardNodeId];
  if (!kb || !isGraphKeyboardNode(kb.type)) return null;
  for (const edge of incoming.get(keyboardNodeId) || []) {
    if ((edge.targetPort || 'flow') !== KEYBOARD_EDGE_TARGET_PORT
      && (edge.sourcePort || 'flow') !== KEYBOARD_EDGE_SOURCE_PORT) continue;
    const owner = nodes[edge.source];
    if (owner && isReplyCapable(owner.type)) return owner;
  }
  return null;
}

/**
 * Capability-based reply chain: keyboard must attach to reply-capable node, not only message.
 * @returns {Array<{ code: string, severity: string, nodeId?: string, message: string, buttonLabel?: string }>}
 */
export function validateReplyChain(document, options = {}) {
  const strict = Boolean(options.strict);
  const severity = strict ? 'error' : 'warning';
  const issues = [];
  const { nodes, incoming } = buildAdjacency(document);

  for (const [id, node] of Object.entries(nodes)) {
    if (!isGraphKeyboardNode(node.type)) continue;
    const ownerEdge = (incoming.get(id) || []).find(
      (e) => (e.sourcePort || '') === KEYBOARD_EDGE_SOURCE_PORT
        || (e.targetPort || '') === KEYBOARD_EDGE_TARGET_PORT,
    );
    if (!ownerEdge) {
      issues.push({
        code: 'KeyboardWithoutOutputNode',
        severity,
        nodeId: id,
        message: 'Клавиатура не привязана к ответу или медиа — проведите линию от блока «Фото» / «Ответ»',
      });
      continue;
    }
    const owner = nodes[ownerEdge.source];
    if (!owner || !isReplyCapable(owner.type)) {
      issues.push({
        code: 'KeyboardWithoutOutputNode',
        severity,
        nodeId: id,
        message: `Клавиатура «${node.type}» может висеть только под текстом или медиа, не под «${owner?.type || '?'}»`,
      });
    }
  }

  for (const [id, node] of Object.entries(nodes)) {
    if (!isReplyCapable(node.type)) continue;
    const att = normalizeUiAttachments(node.meta?.uiAttachments);
    if (att.inline.length || att.buttons.length) {
      issues.push({
        code: 'legacy_ui_attachments',
        severity: 'warning',
        nodeId: id,
        message: 'Кнопки всё ещё в старом формате (вложения). Запустите миграцию или добавьте блок клавиатуры заново.',
      });
    }
  }

  return issues;
}

/**
 * Missing handler diagnostics with human button labels.
 */
export function collectKeyboardButtonDiagnostics(document, options = {}) {
  const soft = Boolean(options.allowMissingHandlers);
  const severity = soft ? 'warning' : 'error';
  const issues = [];
  const handlerData = new Set(
    Object.values(document.nodes || {})
      .filter((n) => n.type === 'callback')
      .map((n) => String(n.data?.data || n.data?.label || '').trim())
      .filter(Boolean),
  );

  for (const node of Object.values(document.nodes || {})) {
    if (!isGraphKeyboardNode(node.type)) continue;
    const data = normalizeKeyboardNodeData(node.data, node.type);
    if (node.type !== 'inline_keyboard' && data.layout === 'reply') continue;
    for (const row of data.rows) {
      for (const btn of row.buttons) {
        if (btn.url || btn.type === 'url') continue;
        const cb = String(btn.callbackId || '').trim();
        const hasHandler = Boolean(
          btn.handlerNodeId && document.nodes[btn.handlerNodeId],
        ) || (cb && handlerData.has(cb));
        if (!hasHandler) {
          issues.push({
            code: 'missing_handlers',
            severity,
            nodeId: node.id,
            buttonLabel: btn.text,
            callbackData: cb,
            message: `У кнопки «${btn.text}» нет действия при нажатии`,
          });
        }
      }
    }
  }
  return issues;
}

function inlineAttachmentToButton(item, usedCallbacks) {
  const text = String(item.text || 'Кнопка').trim() || 'Кнопка';
  const callbackId = generateCallbackId(
    String(item.callback || item.callback_data || text),
    usedCallbacks,
  );
  return {
    id: String(item.id || uid('btn')),
    text,
    callbackId,
    graphRefId: '',
  };
}

function replyAttachmentToButton(item) {
  const text = String(item.text || 'Кнопка').trim() || 'Кнопка';
  return {
    id: String(item.id || uid('btn')),
    text,
    callbackId: text,
    graphRefId: '',
  };
}

/**
 * Migrate meta.uiAttachments.inline/buttons → keyboard nodes + keyboard edges.
 * Idempotent: skips owners that already have a keyboard edge.
 */
export function migrateUiAttachmentsToKeyboardNodes(document) {
  const doc = createGraphDocument(document);
  const nodes = { ...doc.nodes };
  const edges = { ...doc.edges };
  let modified = false;
  const usedCallbacks = new Set();

  for (const [ownerId, node] of Object.entries(nodes)) {
    if (!isReplyCapable(node.type)) continue;
    if (findKeyboardEdgeForOwner({ nodes, edges }, ownerId)) continue;
    const att = normalizeUiAttachments(node.meta?.uiAttachments);
    const hasInline = att.inline.length > 0;
    const hasButtons = att.buttons.length > 0;
    if (!hasInline && !hasButtons) continue;

    const kbType = hasInline ? 'inline_keyboard' : 'reply_keyboard';
    const kbId = uid(kbType === 'inline_keyboard' ? 'ikb' : 'rkb');
    const rows = [{
      buttons: (hasInline ? att.inline : att.buttons).map((item) => (
        hasInline
          ? inlineAttachmentToButton(item, usedCallbacks)
          : replyAttachmentToButton(item)
      )),
    }];

    const ownerY = Number(node.position?.y) || 120;
    const ownerX = Number(node.position?.x) || 120;
    nodes[kbId] = {
      id: kbId,
      type: kbType,
      position: { x: ownerX, y: ownerY + 52 },
      data: normalizeKeyboardNodeData({ rows }, kbType),
      meta: { keyboardParentId: ownerId },
    };
    const edgeId = `edge_kb_${ownerId}_${kbId}`;
    edges[edgeId] = {
      id: edgeId,
      source: ownerId,
      target: kbId,
      sourcePort: KEYBOARD_EDGE_SOURCE_PORT,
      targetPort: KEYBOARD_EDGE_TARGET_PORT,
    };

    const nextMeta = { ...(node.meta || {}) };
    nextMeta.uiAttachments = normalizeUiAttachments(null);
    nodes[ownerId] = { ...node, meta: nextMeta };
    modified = true;
  }

  if (!modified) return { document: doc, modified: false };
  return {
    document: createGraphDocument({ ...doc, nodes, edges }),
    modified: true,
  };
}

export { GRAPH_KEYBOARD_NODE_TYPES };
