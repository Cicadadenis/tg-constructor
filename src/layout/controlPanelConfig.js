/**
 * SaaS control panel — section list filters, bulk actions, copy.
 */

/** @typedef {'automation' | 'broadcasts' | 'audience' | 'settings'} ControlPanelSection */

/** @type {Record<ControlPanelSection, { filterKeys: string[], listTitleKey: string }>} */
export const SECTION_PANEL_CONFIG = Object.freeze({
  automation: {
    filterKeys: ['all', 'active', 'draft'],
    listTitleKey: 'flows',
  },
  broadcasts: {
    filterKeys: ['all', 'scheduled', 'sent'],
    listTitleKey: 'broadcasts',
  },
  audience: {
    filterKeys: ['all', 'subscribed', 'blocked'],
    listTitleKey: 'audience',
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
    en: { flows: 'Flows', broadcasts: 'Broadcasts', audience: 'Audience', settings: 'Resources' },
    ru: { flows: 'Сценарии', broadcasts: 'Рассылки', audience: 'Аудитория', settings: 'Ресурсы' },
    uk: { flows: 'Сценарії', broadcasts: 'Розсилки', audience: 'Аудиторія', settings: 'Ресурси' },
  };
  const t = titles[lang === 'en' ? 'en' : lang === 'uk' ? 'uk' : 'ru'];
  const key = SECTION_PANEL_CONFIG[section]?.listTitleKey || 'flows';
  return t[key] || key;
}

/**
 * @param {object} item
 * @param {string} filterKey
 * @param {ControlPanelSection} section
 */
export function itemMatchesFilter(item, filterKey, section) {
  if (filterKey === 'all') return true;
  const status = item.status || 'active';
  if (section === 'automation') {
    if (filterKey === 'active') return status === 'active';
    if (filterKey === 'draft') return status === 'draft';
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
