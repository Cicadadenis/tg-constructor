/**
 * Visual editor node types (ManyChat-style, marketer-facing).
 * Runtime/compiler types are mapped via runtimeToVisual.js — never stored in GraphDocument.
 */

/** @typedef {'message'|'input'|'condition'|'delay'|'action'|'api_request'|'tag'|'variable'|'goal'|'split'|'sequence'} VisualNodeType */

/** @typedef {object} VisualNodeSpec
 * @property {VisualNodeType} id
 * @property {string} icon
 * @property {string} accent
 * @property {string} muted
 * @property {string} border
 * @property {string} labelRu
 * @property {string} labelEn
 * @property {string} descriptionRu
 */

/** @type {Record<VisualNodeType, VisualNodeSpec>} */
export const VISUAL_NODE_SPECS = Object.freeze({
  message: {
    id: 'message',
    icon: '💬',
    accent: '#2563eb',
    muted: '#eff6ff',
    border: '#bfdbfe',
    labelRu: 'Сообщение',
    labelEn: 'Message',
    descriptionRu: 'Текст, медиа или кнопки для пользователя',
  },
  input: {
    id: 'input',
    icon: '✏️',
    accent: '#0d9488',
    muted: '#f0fdfa',
    border: '#99f6e4',
    labelRu: 'Ввод',
    labelEn: 'Input',
    descriptionRu: 'Ожидание ответа или события от пользователя',
  },
  condition: {
    id: 'condition',
    icon: '⑂',
    accent: '#7c3aed',
    muted: '#f5f3ff',
    border: '#ddd6fe',
    labelRu: 'Условие',
    labelEn: 'Condition',
    descriptionRu: 'Ветвление сценария по правилу',
  },
  delay: {
    id: 'delay',
    icon: '⏱',
    accent: '#d97706',
    muted: '#fffbeb',
    border: '#fde68a',
    labelRu: 'Пауза',
    labelEn: 'Delay',
    descriptionRu: 'Задержка перед следующим шагом',
  },
  action: {
    id: 'action',
    icon: '⚡',
    accent: '#dc2626',
    muted: '#fef2f2',
    border: '#fecaca',
    labelRu: 'Действие',
    labelEn: 'Action',
    descriptionRu: 'Служебный шаг или переход',
  },
  api_request: {
    id: 'api_request',
    icon: '🔗',
    accent: '#0891b2',
    muted: '#ecfeff',
    border: '#a5f3fc',
    labelRu: 'API запрос',
    labelEn: 'API Request',
    descriptionRu: 'Внешний сервис или AI-классификация',
  },
  tag: {
    id: 'tag',
    icon: '🏷',
    accent: '#db2777',
    muted: '#fdf2f8',
    border: '#fbcfe8',
    labelRu: 'Тег',
    labelEn: 'Tag',
    descriptionRu: 'Метка подписчика или глобальная переменная',
  },
  variable: {
    id: 'variable',
    icon: '{ }',
    accent: '#059669',
    muted: '#ecfdf5',
    border: '#a7f3d0',
    labelRu: 'Переменная',
    labelEn: 'Variable',
    descriptionRu: 'Сохранение или чтение данных',
  },
  goal: {
    id: 'goal',
    icon: '🎯',
    accent: '#ea580c',
    muted: '#fff7ed',
    border: '#fed7aa',
    labelRu: 'Цель',
    labelEn: 'Goal',
    descriptionRu: 'Точка входа или конверсия',
  },
  split: {
    id: 'split',
    icon: '⑃',
    accent: '#6366f1',
    muted: '#eef2ff',
    border: '#c7d2fe',
    labelRu: 'Разветвление',
    labelEn: 'Split',
    descriptionRu: 'Несколько исходящих веток',
  },
  sequence: {
    id: 'sequence',
    icon: '↻',
    accent: '#4f46e5',
    muted: '#eef2ff',
    border: '#c7d2fe',
    labelRu: 'Последовательность',
    labelEn: 'Sequence',
    descriptionRu: 'Цикл или повтор шагов',
  },
});

/**
 * @param {VisualNodeType} type
 * @param {string} [lang]
 */
export function visualTypeLabel(type, lang = 'ru') {
  const spec = VISUAL_NODE_SPECS[type] || VISUAL_NODE_SPECS.action;
  return lang === 'en' ? spec.labelEn : spec.labelRu;
}

/**
 * @param {VisualNodeType} type
 */
export function isVisualNodeType(type) {
  return Boolean(VISUAL_NODE_SPECS[type]);
}
