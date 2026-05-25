/**
 * SaaS sidebar — list filters and copy per section.
 */

/** @typedef {import('./appSections.js').AppSection} ControlPanelSection */

/** @type {Record<string, { filterKeys: string[], listTitleKey: string }>} */
export const SECTION_PANEL_CONFIG = Object.freeze({
  flows: {
    filterKeys: ['all', 'active', 'draft', 'favorites', 'archived'],
    listTitleKey: 'flows',
  },
  automations: {
    filterKeys: ['all', 'active'],
    listTitleKey: 'automations',
  },
  broadcasts: {
    filterKeys: ['all', 'scheduled', 'sent'],
    listTitleKey: 'broadcasts',
  },
  audience: {
    filterKeys: ['all', 'subscribed', 'blocked'],
    listTitleKey: 'audience',
  },
  templates: {
    filterKeys: [],
    listTitleKey: 'templates',
  },
  analytics: {
    filterKeys: [],
    listTitleKey: 'analytics',
  },
  settings: {
    filterKeys: ['all', 'system', 'bot'],
    listTitleKey: 'settings',
  },
});

/** @param {string} lang @param {ControlPanelSection} section @param {string} filterKey */
export function filterLabel(lang, section, filterKey) {
  const en = {
    all: 'All',
    active: 'Active',
    draft: 'Draft',
    favorites: 'Favorites',
    archived: 'Archived',
    scheduled: 'Scheduled',
    sent: 'Sent',
    subscribed: 'Subscribed',
    blocked: 'Blocked',
    system: 'System',
    bot: 'Bot',
  };
  const ru = {
    all: 'Все',
    active: 'Активные',
    draft: 'Черновики',
    favorites: 'Избранное',
    archived: 'Архив',
    scheduled: 'Запланированные',
    sent: 'Отправленные',
    subscribed: 'Подписаны',
    blocked: 'Заблокированы',
    system: 'Система',
    bot: 'Бот',
  };
  const uk = {
    all: 'Усі',
    active: 'Активні',
    draft: 'Чернетки',
    favorites: 'Обране',
    archived: 'Архів',
    scheduled: 'Заплановані',
    sent: 'Надіслані',
    subscribed: 'Підписані',
    blocked: 'Заблоковані',
    system: 'Система',
    bot: 'Бот',
  };
  const table = lang === 'en' ? en : lang === 'uk' ? uk : ru;
  return table[filterKey] || filterKey;
}

/** @param {string} lang @param {ControlPanelSection} section */
export function listTitleForSection(lang, section) {
  const titles = {
    en: {
      flows: 'Flows',
      automations: 'Automations',
      broadcasts: 'Broadcasts',
      audience: 'Audience',
      templates: 'Templates',
      analytics: 'Analytics',
      settings: 'Settings',
    },
    ru: {
      flows: 'Сценарии',
      automations: 'Автоматизации',
      broadcasts: 'Рассылки',
      audience: 'Аудитория',
      templates: 'Шаблоны',
      analytics: 'Аналитика',
      settings: 'Настройки',
    },
    uk: {
      flows: 'Сценарії',
      automations: 'Автоматизації',
      broadcasts: 'Розсилки',
      audience: 'Аудиторія',
      templates: 'Шаблони',
      analytics: 'Аналітика',
      settings: 'Налаштування',
    },
  };
  const t = titles[lang === 'en' ? 'en' : lang === 'uk' ? 'uk' : 'ru'];
  const key = SECTION_PANEL_CONFIG[section]?.listTitleKey || 'flows';
  return t[key] || key;
}

/**
 * @param {object} item
 * @param {string} filterKey
 * @param {ControlPanelSection} section
 * @param {Set<string>} [favoriteIds]
 * @param {Set<string>} [archivedIds]
 */
export function itemMatchesFilter(item, filterKey, section, favoriteIds, archivedIds) {
  const isArchived = archivedIds?.has(item.id) || item.status === 'archived';
  if (filterKey === 'archived') return isArchived;
  if (filterKey !== 'all' && isArchived) return false;
  if (filterKey === 'all' && isArchived) return false;
  if (filterKey === 'favorites') {
    return favoriteIds?.has(item.id) ?? false;
  }
  const status = item.status || 'active';
  if (section === 'flows' || section === 'automations') {
    if (filterKey === 'active') return status === 'active';
    if (filterKey === 'draft') return status === 'draft';
  }
  if (section === 'automations' && filterKey === 'all') {
    return status === 'active';
  }
  if (section === 'broadcasts') {
    if (filterKey === 'scheduled') return status === 'scheduled';
    if (filterKey === 'sent') return status === 'sent';
  }
  if (section === 'audience') {
    if (filterKey === 'subscribed') return status === 'subscribed';
    if (filterKey === 'blocked') return status === 'blocked';
  }
  if (section === 'settings') {
    if (filterKey === 'system') return item.kind === 'system';
    if (filterKey === 'bot') return item.kind === 'bot';
  }
  return true;
}
