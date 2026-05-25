/**
 * Product-facing terminology — hides engineering concepts from the UI.
 * Internal code may still use graph/node/execution; only show these strings to users.
 */

/** @typedef {'ru' | 'en' | 'uk'} ProductLang */

export const PRODUCT_TERMS = Object.freeze({
  ru: {
    flow: 'сценарий',
    flowCap: 'Сценарий',
    flows: 'сценарии',
    step: 'шаг',
    stepCap: 'Шаг',
    steps: 'шаги',
    connection: 'связь',
    connections: 'связи',
    automation: 'автоматизация',
    automations: 'автоматизации',
    subscriberData: 'данные подписчика',
    activityLog: 'Журнал активности',
    healthCheck: 'Проверка сценария',
    codeGeneration: 'генерация кода',
    thoroughCheck: 'Детальная проверка',
    readyModule: 'Готовый модуль',
  },
  en: {
    flow: 'flow',
    flowCap: 'Flow',
    flows: 'flows',
    step: 'step',
    stepCap: 'Step',
    steps: 'steps',
    connection: 'connection',
    connections: 'connections',
    automation: 'automation',
    automations: 'automations',
    subscriberData: 'subscriber data',
    activityLog: 'Activity log',
    healthCheck: 'Flow health check',
    codeGeneration: 'code generation',
    thoroughCheck: 'Thorough check',
    readyModule: 'Ready-made module',
  },
  uk: {
    flow: 'сценарій',
    flowCap: 'Сценарій',
    flows: 'сценарії',
    step: 'крок',
    stepCap: 'Крок',
    steps: 'кроки',
    connection: 'звʼязок',
    connections: 'звʼязки',
    automation: 'автоматизація',
    automations: 'автоматизації',
    subscriberData: 'дані підписника',
    activityLog: 'Журнал активності',
    healthCheck: 'Перевірка сценарію',
    codeGeneration: 'генерація коду',
    thoroughCheck: 'Детальна перевірка',
    readyModule: 'Готовий модуль',
  },
});

/**
 * @param {ProductLang | string} [lang]
 */
export function productTerms(lang = 'ru') {
  const lc = String(lang || 'ru').toLowerCase();
  return PRODUCT_TERMS[lc] || PRODUCT_TERMS.ru;
}

/**
 * Replace common engineering leaks in a user-visible string (best-effort).
 * @param {string} text
 * @param {ProductLang | string} [lang]
 */
export function softenEngineeringCopy(text, lang = 'ru') {
  if (!text || typeof text !== 'string') return text;
  const t = productTerms(lang);
  const isEn = lang === 'en';
  let s = text;
  const rules = isEn
    ? [
      [/\bgraph state\b/gi, `${t.flowCap} data`],
      [/\bgraph\b/gi, t.flowCap],
      [/\bnodes?\b/gi, (m) => (m[0] === 'N' ? t.stepCap : t.step)],
      [/\bedges?\b/gi, (m) => (m[0] === 'E' ? t.connection : t.connections)],
      [/\bexecution\b/gi, t.automation],
      [/\bruntime\b/gi, 'bot'],
      [/\bcompile\b/gi, t.codeGeneration],
      [/\bcompilation\b/gi, t.codeGeneration],
      [/\bdebug trace\b/gi, t.activityLog],
      [/\bdebug\b/gi, t.activityLog],
      [/\bvalidation\b/gi, 'check'],
      [/\bGraphDocument\b/g, t.flowCap],
      [/\bnode ids?\b/gi, t.steps],
      [/\bundo\b/gi, 'history'],
    ]
    : [
      [/graph state/gi, `данные ${t.flow}`],
      [/graph-модул/gi, t.readyModule],
      [/graph/gi, t.flow],
      [/GraphDocument/gi, t.flowCap],
      [/node ids?/gi, t.steps],
      [/узл(а|ов|е)?/gi, t.step],
      [/рёбр(а|о|е)?/gi, t.connection],
      [/execution/gi, t.automation],
      [/рантайм/gi, 'бот'],
      [/компиляц/gi, t.codeGeneration],
      [/отладк/gi, 'журнал'],
      [/debug/gi, 'журнал'],
      [/undo/gi, 'изменений'],
    ];
  for (const [re, rep] of rules) {
    s = s.replace(re, rep);
  }
  return s;
}
