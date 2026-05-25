import { visualTypeLabel } from './visualNodeTypes.js';
import { resolveVisualType } from './runtimeToVisual.js';
import { getPreview } from '../blockPreview.js';

/**
 * @typedef {object} VisualNodeContent
 * @property {string} previewTitle
 * @property {string} previewBody
 * @property {readonly string[]} chips
 * @property {string | null} status
 * @property {string | null} analyticsBadge
 * @property {number} bodyLineCount
 * @property {{ field: string, placeholder: string } | null} inlineEdit
 */

function previewForVisual(visualType, runtimeType, props, meta, fallback) {
  const p = props || {};
  const rt = String(runtimeType || '');

  if (visualType === 'message') {
    const text = String(p.text || p.caption || '').trim();
    if (text) return text.length > 140 ? `${text.slice(0, 137)}…` : text;
    if (rt.includes('keyboard')) return fallback || 'Клавиатура';
    if (['photo', 'video', 'audio', 'document', 'sticker'].some((k) => rt.includes(k))) {
      return fallback || 'Медиа без подписи';
    }
    return 'Добавьте текст сообщения';
  }

  if (visualType === 'input') {
    if (p.question) return String(p.question).trim();
    if (rt.startsWith('on_')) return fallback || 'Событие от пользователя';
    return 'Настройте вопрос или триггер';
  }

  if (visualType === 'condition') {
    return String(p.cond || '').trim() || 'Задайте условие';
  }

  if (visualType === 'delay') {
    const sec = p.seconds ?? p.delay ?? p.ms;
    if (sec != null && sec !== '') return `${sec} сек.`;
    return rt === 'typing' ? 'Индикатор набора' : 'Укажите длительность';
  }

  if (visualType === 'variable') {
    const key = String(p.key || p.name || '').trim();
    const val = String(p.value ?? p.val ?? '').trim();
    if (key && val) return `${key} = ${val.length > 40 ? `${val.slice(0, 37)}…` : val}`;
    if (key) return key;
    return fallback || 'Ключ не задан';
  }

  if (visualType === 'api_request') {
    return String(p.url || p.event || p.model || '').trim() || fallback || 'Настройте запрос';
  }

  if (visualType === 'tag') {
    return String(p.tag || p.name || p.key || '').trim() || fallback || 'Имя тега';
  }

  if (visualType === 'goal') {
    if (rt === 'command') return `/${String(p.cmd || 'start').replace(/^\//, '')}`;
    if (rt === 'callback') return String(p.data || p.callback || '').trim() || 'Callback';
    return fallback || 'Точка входа в сценарий';
  }

  if (visualType === 'sequence') {
    return String(p.collection || p.items || '').trim() || fallback || 'Повтор или цикл';
  }

  if (visualType === 'split') {
    return fallback || 'Несколько веток';
  }

  return fallback || '';
}

function buildChips(visualType, runtimeType, props, meta, lang) {
  const chips = [visualTypeLabel(visualType, lang)];
  const rt = String(runtimeType || '');

  if (rt.startsWith('on_') || rt === 'callback' || rt === 'command') chips.push(lang === 'en' ? 'Trigger' : 'Триггер');
  if (visualType === 'condition') chips.push(lang === 'en' ? 'Branch' : 'Ветка');
  if (visualType === 'delay') chips.push(lang === 'en' ? 'Timer' : 'Таймер');
  const kb = Number(meta?.keyboardButtonCount) || 0;
  if (kb > 0) chips.push(`${kb} ${lang === 'en' ? 'btn' : 'кн.'}`);
  if (String(props?.text || '').includes('{')) chips.push(lang === 'en' ? 'Template' : 'Шаблон');

  return Object.freeze([...new Set(chips)].slice(0, 4));
}

function buildStatus(visualType, runtimeType, isChainRoot, meta) {
  if (isChainRoot) return 'Старт';
  if (meta?.invalid) return 'Ошибка';
  if (visualType === 'condition') return 'Да / Нет';
  if (runtimeType === 'stop') return 'Стоп';
  if (visualType === 'split') return 'Ветки';
  return null;
}

function buildAnalyticsBadge(runtimeType, props, meta) {
  const count = meta?.analyticsCount ?? meta?.sentCount ?? props?.sent;
  if (count != null && Number(count) >= 0) {
    return String(Number(count) > 999 ? '999+' : count);
  }
  if (runtimeType === 'analytics' && props?.event) return '●';
  return null;
}

function inlineEditSpec(visualType, runtimeType) {
  if (visualType === 'message') return { field: 'text', placeholder: 'Текст сообщения…' };
  if (visualType === 'input' && runtimeType === 'ask') return { field: 'question', placeholder: 'Вопрос пользователю…' };
  if (visualType === 'condition') return { field: 'cond', placeholder: 'Условие…' };
  if (visualType === 'delay') return { field: 'seconds', placeholder: 'Секунды…' };
  if (visualType === 'variable') return { field: 'key', placeholder: 'Имя переменной…' };
  if (visualType === 'tag') return { field: 'tag', placeholder: 'Тег…' };
  return null;
}

/**
 * Build visual-layer content from runtime node (editor only).
 * @param {object} params
 * @param {string} params.runtimeType
 * @param {object} [params.props]
 * @param {object} [params.meta]
 * @param {string} [params.paletteLabel]
 * @param {string} [params.description]
 * @param {boolean} [params.isChainRoot]
 * @param {string} [params.lang]
 */
export function buildVisualNodeContent({
  runtimeType,
  props,
  meta,
  paletteLabel,
  description,
  isChainRoot,
  lang = 'ru',
}) {
  const visualType = resolveVisualType(runtimeType);
  const fallback = getPreview(runtimeType, props, meta);
  let previewBody = previewForVisual(visualType, runtimeType, props, meta, fallback);
  if (!previewBody && description) {
    previewBody = description.length > 100 ? `${description.slice(0, 97)}…` : description;
  }
  if (!previewBody) {
    previewBody = lang === 'en'
      ? 'Configure in the panel on the right'
      : 'Настройте шаг в панели справа';
  }

  const previewTitle = paletteLabel || visualTypeLabel(visualType, lang);
  const bodyLineCount = Math.max(1, Math.min(5, Math.ceil(previewBody.length / 42)));

  return {
    previewTitle,
    previewBody,
    chips: buildChips(visualType, runtimeType, props, meta, lang),
    status: buildStatus(visualType, runtimeType, Boolean(isChainRoot), meta),
    analyticsBadge: buildAnalyticsBadge(runtimeType, props, meta),
    bodyLineCount,
    inlineEdit: inlineEditSpec(visualType, runtimeType),
  };
}
