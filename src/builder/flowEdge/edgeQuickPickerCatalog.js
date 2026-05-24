/**
 * Quick block picker groups for inline "Add Step" on flow edges.
 */

/** @typedef {{ type: string, icon?: string }} EdgeQuickPickerItem */

/** @typedef {{ id: string, labelRu: string, labelEn: string, items: readonly EdgeQuickPickerItem[] }} EdgeQuickPickerGroup */

/** @type {readonly EdgeQuickPickerGroup[]} */
export const EDGE_QUICK_PICKER_GROUPS = Object.freeze([
  {
    id: 'message',
    labelRu: 'Сообщение',
    labelEn: 'Message',
    items: Object.freeze([
      { type: 'message', icon: '💬' },
      { type: 'reply', icon: '↩' },
    ]),
  },
  {
    id: 'condition',
    labelRu: 'Условие',
    labelEn: 'Condition',
    items: Object.freeze([
      { type: 'condition', icon: '⑂' },
      { type: 'condition_not', icon: '⊘' },
    ]),
  },
  {
    id: 'action',
    labelRu: 'Действие',
    labelEn: 'Action',
    items: Object.freeze([
      { type: 'delay', icon: '⏱' },
      { type: 'ask', icon: '?' },
      { type: 'command', icon: '/' },
    ]),
  },
  {
    id: 'ai',
    labelRu: 'AI',
    labelEn: 'AI',
    items: Object.freeze([
      { type: 'classify', icon: '✦' },
      { type: 'analytics', icon: '📊' },
    ]),
  },
  {
    id: 'database',
    labelRu: 'База данных',
    labelEn: 'Database',
    items: Object.freeze([
      { type: 'db.get', icon: '↓' },
      { type: 'db.set', icon: '↑' },
    ]),
  },
]);

/**
 * @param {string} [lang]
 */
export function edgeQuickPickerGroupLabel(group, lang = 'ru') {
  return lang === 'en' ? group.labelEn : group.labelRu;
}
