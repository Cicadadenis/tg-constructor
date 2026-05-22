/**
 * Graph reference registry — single source for smart pickers (no raw string hunting).
 */

import { normalizeUiAttachments } from '../../../core/capabilityEngine.js';
import { isGraphKeyboardNode } from '../../../core/keyboard_topology.js';
import { normalizeKeyboardNodeData } from './graph_keyboard_nodes.js';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { graphResolveNodeType } from '../../app/graph/graphHelpers.js';
import { graphDocumentToStacks } from './stacks_bridge.js';

export const REF_CATEGORY = Object.freeze({
  CALLBACK_INLINE: 'callback_inline',
  CALLBACK_REPLY: 'callback_reply',
  CALLBACK_COMMAND: 'callback_command',
  CALLBACK_PREFIX: 'callback_prefix',
  GOTO_TARGET: 'goto_target',
  BLOCK_NAME: 'block_name',
  SCENARIO: 'scenario',
  STEP: 'step',
  COMMAND: 'command',
  CONDITION: 'condition',
  SAVE_KEY: 'save_key',
  SAVE_VALUE: 'save_value',
  MENU_ROUTE: 'menu_route',
});

/** @typedef {object} GraphReference
 * @property {string} id
 * @property {string} category
 * @property {string} displayLabel
 * @property {string} compileValue
 * @property {string} ownerNodeId
 * @property {string} ownerType
 * @property {string} [ownerLabel]
 * @property {string} [attachmentId]
 * @property {'data'|'label'|'prefix'} [bindField]
 */

function resolveNodeUiAttachments(node) {
  const meta = node?.meta && typeof node.meta === 'object' ? node.meta : {};
  const data = node?.data && typeof node.data === 'object' ? node.data : {};
  const dataMeta = data?.meta && typeof data.meta === 'object' ? data.meta : {};
  return normalizeUiAttachments(meta.uiAttachments || data.uiAttachments || dataMeta.uiAttachments);
}

export function makeRefId(category, ownerNodeId, subId = '') {
  const base = `graphref:${category}:${ownerNodeId}`;
  return subId ? `${base}:${subId}` : base;
}

/**
 * @param {object} document
 * @param {ReadonlyArray} [blockTypes]
 */
export function buildGraphReferenceIndex(document, blockTypes = []) {
  /** @type {GraphReference[]} */
  const refs = [];
  const byId = new Map();
  const byCategory = Object.fromEntries(
    Object.values(REF_CATEGORY).map((c) => [c, []]),
  );

  const push = (ref) => {
    if (!ref?.id || byId.has(ref.id)) return;
    byId.set(ref.id, ref);
    refs.push(ref);
    if (byCategory[ref.category]) byCategory[ref.category].push(ref);
  };

  const ingestCallbackHandler = (node) => {
    if (!node?.id || graphResolveNodeType(node) !== 'callback') return;
    const props = node.data && typeof node.data === 'object' ? node.data : {};
    const data = String(props.data || '').trim();
    const label = String(props.label || '').trim();
    const compileValue = data || label;
    if (!compileValue) return;
    const displayLabel = label || data || 'Обработчик';
    push({
      id: makeRefId(REF_CATEGORY.CALLBACK_INLINE, node.id, 'handler'),
      category: REF_CATEGORY.CALLBACK_INLINE,
      displayLabel,
      compileValue,
      ownerNodeId: node.id,
      ownerType: 'callback',
      ownerLabel: 'При нажатии',
      handlerNodeId: node.id,
      bindField: 'data',
    });
    if (data.includes(':')) {
      const prefix = `${data.split(':')[0]}:`;
      push({
        id: makeRefId(REF_CATEGORY.CALLBACK_PREFIX, node.id, prefix),
        category: REF_CATEGORY.CALLBACK_PREFIX,
        displayLabel: `${displayLabel} (${prefix}*)`,
        compileValue: prefix,
        ownerNodeId: node.id,
        ownerType: 'callback',
        bindField: 'prefix',
      });
    }
  };

  const ingestNode = (node) => {
    if (!node?.id) return;
    const type = graphResolveNodeType(node);
    if (type === 'callback') {
      ingestCallbackHandler(node);
      return;
    }
    const props = node.data && typeof node.data === 'object' ? node.data : {};
    const def = getBlockDef(type, blockTypes);
    const ownerLabel = def?.label || type;

    if (type === 'command') {
      const cmd = String(props.cmd || 'start').trim().replace(/^\//, '');
      if (cmd) {
        push({
          id: makeRefId(REF_CATEGORY.COMMAND, node.id),
          category: REF_CATEGORY.COMMAND,
          displayLabel: `/${cmd}`,
          compileValue: cmd,
          ownerNodeId: node.id,
          ownerType: type,
          ownerLabel,
          bindField: 'data',
        });
      }
    }

    if (type === 'scenario' || type === 'step' || type === 'block') {
      const name = String(props.name || '').trim();
      if (name) {
        push({
          id: makeRefId(type === 'step' ? REF_CATEGORY.STEP : REF_CATEGORY.SCENARIO, node.id),
          category: type === 'step' ? REF_CATEGORY.STEP : REF_CATEGORY.SCENARIO,
          displayLabel: name,
          compileValue: name,
          ownerNodeId: node.id,
          ownerType: type,
          ownerLabel,
        });
        push({
          id: makeRefId(REF_CATEGORY.GOTO_TARGET, node.id, 'name'),
          category: REF_CATEGORY.GOTO_TARGET,
          displayLabel: `${ownerLabel}: ${name}`,
          compileValue: name,
          ownerNodeId: node.id,
          ownerType: type,
          ownerLabel,
        });
      }
    }

    if (type === 'goto') {
      const target = String(props.target || '').trim();
      if (target) {
        push({
          id: makeRefId(REF_CATEGORY.GOTO_TARGET, node.id, 'self'),
          category: REF_CATEGORY.GOTO_TARGET,
          displayLabel: target,
          compileValue: target,
          ownerNodeId: node.id,
          ownerType: type,
          ownerLabel,
        });
      }
    }

    if (type === 'block' || type === 'use' || type === 'call_block') {
      const bn = String(props.name || props.blockname || '').trim();
      if (bn) {
        push({
          id: makeRefId(REF_CATEGORY.BLOCK_NAME, node.id),
          category: REF_CATEGORY.BLOCK_NAME,
          displayLabel: bn,
          compileValue: bn,
          ownerNodeId: node.id,
          ownerType: type,
          ownerLabel,
        });
      }
    }

    if (type === 'menu') {
      String(props.items || '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((item, i) => {
          push({
            id: makeRefId(REF_CATEGORY.MENU_ROUTE, node.id, `item_${i}`),
            category: REF_CATEGORY.MENU_ROUTE,
            displayLabel: item,
            compileValue: item,
            ownerNodeId: node.id,
            ownerType: type,
            ownerLabel,
          });
        });
    }

    if (['save', 'save_global', 'get', 'global', 'set_global', 'db_delete'].includes(type)) {
      const key = String(props.key || props.varname || '').trim();
      if (key) {
        push({
          id: makeRefId(REF_CATEGORY.SAVE_KEY, node.id),
          category: REF_CATEGORY.SAVE_KEY,
          displayLabel: key,
          compileValue: key,
          ownerNodeId: node.id,
          ownerType: type,
          ownerLabel,
        });
      }
    }

    if (type === 'condition' || type === 'condition_not') {
      const c = String(props.cond || '').trim();
      if (c) {
        push({
          id: makeRefId(REF_CATEGORY.CONDITION, node.id),
          category: REF_CATEGORY.CONDITION,
          displayLabel: c,
          compileValue: c,
          ownerNodeId: node.id,
          ownerType: type,
          ownerLabel,
        });
      }
    }

    if (isGraphKeyboardNode(type)) {
      const kb = normalizeKeyboardNodeData(node.data, type);
      kb.rows.forEach((row, ri) => {
        row.buttons.forEach((btn, bi) => {
          const text = String(btn.text || 'Кнопка').trim();
          const cb = String(btn.callbackId || text).trim();
          if (type === 'reply_keyboard') {
            push({
              id: makeRefId(REF_CATEGORY.CALLBACK_REPLY, node.id, btn.id || `r${ri}_${bi}`),
              category: REF_CATEGORY.CALLBACK_REPLY,
              displayLabel: text,
              compileValue: text,
              ownerNodeId: node.id,
              ownerType: type,
              ownerLabel,
              attachmentId: btn.id,
              bindField: 'data',
            });
            return;
          }
          if (btn.url) return;
          const handlerId = String(btn.handlerNodeId || btn.callbackRef || '').trim();
          const handlerNode = handlerId ? document?.nodes?.[handlerId] : null;
          const handlerData = handlerNode?.type === 'callback'
            ? String(handlerNode.data?.data || '').trim()
            : '';
          const compileValue = handlerData || cb;
          if (!compileValue && !handlerId) return;
          push({
            id: btn.graphRefId || makeRefId(REF_CATEGORY.CALLBACK_INLINE, node.id, btn.id || `i${ri}_${bi}`),
            category: REF_CATEGORY.CALLBACK_INLINE,
            displayLabel: handlerNode
              ? `${text} → ${handlerNode.data?.label || handlerData || 'handler'}`
              : text,
            compileValue,
            ownerNodeId: handlerId || node.id,
            ownerType: handlerId ? 'callback' : type,
            ownerLabel,
            attachmentId: btn.id,
            handlerNodeId: handlerId || undefined,
            bindField: 'data',
          });
        });
      });
    }

    const att = resolveNodeUiAttachments(node);
    att.inline.forEach((item) => {
      const text = String(item.text || 'Кнопка').trim();
      const cb = String(item.callback || text).trim();
      if (!cb) return;
      push({
        id: makeRefId(REF_CATEGORY.CALLBACK_INLINE, node.id, item.id || cb),
        category: REF_CATEGORY.CALLBACK_INLINE,
        displayLabel: text,
        compileValue: cb,
        ownerNodeId: node.id,
        ownerType: type,
        ownerLabel,
        attachmentId: item.id,
        bindField: 'data',
      });
      if (cb.includes(':')) {
        const prefix = `${cb.split(':')[0]}:`;
        push({
          id: makeRefId(REF_CATEGORY.CALLBACK_PREFIX, node.id, prefix),
          category: REF_CATEGORY.CALLBACK_PREFIX,
          displayLabel: `${text} (${prefix}*)`,
          compileValue: prefix,
          ownerNodeId: node.id,
          ownerType: type,
          ownerLabel,
          bindField: 'prefix',
        });
      }
    });
    att.buttons.forEach((item) => {
      const text = String(item.text || 'Кнопка').trim();
      if (!text) return;
      push({
        id: makeRefId(REF_CATEGORY.CALLBACK_REPLY, node.id, item.id || text),
        category: REF_CATEGORY.CALLBACK_REPLY,
        displayLabel: text,
        compileValue: text,
        ownerNodeId: node.id,
        ownerType: type,
        ownerLabel,
        attachmentId: item.id,
        bindField: 'label',
      });
    });

    if (type === 'buttons') {
      String(props.rows || '')
        .split('\n')
        .flatMap((row) => row.split(','))
        .forEach((text, i) => {
          const t = text.trim();
          if (!t) return;
          push({
            id: makeRefId(REF_CATEGORY.CALLBACK_REPLY, node.id, `row_${i}`),
            category: REF_CATEGORY.CALLBACK_REPLY,
            displayLabel: t,
            compileValue: t,
            ownerNodeId: node.id,
            ownerType: type,
            ownerLabel,
            bindField: 'label',
          });
        });
    }

    if (type === 'inline') {
      String(props.buttons || '')
        .split('\n')
        .flatMap((row) => row.split(','))
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((pair, i) => {
          const [title, cb] = pair.split(/\s*(?:->|=>|→|\|)\s*/).map((x) => x?.trim());
          const text = title || 'Кнопка';
          const val = cb || text;
          push({
            id: makeRefId(REF_CATEGORY.CALLBACK_INLINE, node.id, `legacy_${i}`),
            category: REF_CATEGORY.CALLBACK_INLINE,
            displayLabel: text,
            compileValue: val,
            ownerNodeId: node.id,
            ownerType: type,
            ownerLabel,
            bindField: 'data',
          });
        });
    }
  };

  for (const node of Object.values(document?.nodes || {})) {
    ingestNode(node);
  }

  try {
    const stacks = graphDocumentToStacks(document);
    for (const stack of stacks || []) {
      for (const block of stack.blocks || []) {
        ingestNode({
          id: block.id,
          type: block.type,
          data: block.props || {},
          meta: { uiAttachments: block.uiAttachments },
        });
      }
    }
  } catch {
    /* optional */
  }

  return Object.freeze({
    refs,
    byId,
    byCategory,
    builtAt: Date.now(),
  });
}

/** @param {ReturnType<typeof buildGraphReferenceIndex>} index */
export function getRefsByCategories(index, categories = []) {
  const set = new Set(categories);
  return (index?.refs || []).filter((r) => set.has(r.category));
}

/** Resolve ref from callback handler props (graph-bound). */
export function resolveCallbackBindingRef(index, props = {}, meta = {}) {
  const refId = String(meta?.graphRefId || props._graphRefId || '').trim();
  if (refId && index?.byId?.has(refId)) return index.byId.get(refId);
  const data = String(props.data || '').trim();
  const label = String(props.label || '').trim();
  if (data) {
    return (index?.refs || []).find(
      (r) => r.category === REF_CATEGORY.CALLBACK_INLINE && r.compileValue === data,
    ) || null;
  }
  if (label) {
    return (index?.refs || []).find(
      (r) => r.category === REF_CATEGORY.CALLBACK_REPLY && r.compileValue === label,
    ) || null;
  }
  return null;
}

export function listCallbackButtonRefs(index) {
  return getRefsByCategories(index, [
    REF_CATEGORY.CALLBACK_INLINE,
    REF_CATEGORY.CALLBACK_REPLY,
    REF_CATEGORY.COMMAND,
  ]);
}

/** Handlers + routes for inline keyboard action picker. */
export function listInlineKeyboardActionRefs(index) {
  return getRefsByCategories(index, [
    REF_CATEGORY.CALLBACK_INLINE,
    REF_CATEGORY.CALLBACK_COMMAND,
    REF_CATEGORY.GOTO_TARGET,
    REF_CATEGORY.BLOCK_NAME,
    REF_CATEGORY.SCENARIO,
    REF_CATEGORY.STEP,
    REF_CATEGORY.MENU_ROUTE,
  ]);
}
