/**
 * Prompt templates — Notion/ManyChat-style quick starts.
 */

export const AI_PROMPT_MAX_CHARS = 2000;

export const PROMPT_TEMPLATE_CATEGORIES = Object.freeze([
  { id: 'funnel', label: 'Воронки', icon: '🎯' },
  { id: 'onboarding', label: 'Onboarding', icon: '🚀' },
  { id: 'commerce', label: 'Продажи', icon: '🛒' },
  { id: 'support', label: 'Поддержка', icon: '💬' },
]);

/** @type {Array<{ id: string, category: string, title: string, description: string, prompt: string, niche?: string }>} */
export const PROMPT_TEMPLATES = Object.freeze([
  {
    id: 'salon_funnel',
    category: 'funnel',
    title: 'Автоворонка для салона',
    description: 'Запись, услуги, мастер, подтверждение',
    prompt: 'Сделай автоворонку для салона красоты с записью к мастеру',
    niche: 'salon_funnel',
  },
  {
    id: 'onboarding',
    category: 'onboarding',
    title: 'Onboarding flow',
    description: 'Welcome → ценность → профиль → первое действие',
    prompt: 'Сделай onboarding flow для нового пользователя SaaS',
    niche: 'onboarding',
  },
  {
    id: 'lead_magnet',
    category: 'funnel',
    title: 'Лид-магнит',
    description: 'CTA, сбор контакта, выдача материала',
    prompt: 'Лид-магнит: чеклист после подписки в Telegram',
    niche: 'lead_magnet',
  },
  {
    id: 'support_bot',
    category: 'support',
    title: 'Поддержка',
    description: 'Заявка, статус, FAQ',
    prompt: 'Бот поддержки: новая заявка и проверка статуса',
    niche: 'support',
  },
  {
    id: 'shop_catalog',
    category: 'commerce',
    title: 'Магазин в боте',
    description: 'Каталог, заказ, подтверждение',
    prompt: 'Бот магазина: каталог товаров и оформление заказа',
    niche: 'ecommerce',
  },
  {
    id: 'welcome_menu',
    category: 'onboarding',
    title: 'Приветствие + меню',
    description: 'Классический старт с кнопками',
    prompt: 'Бот приветствует пользователя и показывает меню с кнопками Помощь и О нас',
  },
]);

export function getTemplatesByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') return [...PROMPT_TEMPLATES];
  return PROMPT_TEMPLATES.filter((t) => t.category === categoryId);
}
