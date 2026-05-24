/**
 * Starter templates for empty canvas onboarding — one-click load via example graph keys.
 */

/** @typedef {'welcomeFlow' | 'shopBot' | 'aiAssistant' | 'supportBot'} FlowStarterTemplateId */

/** @type {readonly { id: FlowStarterTemplateId, exampleKey: string, icon: string }[]} */
export const FLOW_STARTER_TEMPLATE_DEFS = Object.freeze([
  { id: 'welcomeFlow', exampleKey: 'welcome', icon: '👋' },
  { id: 'shopBot', exampleKey: 'shop', icon: '🛍️' },
  { id: 'aiAssistant', exampleKey: 'aiAssistant', icon: '🤖' },
  { id: 'supportBot', exampleKey: 'supportBot', icon: '🎧' },
]);

const COPY = {
  en: {
    title: 'Create your first automation',
    subtitle: 'Pick a template or drag a block from the Blocks palette on the left.',
    useTemplate: 'Use template',
    welcomeFlow: { name: 'Welcome Flow', desc: 'Greet users and guide them with buttons.' },
    shopBot: { name: 'Shop Bot', desc: 'Catalog, cart, and product callbacks.' },
    aiAssistant: { name: 'AI Assistant', desc: 'Intent routing with classify + replies.' },
    supportBot: { name: 'Support Bot', desc: 'FAQ menu and ticket-style fallback.' },
    createWithAi: 'Create with AI',
    tour: 'Take a quick tour',
  },
  uk: {
    title: 'Створіть першу автоматизацію',
    subtitle: 'Оберіть шаблон або перетягніть блок з палітри «Блоки» зліва на полотно.',
    useTemplate: 'Використати шаблон',
    welcomeFlow: { name: 'Welcome Flow', desc: 'Вітання та кнопки для нових користувачів.' },
    shopBot: { name: 'Shop Bot', desc: 'Каталог, кошик і товари.' },
    aiAssistant: { name: 'AI Assistant', desc: 'Маршрутизація намірів через classify.' },
    supportBot: { name: 'Support Bot', desc: 'Меню підтримки та тікети.' },
    createWithAi: 'Створити через AI',
    tour: 'Швидкий тур',
  },
  ru: {
    title: 'Создайте первую автоматизацию',
    subtitle: 'Выберите шаблон или перетащите блок из палитры «Блоки» слева на холст.',
    useTemplate: 'Использовать шаблон',
    welcomeFlow: { name: 'Welcome Flow', desc: 'Приветствие и кнопки для новых пользователей.' },
    shopBot: { name: 'Shop Bot', desc: 'Каталог, корзина и товары.' },
    aiAssistant: { name: 'AI Assistant', desc: 'Маршрутизация намерений через classify.' },
    supportBot: { name: 'Support Bot', desc: 'Меню поддержки и тикеты.' },
    createWithAi: 'Создать через AI',
    tour: 'Быстрый тур',
  },
};

/**
 * @param {string} [lang]
 * @returns {Array<{ id: string, exampleKey: string, icon: string, name: string, description: string }>}
 */
export function getFlowStarterTemplates(lang = 'ru') {
  const t = COPY[lang === 'en' ? 'en' : lang === 'uk' ? 'uk' : 'ru'];
  return FLOW_STARTER_TEMPLATE_DEFS.map((def) => {
    const row = t[def.id] || t.welcomeFlow;
    return {
      ...def,
      name: row.name,
      description: row.desc,
    };
  });
}

/**
 * @param {string} templateId
 * @returns {string | null} example graph key for loadExampleGraph
 */
export function exampleKeyForTemplate(templateId) {
  const def = FLOW_STARTER_TEMPLATE_DEFS.find((d) => d.id === templateId);
  return def?.exampleKey ?? null;
}

/**
 * @param {string} [lang]
 */
export function getEmptyCanvasCopy(lang = 'ru') {
  const t = COPY[lang === 'en' ? 'en' : lang === 'uk' ? 'uk' : 'ru'];
  return {
    title: t.title,
    subtitle: t.subtitle,
    useTemplate: t.useTemplate,
    createWithAi: t.createWithAi,
    tour: t.tour,
  };
}
