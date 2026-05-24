import { getPreview } from '../blockPreview.js';
import { categoryDisplayLabel, resolveProductCategory } from './nodeCardTheme.js';

/**
 * @typedef {object} NodeCardContent
 * @property {import('./nodeCardTheme.js').ProductNodeCategory} productCategory
 * @property {string} categoryLabel
 * @property {string} previewTitle
 * @property {string} previewBody
 * @property {readonly string[]} tags
 * @property {string | null} status
 * @property {number} bodyLineCount
 */

function previewTitleForType(type) {
  const t = String(type || '');
  const map = {
    message: 'Текст сообщения',
    reply: 'Ответ пользователю',
    start: 'Точка входа',
    command: 'Команда бота',
    callback: 'Нажатие кнопки',
    condition: 'Условие ветвления',
    condition_not: 'Отрицание условия',
    else: 'Иначе',
    ask: 'Вопрос пользователю',
    delay: 'Пауза',
    loop: 'Цикл',
    classify: 'Классификация намерения',
    analytics: 'Событие аналитики',
    'db.get': 'Чтение из БД',
    'db.set': 'Запись в БД',
    bot: 'Настройки бота',
    inline_keyboard: 'Inline-клавиатура',
    reply_keyboard: 'Reply-клавиатура',
  };
  return map[t] || '';
}

function bodyFromProps(type, props, meta, fallbackPreview) {
  const p = props || {};
  const t = String(type || '');

  if (t === 'message' || t === 'reply' || t === 'caption') {
    const text = String(p.text || '').trim();
    if (text) return text.length > 120 ? `${text.slice(0, 117)}…` : text;
    return 'Текст не задан';
  }

  if (t === 'condition' || t === 'condition_not') {
    const c = String(p.cond || '').trim();
    return c || 'Условие не задано';
  }

  if (t === 'ask') {
    return String(p.question || '').trim() || 'Вопрос не задан';
  }

  if (t === 'command') {
    return `/${String(p.cmd || 'start').replace(/^\//, '')}`;
  }

  if (t === 'inline_keyboard' || t === 'reply_keyboard') {
    return fallbackPreview || 'Клавиатура';
  }

  if (fallbackPreview) return fallbackPreview;

  if (t === 'bot') {
    const token = String(p.token || '').trim();
    return token ? `Token · ${token.slice(0, 8)}…` : 'Token не задан';
  }

  return '';
}

function buildTags(type, props, meta, productCategory) {
  const tags = [categoryDisplayLabel(productCategory)];
  const p = props || {};
  const t = String(type || '');

  if (t.startsWith('on_') || t === 'callback' || t === 'start' || t === 'command') {
    tags.push('Триггер');
  }
  if (t === 'condition' || t === 'condition_not' || t === 'else') {
    tags.push('Ветка');
  }
  if (t === 'delay' || t === 'typing' || t === 'pause') {
    tags.push('Таймер');
  }
  if (t === 'loop' || t === 'foreach') {
    tags.push('Цикл');
  }
  const kb = Number(meta?.keyboardButtonCount) || 0;
  if (kb > 0) tags.push(`${kb} кн.`);
  if (String(p.text || '').includes('{')) tags.push('Шаблон');
  if (t.startsWith('db.')) tags.push('SQLite');

  return Object.freeze([...new Set(tags)].slice(0, 4));
}

function buildStatus(type, isChainRoot, meta) {
  if (isChainRoot) return 'Старт цепочки';
  if (meta?.invalid) return 'Ошибка связи';
  if (type === 'stop') return 'Стоп';
  if (type === 'condition' || type === 'condition_not') return '2 выхода';
  return null;
}

/**
 * @param {string} type
 * @param {object} [props]
 * @param {object} [meta]
 * @param {{ label?: string, description?: string, category?: string, isChainRoot?: boolean, lang?: string }} [ctx]
 * @returns {NodeCardContent}
 */
export function getNodeCardContent(type, props, meta, ctx = {}) {
  const registryCategory = ctx.category || 'logic';
  const productCategory = resolveProductCategory(type, registryCategory);
  const fallbackPreview = getPreview(type, props, meta);
  const previewTitle = previewTitleForType(type) || ctx.label || type;
  let previewBody = bodyFromProps(type, props, meta, fallbackPreview);
  if (!previewBody && ctx.description) {
    previewBody = ctx.description.length > 100
      ? `${ctx.description.slice(0, 97)}…`
      : ctx.description;
  }
  if (!previewBody) previewBody = 'Настройте блок в инспекторе справа';

  const isKeyboard = type === 'inline_keyboard' || type === 'reply_keyboard';
  const bodyLineCount = isKeyboard
    ? Math.max(1, previewBody.split('\n').filter(Boolean).length)
    : Math.max(1, Math.min(4, Math.ceil(previewBody.length / 38)));

  return {
    productCategory,
    categoryLabel: categoryDisplayLabel(productCategory, ctx.lang),
    previewTitle,
    previewBody,
    tags: buildTags(type, props, meta, productCategory),
    status: buildStatus(type, Boolean(ctx.isChainRoot), meta),
    bodyLineCount,
  };
}
