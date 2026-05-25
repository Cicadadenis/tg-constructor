/**
 * AI Flow Studio + Copilot copy.
 */

export function getAiLabels(lang = 'ru') {
  if (lang === 'en') {
    return {
      studioTitle: 'AI Flow',
      studioSubtitle: 'Describe your automation — get nodes, connections, and messages',
      placeholder: 'e.g. Build salon booking funnel / Create onboarding flow',
      send: 'Create flow',
      planning: 'Planning structure…',
      generating: 'Generating visual flow…',
      planReady: 'Here is the planned structure:',
      applied: 'Flow added to canvas',
      templates: 'Quick starts',
      chips: [
        'Create onboarding flow',
        'Salon booking funnel',
        'Support bot with tickets',
        'Lead magnet checklist',
      ],
      copilot: 'AI Copilot',
      suggest: 'Suggested steps',
      autocomplete: 'Complete',
      optimize: 'Optimization',
      repair: 'Auto-repair',
      copy: 'Copywriting',
      branches: 'Branches',
      openStudio: 'Generate with AI',
    };
  }
  if (lang === 'uk') {
    return {
      studioTitle: 'AI Flow',
      studioSubtitle: 'Опишіть автоматизацію — отримаєте кроки, звʼязки та повідомлення',
      placeholder: 'Напр.: Зроби onboarding flow / автоворонку для салону',
      send: 'Створити flow',
      planning: 'Планую структуру…',
      generating: 'Генерую візуальний flow…',
      planReady: 'Запланована структура:',
      applied: 'Flow додано на полотно',
      templates: 'Швидкий старт',
      chips: [
        'Зроби onboarding flow',
        'Автоворонка для салону',
        'Бот підтримки',
        'Лід-магніт',
      ],
      copilot: 'AI Copilot',
      suggest: 'Запропоновані кроки',
      autocomplete: 'Доповнити',
      optimize: 'Оптимізація',
      repair: 'Авто-ремонт',
      copy: 'Тексти',
      branches: 'Гілки',
      openStudio: 'Згенерувати через AI',
    };
  }
  return {
    studioTitle: 'AI Flow',
    studioSubtitle: 'Опишите сценарий — получите узлы, связи, условия и сообщения',
    placeholder: 'Например: Сделай onboarding flow / автоворонку для салона',
    send: 'Создать flow',
    planning: 'Планирую структуру…',
    generating: 'Генерирую визуальный flow…',
    planReady: 'Запланированная структура:',
    applied: 'Flow добавлен на холст',
    templates: 'Быстрый старт',
    chips: [
      'Сделай onboarding flow',
      'Сделай автоворонку для салона',
      'Бот поддержки с заявками',
      'Лид-магнит с чеклистом',
    ],
    copilot: 'AI Copilot',
      suggest: 'Предложенные шаги',
      autocomplete: 'Дополнить',
    optimize: 'Оптимизация',
    repair: 'Авто-ремонт',
    copy: 'Тексты',
    branches: 'Ветки',
    openStudio: 'Сгенерировать через AI',
  };
}
