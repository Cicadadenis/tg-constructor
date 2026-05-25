/** @typedef {'automation' | 'broadcasts' | 'audience' | 'settings'} AppSection */

export const APP_SECTIONS = Object.freeze([
  { id: 'automation', icon: '⚡', labelKey: 'navAutomation' },
  { id: 'broadcasts', icon: '📢', labelKey: 'navBroadcasts' },
  { id: 'audience', icon: '👥', labelKey: 'navAudience' },
  { id: 'settings', icon: '⚙', labelKey: 'navSettings' },
]);

/** @type {Record<string, { en: string, ru: string, uk: string }>} */
export const SECTION_LABELS = {
  automation: { en: 'Automation', ru: 'Автоматизация', uk: 'Автоматизація' },
  broadcasts: { en: 'Broadcasts', ru: 'Рассылки', uk: 'Розсилки' },
  audience: { en: 'Audience', ru: 'Аудитория', uk: 'Аудиторія' },
  settings: { en: 'Settings', ru: 'Настройки', uk: 'Налаштування' },
};

/** @param {string} lang @param {string} sectionId */
export function sectionLabel(lang, sectionId) {
  const row = SECTION_LABELS[sectionId];
  if (!row) return sectionId;
  if (lang === 'en') return row.en;
  if (lang === 'uk') return row.uk;
  return row.ru;
}
