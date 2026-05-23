/**
 * Strict compile-time callback resolution — no stub handlers.
 */

import { parseInlineRows } from '../keyboards.js';
import { normalizeUiAttachments } from '../../capabilityEngine.js';
import {
  callbackKeysMatch,
  callbackPrefixMatches,
  expandCallbackMatchKeys,
  normalizeCallbackData,
} from '../callbackDataNormalize.js';
import { CodegenError } from '../errors.js';

/** @typedef {{ callbackData: string, sourceType: string, blockId?: string, stackId?: string, index?: number }} CallbackRequirement */

/** @typedef {{ stackId: string, root: object, prefixes: string[], exact: string[], isGeneric: boolean, hasBody: boolean }} CallbackHandlerSpec */

/**
 * @param {object} block
 * @returns {string[]}
 */
export function extractCallbackDataFromInline(block) {
  const out = [];
  for (const row of parseInlineRows(block?.props?.buttons || '')) {
    for (const btn of row) {
      const cb = normalizeCallbackData(btn?.callback_data);
      if (cb && !cb.startsWith('url:')) out.push(cb);
    }
  }
  return out;
}

/**
 * Inline callbacks from uiAttachments on message/reply blocks (sidebar UI).
 * @param {object} block
 * @returns {string[]}
 */
export function extractCallbackDataFromUiAttachments(block) {
  const att = normalizeUiAttachments(block?.uiAttachments);
  const out = [];
  for (const item of att.inline || []) {
    const raw = item?.callback ?? item?.callback_data ?? item?.callbackData ?? item?.text;
    const cb = normalizeCallbackData(String(raw || '').trim());
    if (cb && !cb.startsWith('url:')) out.push(cb);
  }
  return out;
}

function callbackPrefixFromBlock(block) {
  return String(block?.props?.dataPrefix || block?.props?.callbackPrefix || '').trim();
}

function exactDataFromBlock(block) {
  return String(block?.props?.data || block?.props?.callbackData || '').trim();
}

/**
 * @param {object[]} stacks
 * @returns {CallbackRequirement[]}
 */
export function collectRequiredCallbackData(stacks) {
  /** @type {CallbackRequirement[]} */
  const requirements = [];
  for (let si = 0; si < (stacks || []).length; si += 1) {
    const stack = stacks[si];
    const stackId = stack?.id || `stack_${si}`;
    const blocks = stack?.blocks || [];
    for (let i = 0; i < blocks.length; i += 1) {
      const b = blocks[i];
      if (b?.type === 'inline') {
        for (const cb of extractCallbackDataFromInline(b)) {
          requirements.push({
            callbackData: cb,
            sourceType: 'inline',
            blockId: b.id,
            stackId,
            index: i,
          });
        }
      }
      if (b?.boundKeyboard?.type === 'inline') {
        for (const cb of extractCallbackDataFromInline(b.boundKeyboard)) {
          requirements.push({
            callbackData: cb,
            sourceType: 'inline',
            blockId: b.id,
            stackId,
            index: i,
          });
        }
      }
      for (const cb of extractCallbackDataFromUiAttachments(b)) {
        requirements.push({
          callbackData: cb,
          sourceType: 'uiAttachments',
          blockId: b.id,
          stackId,
          index: i,
        });
      }
      const gk = b?._graphKeyboard;
      if (gk?.rows) {
        for (const row of gk.rows) {
          for (const btn of row.buttons || []) {
            const cb = normalizeCallbackData(btn.callbackId);
            if (!cb || cb.startsWith('url:')) continue;
            requirements.push({
              callbackData: cb,
              sourceType: 'graph_keyboard',
              blockId: b.id,
              stackId,
              index: i,
              buttonLabel: btn.text,
            });
          }
        }
      }
    }
  }
  return requirements;
}

/**
 * UI historically stored inline callback_data in props.label; map when it matches a requirement.
 * @param {object} root
 * @param {Set<string>} [requiredCallbackData]
 * @returns {string[]}
 */
function exactDataListFromBlock(root, requiredCallbackData) {
  const exact = [];
  const seen = new Set();
  const add = (value) => {
    const v = normalizeCallbackData(value);
    if (!v || seen.has(v)) return;
    seen.add(v);
    exact.push(v);
    for (const alias of expandCallbackMatchKeys(v)) {
      if (!seen.has(alias)) {
        seen.add(alias);
        exact.push(alias);
      }
    }
  };

  add(exactDataFromBlock(root));
  const prefix = callbackPrefixFromBlock(root);
  const label = String(root?.props?.label || '').trim();
  if (!prefix && label) {
    if (!requiredCallbackData) {
      add(label);
    } else {
      for (const req of requiredCallbackData) {
        if (callbackKeysMatch(req, label) || callbackKeysMatch(req, exactDataFromBlock(root))) {
          add(label);
          break;
        }
      }
    }
  }
  return exact;
}

/**
 * @param {object[]} stacks
 * @param {Set<string>} [requiredCallbackData]
 * @returns {CallbackHandlerSpec[]}
 */
export function collectCallbackHandlers(stacks, requiredCallbackData = null) {
  /** @type {CallbackHandlerSpec[]} */
  const handlers = [];
  for (let si = 0; si < (stacks || []).length; si += 1) {
    const stack = stacks[si];
    const blocks = stack?.blocks || [];
    if (!blocks.length || blocks[0]?.type !== 'callback') continue;
    const root = blocks[0];
    const prefix = callbackPrefixFromBlock(root);
    const exact = exactDataListFromBlock(root, requiredCallbackData);
    handlers.push({
      stackId: stack?.id || `stack_${si}`,
      root,
      prefixes: prefix ? [prefix] : [],
      exact,
      isGeneric: !prefix && !exact.length && !String(root?.props?.label || '').trim(),
      hasBody: blocks.length > 1,
    });
  }
  return handlers;
}

/**
 * @param {string} callbackData
 * @param {CallbackHandlerSpec[]} handlers
 */
export function callbackDataHasHandler(callbackData, handlers) {
  const required = normalizeCallbackData(callbackData);
  if (!required) return false;
  for (const h of handlers) {
    if (!h.hasBody) continue;
    if (h.exact.some((d) => callbackKeysMatch(required, d))) return true;
    if (h.prefixes.some((p) => callbackPrefixMatches(required, p))) return true;
  }
  return false;
}

/**
 * @param {object} flow
 * @param {CallbackHandlerSpec[]} handlers
 * @returns {{ code: string, message: string, blockId?: string }[]}
 */
export function validateCallbackHandlerConnectivity(flow, handlers) {
  const errors = [];
  const edges = flow?.edges || [];
  const nodes = flow?.nodes || [];
  const idToType = new Map(nodes.map((n) => [n.id, n?.data?.type || n?.type]));

  for (const h of handlers) {
    const rootId = h.root?.id;
    if (!h.hasBody) {
      errors.push({
        code: 'CALLBACK_HANDLER_DISCONNECTED',
        message: 'Узел «При нажатии» (callback) без тела handler — добавьте блоки ответа после entry',
        blockId: rootId,
      });
      continue;
    }
    if (!rootId || !edges.length) continue;
    // Auto-synthesized handlers exist only in stacks until stacksToFlow — skip graph edge check.
    if (!idToType.has(rootId)) continue;
    const hasFlowEdge = edges.some((e) => {
      if (e.source !== rootId) return false;
      const t = idToType.get(e.target);
      return t && t !== 'callback';
    });
    if (!hasFlowEdge) {
      errors.push({
        code: 'CALLBACK_HANDLER_DISCONNECTED',
        message: 'Callback handler не связан с поддеревом в графе (нет flow-ребра от entry)',
        blockId: rootId,
      });
    }
  }
  return errors;
}

/**
 * Validate flow edges reference existing nodes.
 * @param {object} flow
 * @returns {object[]}
 */
function validateOrphanEdges(flow) {
  const errors = [];
  const nodeIds = new Set(flow?.nodes?.map(n => n.id) || []);
  for (const edge of flow?.edges || []) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push({
        code: 'ORPHAN_EDGE',
        message: `Edge ${edge.id} references non-existent node (source=${edge.source}, target=${edge.target})`,
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
      });
    }
  }
  return errors;
}

/**
 * @param {object[]} stacks
 * @param {object} [flow]
 * @returns {{ ok: boolean, errors: object[], callbackMap: Map<string, string[]>, handlers: CallbackHandlerSpec[] }}
 */
export function buildCallbackMap(stacks, flow = null) {
  const requirements = collectRequiredCallbackData(stacks);
  const requiredSet = new Set(
    requirements.flatMap((r) => expandCallbackMatchKeys(r.callbackData)),
  );
  const handlers = collectCallbackHandlers(stacks, requiredSet);
  /** @type {Map<string, string[]>} */
  const callbackMap = new Map();

  for (const req of requirements) {
    const list = callbackMap.get(req.callbackData) || [];
    list.push(req.stackId || '');
    callbackMap.set(req.callbackData, list);
  }

  const errors = [];
  
  // Validate orphan edges before processing
  if (flow) {
    const orphanErrors = validateOrphanEdges(flow);
    errors.push(...orphanErrors);
  }

  const labelByCallback = new Map();
  for (const req of requirements) {
    if (req.buttonLabel && req.callbackData) {
      labelByCallback.set(req.callbackData, req.buttonLabel);
    }
  }

  for (const [callbackData, sources] of callbackMap) {
    if (!callbackDataHasHandler(callbackData, handlers)) {
      const buttonLabel = labelByCallback.get(callbackData);
      errors.push({
        code: 'MissingCallbackHandlerError',
        message: buttonLabel
          ? `У кнопки «${buttonLabel}» нет действия при нажатии`
          : `Нет handler для callback_data «${callbackData}» — добавьте блок «При нажатии» с data/callbackPrefix или exact data`,
        callbackData,
        buttonLabel,
        sources,
      });
    }
  }

  if (flow?.nodes?.length) {
    errors.push(...validateCallbackHandlerConnectivity(flow, handlers));
  }

  return {
    ok: errors.length === 0,
    errors,
    callbackMap,
    handlers,
    requirements,
  };
}

/**
 * @param {object[]} stacks
 * @param {object} [flow]
 * @throws {CodegenError}
 */
export function assertCallbackResolution(stacks, flow = null) {
  const result = buildCallbackMap(stacks, flow);
  if (result.ok) return result;
  const first = result.errors[0];
  throw new CodegenError(first.message, {
    code: first.code || 'MissingCallbackHandlerError',
    nodeId: first.blockId,
    blockType: 'inline',
  });
}

const COL_WIDTH = 260;
const COL_Y_STRIDE = 1000;

function cloneStacksForSynthesis(stacks) {
  return (stacks || []).map((stack) => ({
    ...stack,
    blocks: (stack.blocks || []).map((b) => ({
      ...b,
      props: { ...(b.props || {}) },
      boundKeyboard: b.boundKeyboard
        ? { ...b.boundKeyboard, props: { ...(b.boundKeyboard.props || {}) } }
        : undefined,
    })),
  }));
}

function nextHandlerColumn(flow, stacks) {
  let maxStride = 0;
  for (const n of flow?.nodes || []) {
    const y = Number(n?.position?.y) || 0;
    maxStride = Math.max(maxStride, Math.floor(y / COL_Y_STRIDE));
  }
  for (let si = 0; si < (stacks || []).length; si += 1) {
    const s = stacks[si];
    const y = Number(s?.y);
    if (Number.isFinite(y)) {
      maxStride = Math.max(maxStride, Math.floor(y / COL_Y_STRIDE));
    } else {
      maxStride = Math.max(maxStride, si);
    }
  }
  return maxStride + 1;
}

function sanitizeCallbackId(callbackData) {
  const s = String(callbackData || 'cb');
  if (/[^\x00-\x7F]/.test(s)) {
    const hex = [...new TextEncoder().encode(s)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `cb_${hex.slice(0, 40)}`;
  }
  const ascii = s
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (ascii || 'cb').slice(0, 48);
}

/** @param {string} callbackData */
function defaultCallbackReplyText(callbackData) {
  if (callbackData === 'callback_да') return 'Вы выбрали: Да';
  if (callbackData === 'callback_нет') return 'Вы выбрали: Нет';
  return `Обработано: ${callbackData}`;
}

/**
 * Auto-add «При нажатии» stacks (and message bodies for empty handlers) so strict compile can proceed.
 * @param {object[]} stacks
 * @param {object} [flow]
 * @returns {{ stacks: object[], fixes: object[] }}
 */
export function synthesizeMissingCallbackHandlers(stacks, flow = null) {
  const fixes = [];
  let next = cloneStacksForSynthesis(stacks);

  for (let si = 0; si < next.length; si += 1) {
    const blocks = next[si]?.blocks || [];
    if (!blocks.length || blocks[0]?.type !== 'callback' || blocks.length > 1) continue;
    const root = blocks[0];
    const replyId = `${root.id || `cb_${si}`}_auto_reply`;
    next[si] = {
      ...next[si],
      blocks: [
        ...blocks,
        {
          id: replyId,
          type: 'message',
          props: { text: 'Готово.' },
        },
      ],
    };
    fixes.push({
      kind: 'callback_handler_body',
      blockId: root.id,
      stackId: next[si]?.id || `stack_${si}`,
    });
  }

  let check = buildCallbackMap(next, flow);
  const missing = new Set();
  for (const e of check.errors) {
    if (e.code === 'MissingCallbackHandlerError' && e.callbackData) {
      missing.add(e.callbackData);
    }
  }

  if (missing.size) {
    let col = nextHandlerColumn(flow, next);
    for (const callbackData of missing) {
      const slug = sanitizeCallbackId(callbackData);
      const stackId = `auto_cb_${slug}`;
      const entryId = `${stackId}_entry`;
      next.push({
        id: stackId,
        x: col * COL_WIDTH,
        y: col * COL_Y_STRIDE,
        blocks: [
          { id: entryId, type: 'callback', props: { data: callbackData, label: callbackData } },
          {
            id: `${stackId}_reply`,
            type: 'message',
            props: { text: defaultCallbackReplyText(callbackData) },
          },
        ],
      });
      fixes.push({ kind: 'callback_handler', callbackData, stackId });
      col += 1;
    }
    check = buildCallbackMap(next, flow);
  }

  if (!fixes.length) {
    return { stacks, fixes: [] };
  }

  return { stacks: next, fixes };
}
