/**
 * Repair inline callback_data ↔ «При нажатии» handlers in legacy / incomplete projects.
 */

import {
  buildCallbackMap,
  collectRequiredCallbackData,
  synthesizeMissingCallbackHandlers,
} from '../../../core/codegen/ast/callbackResolver.js';
import { callbackKeysMatch } from '../../../core/codegen/callbackDataNormalize.js';

function cloneStacks(stacks) {
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

/**
 * Move inline callback_data from legacy props.label into props.data when it matches a requirement.
 * @param {object[]} stacks
 * @returns {boolean}
 */
function migrateCallbackLabelToData(stacks) {
  const required = collectRequiredCallbackData(stacks).map((r) => r.callbackData);
  if (!required.length) return false;
  let changed = false;
  for (const stack of stacks) {
    const root = stack?.blocks?.[0];
    if (root?.type !== 'callback') continue;
    const props = root.props || {};
    const data = String(props.data || props.callbackData || '').trim();
    const prefix = String(props.dataPrefix || props.callbackPrefix || '').trim();
    const label = String(props.label || '').trim();
    if (data || prefix || !label) continue;
    const labelMatches = required.some((req) => callbackKeysMatch(req, label));
    if (!labelMatches) continue;
    props.data = label;
    props.label = '';
    changed = true;
  }
  return changed;
}

/**
 * @param {object[]} stacks
 * @returns {{ stacks: object[], modified: boolean, fixes: object[] }}
 */
export function repairCallbackHandlersInStacks(stacks) {
  let next = cloneStacks(stacks);
  let modified = migrateCallbackLabelToData(next);

  const beforeOk = buildCallbackMap(next).ok;
  if (beforeOk) {
    return { stacks: next, modified, fixes: [] };
  }

  const synth = synthesizeMissingCallbackHandlers(next, null);
  if (synth.fixes.length) {
    next = synth.stacks;
    modified = true;
  }

  return { stacks: next, modified, fixes: synth.fixes };
}
