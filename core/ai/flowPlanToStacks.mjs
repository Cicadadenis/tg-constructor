/**
 * Deterministic Prompt → Flow stacks (nodes, connections via stack order, props).
 * Used for onboarding / salon / support presets and offline assist.
 */

import { getBlockDefaultProps } from '../blockRegistry.js';
import { buildStructuredFlowPlan } from './flowIntentExtensions.mjs';
import { FLOW_NICHE_IDS } from './flowIntentExtensions.mjs';

const STEP_COPY = Object.freeze({
  [FLOW_NICHE_IDS.SALON_FUNNEL]: [
    { type: 'start', props: {} },
    { type: 'message', props: { text: '✨ Добро пожаловать в наш салон! Выберите услугу или запишитесь к мастеру.' } },
    { type: 'buttons', props: { rows: 'Записаться, Услуги, Контакты' } },
    { type: 'ask', props: { question: 'Как вас зовут и на какой номер перезвонить?', varname: 'client_name' } },
    { type: 'condition', props: { cond: 'client_name != ""' } },
    { type: 'message', props: { text: 'Отлично! Ваша запись принята. Ждём вас в салоне 💇' } },
    { type: 'delay', props: { seconds: '86400' } },
    { type: 'message', props: { text: 'Напоминаем о визите завтра. Нужно перенести? Напишите «перенести».' } },
  ],
  [FLOW_NICHE_IDS.ONBOARDING]: [
    { type: 'start', props: {} },
    { type: 'message', props: { text: '👋 Добро пожаловать! За пару минут покажем, как начать.' } },
    { type: 'message', props: { text: 'Вот что вы получите: быстрый старт, подсказки и первый результат без сложной настройки.' } },
    { type: 'delay', props: { seconds: '2' } },
    { type: 'ask', props: { question: 'Как вас зовут?', varname: 'user_name' } },
    { type: 'message', props: { text: 'Отлично, {user_name}! Теперь выполните первое действие в меню ниже.' } },
    { type: 'buttons', props: { rows: 'Начать, Помощь' } },
    { type: 'message', props: { text: '🎉 Onboarding завершён — вы готовы к работе!' } },
  ],
  [FLOW_NICHE_IDS.SUPPORT]: [
    { type: 'start', props: {} },
    { type: 'message', props: { text: 'Здравствуйте! Чем можем помочь?' } },
    { type: 'buttons', props: { rows: 'Новая заявка, Статус заявки, FAQ' } },
    { type: 'ask', props: { question: 'Опишите проблему одним сообщением:', varname: 'ticket_text' } },
    { type: 'message', props: { text: 'Заявка принята. Мы ответим в ближайшее время.' } },
  ],
  [FLOW_NICHE_IDS.ECOMMERCE]: [
    { type: 'start', props: {} },
    { type: 'message', props: { text: '🛒 Добро пожаловать в магазин!' } },
    { type: 'buttons', props: { rows: 'Каталог, Корзина, Поддержка' } },
    { type: 'ask', props: { question: 'Что хотите заказать? Укажите товар и количество.', varname: 'order_items' } },
    { type: 'message', props: { text: 'Заказ принят! Менеджер свяжется с вами для подтверждения.' } },
  ],
  [FLOW_NICHE_IDS.LEAD_MAGNET]: [
    { type: 'start', props: {} },
    { type: 'message', props: { text: '🎁 Получите бесплатный чеклист — оставьте контакт.' } },
    { type: 'ask', props: { question: 'Ваш email или @username в Telegram:', varname: 'lead_contact' } },
    { type: 'message', props: { text: 'Спасибо! Материал уже у вас — проверьте следующее сообщение.' } },
    { type: 'delay', props: { seconds: '1' } },
    { type: 'message', props: { text: '📎 Вот ваша ссылка на материал. Есть вопросы — напишите нам.' } },
  ],
});

/**
 * @param {string} prompt
 * @param {object} [plan] — from buildStructuredFlowPlan
 * @returns {{ stacks: object[], meta: object }}
 */
export function buildStacksFromPrompt(prompt, plan = null) {
  const resolved = plan || buildStructuredFlowPlan(prompt);
  const niche = resolved.niche;
  const preset = STEP_COPY[niche];
  const steps = preset || sequenceToBlocks(resolved.sequence || []);

  const ts = Date.now();
  const blocks = steps.map((step, i) => ({
    id: `ai_${niche}_${ts}_${i}`,
    type: step.type,
    props: { ...getBlockDefaultProps(step.type), ...(step.props || {}) },
  }));

  return {
    stacks: [{
      id: `stack_ai_${niche}_${ts}`,
      x: 120,
      y: 120,
      blocks,
      meta: { source: 'flowPlanToStacks', niche },
    }],
    meta: {
      deterministicTemplate: true,
      semanticTemplate: resolved.suggestedTemplate,
      niche,
      nodeCount: blocks.length,
      edgeCount: Math.max(0, blocks.length - 1),
    },
  };
}

function sequenceToBlocks(sequence) {
  return sequence.map((step) => ({
    type: step.type || 'message',
    props: defaultPropsForType(step.type, step.label),
  }));
}

function defaultPropsForType(type, label) {
  const base = getBlockDefaultProps(type) || {};
  if (type === 'message') {
    return { ...base, text: label ? String(label) : 'Сообщение' };
  }
  if (type === 'ask') {
    return { ...base, question: label || base.question || 'Ваш ответ?', varname: base.varname || 'answer' };
  }
  if (type === 'buttons') {
    return { ...base, rows: base.rows || 'Далее, Назад' };
  }
  if (type === 'delay') {
    return { ...base, seconds: base.seconds || '2' };
  }
  if (type === 'condition') {
    return { ...base, cond: base.cond || 'answer == "да"' };
  }
  return base;
}
