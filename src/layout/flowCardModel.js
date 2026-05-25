/**
 * Flow card view-model — sorting, copy, presentation helpers.
 */

import { deriveFlowListMeta } from './flowListMeta.js';

const TRIGGER_ICONS = {
  start: '▶',
  command: '⌘',
  callback: '↩',
  on_text: '💬',
  on_photo: '🖼',
  on_voice: '🎤',
  on_document: '📎',
  else: '◇',
  scenario: '⚡',
};

const STATUS_COPY = {
  en: { active: 'Active', draft: 'Draft', archived: 'Archived' },
  ru: { active: 'Активен', draft: 'Черновик', archived: 'В архиве' },
  uk: { active: 'Активний', draft: 'Чернетка', archived: 'В архіві' },
};

/**
 * @param {string} lang
 * @param {Date|string|number} raw
 */
export function formatRelativeUpdated(lang, raw) {
  if (!raw) return '';
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (lang === 'en') {
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (mins < 1) return lang === 'uk' ? 'Щойно' : 'Только что';
  if (mins < 60) return `${mins} мин`;
  if (hours < 24) return `${hours} ч`;
  if (days < 7) return `${days} дн`;
  return date.toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'ru-RU', { month: 'short', day: 'numeric' });
}

/**
 * @param {object} item
 * @param {string} lang
 * @returns {object}
 */
export function buildFlowCardViewModel(item, lang = 'ru') {
  const meta = item.triggerLabel
    ? { triggerLabel: item.triggerLabel, nodeCount: item.nodeCount ?? 0, triggerType: item.triggerType }
    : deriveFlowListMeta(lang, null);
  const triggerType = item.triggerType || 'scenario';
  const title = item.name || item.triggerLabel || (lang === 'en' ? 'Untitled flow' : 'Без названия');
  const description = item.description
    || (meta.nodeCount > 0
      ? (lang === 'en'
        ? `${meta.nodeCount} steps · ${meta.triggerLabel} entry`
        : lang === 'uk'
          ? `${meta.nodeCount} кроків · вхід ${meta.triggerLabel}`
          : `${meta.nodeCount} шагов · вход ${meta.triggerLabel}`)
      : (lang === 'en' ? 'Empty flow — add a trigger on canvas' : 'Пустой сценарий — добавьте триггер на холсте'));

  const status = item.status || 'draft';
  const statusLabels = STATUS_COPY[lang === 'en' ? 'en' : lang === 'uk' ? 'uk' : 'ru'];

  const updatedRaw = item.updatedAtIso || item.updated_at || item.updatedAt;
  const analyticsCount = item.analyticsCount ?? (status === 'active' ? meta.nodeCount * 3 : 0);

  return {
    ...item,
    title,
    description,
    triggerLabel: meta.triggerLabel,
    triggerType,
    triggerIcon: TRIGGER_ICONS[triggerType] || TRIGGER_ICONS.scenario,
    nodeCount: meta.nodeCount,
    status,
    statusLabel: statusLabels[status] || status,
    updatedRelative: formatRelativeUpdated(lang, updatedRaw),
    analyticsCount,
    analyticsLabel: analyticsCount > 0
      ? (analyticsCount > 999 ? `${(analyticsCount / 1000).toFixed(1)}k` : String(analyticsCount))
      : null,
  };
}

/** @typedef {'updated' | 'name' | 'status'} FlowSortKey */

/**
 * @param {object[]} items
 * @param {FlowSortKey} sortBy
 * @param {'asc' | 'desc'} direction
 */
export function sortFlowItems(items, sortBy = 'updated', direction = 'desc') {
  const dir = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sortBy === 'name') {
      return dir * String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    }
    if (sortBy === 'status') {
      const order = { active: 0, draft: 1, archived: 2 };
      return dir * ((order[a.status] ?? 9) - (order[b.status] ?? 9));
    }
    const ta = new Date(a.updatedAtIso || a.updated_at || 0).getTime();
    const tb = new Date(b.updatedAtIso || b.updated_at || 0).getTime();
    return dir * (ta - tb);
  });
}
