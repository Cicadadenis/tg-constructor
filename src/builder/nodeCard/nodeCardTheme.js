/**
 * Product-grade flow node categories (ManyChat-style cards).
 */

/** @typedef {'messaging' | 'logic' | 'ai' | 'db'} ProductNodeCategory */

/** @type {Record<string, ProductNodeCategory>} */
const REGISTRY_CATEGORY_MAP = {
  render: 'messaging',
  media: 'messaging',
  control: 'messaging',
  telegram: 'messaging',
  logic: 'logic',
  action: 'logic',
  data: 'db',
  settings: 'db',
};

const AI_TYPES = new Set(['classify', 'analytics', 'http']);

const TYPE_OVERRIDES = {
  classify: 'ai',
  analytics: 'ai',
  'db.get': 'db',
  'db.set': 'db',
  'db.query': 'db',
  'db.insert': 'db',
  'db.update': 'db',
  database: 'db',
  bot: 'db',
  version: 'db',
  commands: 'db',
  global: 'db',
};

/** @type {Record<ProductNodeCategory, { label: string, labelEn: string, accent: string, muted: string, border: string }>} */
export const PRODUCT_CATEGORY_THEME = Object.freeze({
  messaging: {
    label: 'Сообщения',
    labelEn: 'Messaging',
    accent: '#2563eb',
    muted: '#eff6ff',
    border: '#bfdbfe',
  },
  logic: {
    label: 'Логика',
    labelEn: 'Logic',
    accent: '#7c3aed',
    muted: '#f5f3ff',
    border: '#ddd6fe',
  },
  ai: {
    label: 'AI',
    labelEn: 'AI',
    accent: '#0891b2',
    muted: '#ecfeff',
    border: '#a5f3fc',
  },
  db: {
    label: 'Данные',
    labelEn: 'Database',
    accent: '#059669',
    muted: '#ecfdf5',
    border: '#a7f3d0',
  },
});

/**
 * @param {string} blockType
 * @param {string} [registryCategory]
 * @returns {ProductNodeCategory}
 */
export function resolveProductCategory(blockType, registryCategory) {
  const t = String(blockType || '').trim();
  if (TYPE_OVERRIDES[t]) return TYPE_OVERRIDES[t];
  if (AI_TYPES.has(t)) return 'ai';
  if (t.startsWith('db.') || t === 'database') return 'db';
  const cat = String(registryCategory || '').trim();
  return REGISTRY_CATEGORY_MAP[cat] || 'logic';
}

/**
 * @param {ProductNodeCategory} key
 * @param {string} [lang]
 */
export function categoryDisplayLabel(key, lang = 'ru') {
  const theme = PRODUCT_CATEGORY_THEME[key] || PRODUCT_CATEGORY_THEME.logic;
  return lang === 'en' ? theme.labelEn : theme.label;
}
