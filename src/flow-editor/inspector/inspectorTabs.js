/** @typedef {'content' | 'logic' | 'audience' | 'analytics' | 'settings'} InspectorProductTab */

export const INSPECTOR_PRODUCT_TABS = Object.freeze([
  'content',
  'logic',
  'audience',
  'analytics',
  'settings',
]);

/**
 * Migrate legacy inspector tab ids (props / code / simulator).
 * @param {string} tab
 * @returns {InspectorProductTab}
 */
export function normalizeInspectorTab(tab) {
  if (INSPECTOR_PRODUCT_TABS.includes(tab)) return /** @type {InspectorProductTab} */ (tab);
  if (tab === 'props') return 'content';
  if (tab === 'code') return 'settings';
  if (tab === 'simulator') return 'content';
  return 'content';
}

/**
 * @param {'ru' | 'en' | 'uk'} lang
 */
export function inspectorTabLabels(lang = 'ru') {
  if (lang === 'en') {
    return {
      content: 'Content',
      logic: 'Logic',
      audience: 'Audience',
      analytics: 'Analytics',
      settings: 'Settings',
    };
  }
  if (lang === 'uk') {
    return {
      content: 'Контент',
      logic: 'Логіка',
      audience: 'Аудиторія',
      analytics: 'Аналітика',
      settings: 'Налаштування',
    };
  }
  return {
    content: 'Контент',
    logic: 'Логика',
    audience: 'Аудитория',
    analytics: 'Аналитика',
    settings: 'Настройки',
  };
}

/** Map legacy entity sections → product tabs */
export const ENTITY_SECTION_TO_TAB = Object.freeze({
  basic: 'content',
  ui: 'content',
  io: 'logic',
  execution: 'logic',
  advanced: 'settings',
});
