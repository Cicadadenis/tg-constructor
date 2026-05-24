/**
 * Graph → AST binding: attach keyboard blocks to nearest output node (no ghost messages).
 */

import { normalizeUiAttachments } from '../../capabilityEngine.js';
import { keyboardCodegenAlias, isGraphKeyboardNode } from '../../keyboard_topology.js';
import { keyboardDataToCodegenProps } from '../../keyboard_codegen.js';
import { ROLE_KEYBOARD, ROLE_OUTPUT_BIND_TARGET } from '../../rules/aiogram3BlockRoles.js';
import { isForeachKeyboardOutput } from '../foreachCodegen.js';

function uiAttachmentItemsToKeyboardProps(kind, items) {
  if (kind === 'buttons') {
    const labels = (items || []).map((i) => String(i?.text || '').trim()).filter(Boolean);
    return labels.length ? { rows: labels.join(', ') } : null;
  }
  if (kind === 'inline') {
    const lines = (items || [])
      .map((i) => {
        const text = String(i?.text || 'Кнопка').trim();
        const cb = String(i?.callback || text).trim();
        return text ? `${text} → ${cb}` : '';
      })
      .filter(Boolean);
    return lines.length ? { buttons: lines.join('\n') } : null;
  }
  return null;
}

/**
 * UI attachments on message/reply blocks (sidebar «UI к сообщению») → boundKeyboard for codegen.
 * @param {object[]} stacks
 * @returns {{ stacks: object[], ok: boolean, errors: object[] }}
 */
export function applyUiAttachmentsBinding(stacks) {
  const out = cloneStacks(stacks);
  for (const stack of out) {
    for (const block of stack.blocks || []) {
      if (!ROLE_OUTPUT_BIND_TARGET.has(block?.type) || block.boundKeyboard) continue;
      const att = normalizeUiAttachments(block.uiAttachments);
      if (att.inline.length) {
        const props = uiAttachmentItemsToKeyboardProps('inline', att.inline);
        if (props) {
          block.boundKeyboard = {
            id: `ua_inline_${block.id}`,
            type: 'inline',
            props,
          };
        }
      } else if (att.buttons.length) {
        const props = uiAttachmentItemsToKeyboardProps('buttons', att.buttons);
        if (props) {
          block.boundKeyboard = {
            id: `ua_buttons_${block.id}`,
            type: 'buttons',
            props,
          };
        }
      }
    }
  }
  return { stacks: out, ok: true, errors: [] };
}

/**
 * @param {object[]} stacks
 * @returns {{ stacks: object[], ok: boolean, errors: object[] }}
 */
export function bindStacksForCodegen(stacks) {
  const ui = applyUiAttachmentsBinding(stacks || []);
  return applyKeyboardBinding(ui.stacks);
}

function cloneStacks(stacks) {
  return (stacks || []).map((stack) => ({
    ...stack,
    blocks: (stack.blocks || []).map((b) => ({
      ...b,
      props: { ...(b.props || {}) },
      boundKeyboard: b.boundKeyboard ? { ...b.boundKeyboard, props: { ...b.boundKeyboard.props } } : undefined,
    })),
  }));
}

/**
 * @param {object[]} blocks
 * @returns {number}
 */
function findBindTargetIndex(blocks, keyboardIndex) {
  for (let j = keyboardIndex - 1; j >= 0; j -= 1) {
    if (ROLE_OUTPUT_BIND_TARGET.has(blocks[j]?.type)) return j;
  }
  for (let j = keyboardIndex + 1; j < blocks.length; j += 1) {
    if (ROLE_OUTPUT_BIND_TARGET.has(blocks[j]?.type)) return j;
  }
  return -1;
}

/**
 * @param {object[]} stacks
 * @returns {{ stacks: object[], ok: boolean, errors: object[] }}
 */
export function applyKeyboardBinding(stacks) {
  const errors = [];
  const out = cloneStacks(stacks);

  for (const stack of out) {
    const blocks = stack.blocks || [];
    const remove = new Set();

    for (let i = 0; i < blocks.length; i += 1) {
      const kb = blocks[i];
      const kbType = String(kb?.type || '').trim();
      const roleType = isGraphKeyboardNode(kbType) ? keyboardCodegenAlias(kbType) : kbType;
      const isForeachKb = kbType === 'foreach' && isForeachKeyboardOutput(kb?.props);
      if (
        !isForeachKb
        && !ROLE_KEYBOARD.has(kbType)
        && !ROLE_KEYBOARD.has(roleType)
      ) {
        continue;
      }

      const targetIdx = findBindTargetIndex(blocks, i);
      if (targetIdx < 0) {
        errors.push({
          code: 'KeyboardWithoutOutputNode',
          message:
            'Клавиатура должна быть привязана к блоку ответа (message / photo / video / document / poll / contact / location)',
          blockType: kb.type,
          nodeId: kb.id,
          stackId: stack.id,
        });
        continue;
      }

      const target = blocks[targetIdx];
      if (target.boundKeyboard) {
        errors.push({
          code: 'DUPLICATE_KEYBOARD_BIND',
          message: `У блока «${target.type}» уже есть привязанная клавиатура`,
          blockType: kb.type,
          nodeId: kb.id,
          stackId: stack.id,
        });
        continue;
      }

      const codegenProps = isGraphKeyboardNode(kbType)
        ? (keyboardDataToCodegenProps(kbType, kb._graphKeyboard || kb.props) || kb.props || {})
        : (kb.props || {});
      target.boundKeyboard = {
        id: kb.id,
        type: isForeachKb ? 'foreach' : roleType,
        props: { ...codegenProps },
      };
      remove.add(i);
    }

    if (remove.size) {
      stack.blocks = blocks.filter((_, idx) => !remove.has(idx));
    }
  }

  return { stacks: out, ok: errors.length === 0, errors };
}
