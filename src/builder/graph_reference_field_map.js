/**
 * Maps block property fields → graph reference categories for smart pickers.
 */

import { REF_CATEGORY } from '../constructor/graph_document/graph_reference_registry.js';

/** @typedef {{ categories: string[], label?: string, hideRaw?: boolean }} FieldRefConfig */

/** @type {Record<string, Record<string, FieldRefConfig>>} */
export const SMART_REF_FIELD_MAP = Object.freeze({
  callback: Object.freeze({
    _binding: Object.freeze({
      categories: [
        REF_CATEGORY.CALLBACK_INLINE,
        REF_CATEGORY.CALLBACK_REPLY,
        REF_CATEGORY.COMMAND,
      ],
      label: 'Какая кнопка',
      hideRaw: true,
    }),
    data: Object.freeze({
      categories: [REF_CATEGORY.CALLBACK_INLINE, REF_CATEGORY.COMMAND],
      label: 'Inline-кнопка',
      hideRaw: true,
    }),
    label: Object.freeze({
      categories: [REF_CATEGORY.CALLBACK_REPLY],
      label: 'Reply-кнопка',
      hideRaw: true,
    }),
    callbackPrefix: Object.freeze({
      categories: [REF_CATEGORY.CALLBACK_PREFIX],
      label: 'Группа кнопок (префикс)',
      hideRaw: true,
    }),
  }),
  goto: Object.freeze({
    target: Object.freeze({
      categories: [REF_CATEGORY.GOTO_TARGET, REF_CATEGORY.SCENARIO, REF_CATEGORY.STEP, REF_CATEGORY.COMMAND],
      label: 'Куда перейти',
    }),
  }),
  use: Object.freeze({
    blockname: Object.freeze({
      categories: [REF_CATEGORY.BLOCK_NAME],
      label: 'Какой блок вызвать',
    }),
  }),
  call_block: Object.freeze({
    blockname: Object.freeze({
      categories: [REF_CATEGORY.BLOCK_NAME],
      label: 'Какой блок вызвать',
    }),
  }),
  condition: Object.freeze({
    cond: Object.freeze({
      categories: [REF_CATEGORY.CONDITION, REF_CATEGORY.SAVE_KEY],
      label: 'Условие',
    }),
  }),
  condition_not: Object.freeze({
    cond: Object.freeze({
      categories: [REF_CATEGORY.CONDITION, REF_CATEGORY.SAVE_KEY],
      label: 'Условие (отрицание)',
    }),
  }),
  save: Object.freeze({
    key: Object.freeze({ categories: [REF_CATEGORY.SAVE_KEY], label: 'Ключ' }),
    value: Object.freeze({ categories: [REF_CATEGORY.SAVE_VALUE], label: 'Значение' }),
  }),
  get: Object.freeze({
    key: Object.freeze({ categories: [REF_CATEGORY.SAVE_KEY], label: 'Ключ' }),
  }),
  menu: Object.freeze({
    items: Object.freeze({ categories: [REF_CATEGORY.MENU_ROUTE], label: 'Пункт меню' }),
  }),
});

/**
 * @param {string} blockType
 * @param {string} fieldKey
 * @returns {FieldRefConfig|null}
 */
export function getSmartRefFieldConfig(blockType, fieldKey) {
  return SMART_REF_FIELD_MAP[blockType]?.[fieldKey] || null;
}

export function usesSmartRefPicker(blockType, fieldKey) {
  return Boolean(getSmartRefFieldConfig(blockType, fieldKey));
}
