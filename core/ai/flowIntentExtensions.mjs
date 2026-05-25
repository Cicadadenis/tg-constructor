/**
 * NL flow intent — niche detection, prompt expansion, structured plans.
 */

import { intentPlanner, SEMANTIC_TEMPLATE_IDS } from './intentPlanner.mjs';

export const FLOW_NICHE_IDS = Object.freeze({
  SALON_FUNNEL: 'salon_funnel',
  ONBOARDING: 'onboarding',
  SUPPORT: 'support',
  ECOMMERCE: 'ecommerce',
  LEAD_MAGNET: 'lead_magnet',
  CUSTOM: 'custom',
});

const NICHE_PROMPT_EXPANSIONS = Object.freeze({
  [FLOW_NICHE_IDS.SALON_FUNNEL]: (p) =>
    `Автоворонка для салона красоты: ${p}. Структура: приветствие → каталог услуг → выбор мастера/слота → сбор контакта → подтверждение записи → напоминание. Кнопки и условия где нужно.`,
  [FLOW_NICHE_IDS.ONBOARDING]: (p) =>
    `Onboarding flow: ${p}. Последовательность: welcome → ценность продукта → шаг настройки профиля → первое целевое действие → сообщение об успехе. Delays между шагами приветствуются.`,
  [FLOW_NICHE_IDS.SUPPORT]: (p) =>
    `Бот поддержки: ${p}. Меню: новая заявка, статус, FAQ. Сбор текста обращения и подтверждение.`,
  [FLOW_NICHE_IDS.ECOMMERCE]: (p) =>
    `E-commerce бот: ${p}. Каталог, корзина, оформление заказа, подтверждение.`,
  [FLOW_NICHE_IDS.LEAD_MAGNET]: (p) =>
    `Лид-магнит: ${p}. CTA, сбор email/телефона, выдача материала, follow-up.`,
});

function includesAny(text, words) {
  const t = String(text || '').toLowerCase();
  return words.some((w) => t.includes(w));
}

/**
 * @param {string} prompt
 */
export function detectFlowNiche(prompt) {
  const t = String(prompt || '').toLowerCase();
  if (includesAny(t, ['салон', 'автоворонк', 'красот', 'барбер', 'маникюр', 'spa', 'стрижк'])) {
    return FLOW_NICHE_IDS.SALON_FUNNEL;
  }
  if (includesAny(t, ['onboarding', 'онбординг', 'welcome flow', 'знакомств с продукт'])) {
    return FLOW_NICHE_IDS.ONBOARDING;
  }
  if (includesAny(t, ['поддержк', 'тикет', 'helpdesk', 'заявк'])) {
    return FLOW_NICHE_IDS.SUPPORT;
  }
  if (includesAny(t, ['магазин', 'каталог', 'заказ', 'корзин', 'оплат'])) {
    return FLOW_NICHE_IDS.ECOMMERCE;
  }
  if (includesAny(t, ['лид', 'lead', 'подписк', 'магнит', 'чеклист'])) {
    return FLOW_NICHE_IDS.LEAD_MAGNET;
  }
  return FLOW_NICHE_IDS.CUSTOM;
}

/**
 * @param {string} prompt
 * @param {string} [niche]
 */
export function expandFlowPrompt(prompt, niche = detectFlowNiche(prompt)) {
  const raw = String(prompt || '').trim();
  const fn = NICHE_PROMPT_EXPANSIONS[niche];
  return fn ? fn(raw) : raw;
}

/**
 * Structured generation plan for UI preview before full compile.
 * @param {string} prompt
 */
export function buildStructuredFlowPlan(prompt) {
  const niche = detectFlowNiche(prompt);
  const expandedPrompt = expandFlowPrompt(prompt, niche);
  const intentPlan = intentPlanner(expandedPrompt);
  const sequence = buildVisualSequence(niche, intentPlan);

  return {
    niche,
    expandedPrompt,
    intentPlan: {
      botType: intentPlan.botType,
      complexityScore: intentPlan.complexityScore,
      knownCapabilityTemplate: intentPlan.knownCapabilityTemplate,
      requiredFeatures: intentPlan.requiredFeatures,
    },
    sequence,
    suggestedTemplate: mapNicheToTemplate(niche, intentPlan),
  };
}

function mapNicheToTemplate(niche, intentPlan) {
  if (niche === FLOW_NICHE_IDS.SALON_FUNNEL) return SEMANTIC_TEMPLATE_IDS.FORM_COLLECTION;
  if (niche === FLOW_NICHE_IDS.ONBOARDING) return SEMANTIC_TEMPLATE_IDS.MENU_BOT;
  return intentPlan.knownCapabilityTemplate;
}

/**
 * @param {string} niche
 * @param {object} intentPlan
 */
function buildVisualSequence(niche, intentPlan) {
  const presets = {
    [FLOW_NICHE_IDS.SALON_FUNNEL]: [
      { type: 'start', label: 'Старт', role: 'entry' },
      { type: 'message', label: 'Приветствие салона', role: 'message' },
      { type: 'buttons', label: 'Меню услуг', role: 'ui' },
      { type: 'ask', label: 'Имя и телефон', role: 'input' },
      { type: 'condition', label: 'Слот доступен?', role: 'branch' },
      { type: 'message', label: 'Подтверждение записи', role: 'message' },
      { type: 'delay', label: 'Напоминание', role: 'delay' },
    ],
    [FLOW_NICHE_IDS.ONBOARDING]: [
      { type: 'start', label: 'Старт', role: 'entry' },
      { type: 'message', label: 'Welcome', role: 'message' },
      { type: 'message', label: 'Ценность продукта', role: 'message' },
      { type: 'delay', label: 'Пауза', role: 'delay' },
      { type: 'ask', label: 'Профиль', role: 'input' },
      { type: 'message', label: 'Первое действие', role: 'message' },
      { type: 'goal', label: 'Onboarding завершён', role: 'conversion' },
    ],
  };

  if (presets[niche]) return presets[niche];

  const graph = intentPlan.minimalExecutionGraph;
  if (graph?.nodes?.length) {
    return graph.nodes.slice(0, 8).map((n) => ({
      type: n.type || n.kind || 'message',
      label: n.trigger || n.name || n.id,
      role: n.kind === 'handler' ? 'entry' : 'step',
    }));
  }

  return [
    { type: 'start', label: 'Старт', role: 'entry' },
    { type: 'message', label: 'Сообщение', role: 'message' },
    { type: 'buttons', label: 'Кнопки', role: 'ui' },
  ];
}
