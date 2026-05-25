/**
 * Editor sidebar sections — ManyChat / Linear style navigation.
 * @typedef {'flows' | 'audience' | 'broadcasts' | 'automations' | 'templates' | 'analytics' | 'settings'} AppSection
 */

/** @type {readonly AppSection[]} */
export const CANVAS_SECTIONS = Object.freeze([
  'flows',
  'automations',
  'templates',
]);

/** @param {string} section */
export function isCanvasSection(section) {
  return CANVAS_SECTIONS.includes(section);
}

/** Legacy alias */
export function isAutomationSection(section) {
  return isCanvasSection(section);
}

/** @type {readonly { id: AppSection, labelKey: string, badgeKey?: string }[]} */
export const NAV_SECTIONS = Object.freeze([
  { id: 'flows', labelKey: 'flows' },
  { id: 'audience', labelKey: 'audience' },
  { id: 'broadcasts', labelKey: 'broadcasts' },
  { id: 'automations', labelKey: 'automations' },
  { id: 'templates', labelKey: 'templates' },
  { id: 'analytics', labelKey: 'analytics' },
  { id: 'settings', labelKey: 'settings' },
]);

/** @deprecated use NAV_SECTIONS */
export const APP_SECTIONS = NAV_SECTIONS;

/** @type {Record<string, { en: string; ru: string; uk: string }>} */
export const SECTION_LABELS = {
  flows: { en: 'Flows', ru: 'Сценарии', uk: 'Сценарії' },
  audience: { en: 'Audience', ru: 'Аудитория', uk: 'Аудиторія' },
  broadcasts: { en: 'Broadcasts', ru: 'Рассылки', uk: 'Розсилки' },
  automations: { en: 'Automations', ru: 'Автоматизации', uk: 'Автоматизації' },
  templates: { en: 'Templates', ru: 'Шаблоны', uk: 'Шаблони' },
  analytics: { en: 'Analytics', ru: 'Аналитика', uk: 'Аналітика' },
  settings: { en: 'Settings', ru: 'Настройки', uk: 'Налаштування' },
  /** @deprecated */
  automation: { en: 'Flows', ru: 'Сценарии', uk: 'Сценарії' },
};

/** @param {string} lang @param {string} sectionId */
export function sectionLabel(lang, sectionId) {
  const id = sectionId === 'automation' ? 'flows' : sectionId;
  const row = SECTION_LABELS[id];
  if (!row) return sectionId;
  if (lang === 'en') return row.en;
  if (lang === 'uk') return row.uk;
  return row.ru;
}

/** Normalize legacy section ids from storage / URLs */
export function normalizeAppSection(section) {
  if (section === 'automation') return 'flows';
  return section;
}
