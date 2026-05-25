/**
 * Flow templates — visual sequence presets for structured generation preview.
 */

export const FLOW_TEMPLATES = Object.freeze([
  {
    id: 'salon_funnel',
    name: 'Салон — автоворонка',
    icon: '💇',
    nodes: ['start', 'message', 'buttons', 'ask', 'condition', 'message', 'delay'],
    description: 'Запись, подтверждение, напоминание',
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    icon: '🚀',
    nodes: ['start', 'message', 'delay', 'ask', 'message', 'goal'],
    description: 'Welcome flow для новых пользователей',
  },
  {
    id: 'menu_bot',
    name: 'Меню-бот',
    icon: '📋',
    nodes: ['start', 'message', 'buttons', 'callback', 'message'],
    description: 'Приветствие и навигация по кнопкам',
  },
  {
    id: 'form_collection',
    name: 'Сбор заявки',
    icon: '📝',
    nodes: ['start', 'message', 'ask', 'ask', 'message'],
    description: 'Имя, контакт, подтверждение',
  },
]);

export function getFlowTemplate(id) {
  return FLOW_TEMPLATES.find((t) => t.id === id) || null;
}
