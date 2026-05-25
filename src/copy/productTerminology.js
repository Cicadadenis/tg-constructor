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
    automationCap: 'Автоматизация',
    automations: 'автоматизации',
    subscriberData: 'данные подписчика',
    customerField: 'поле подписчика',
    customerFields: 'поля подписчика',
    activityLog: 'Журнал активности',
    healthCheck: 'Проверка сценария',
    codeGeneration: 'генерация кода',
    codePreview: 'Превью кода',
    thoroughCheck: 'Детальная проверка',
    readyModule: 'Готовый модуль',
    palette: 'Элементы',
    canvas: 'Холст',
    automationPath: 'Путь автоматизации',
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
    automationCap: 'Automation',
    automations: 'automations',
    subscriberData: 'subscriber data',
    customerField: 'customer field',
    customerFields: 'customer fields',
    activityLog: 'Activity log',
    healthCheck: 'Flow health check',
    codeGeneration: 'code generation',
    codePreview: 'Code preview',
    thoroughCheck: 'Thorough check',
    readyModule: 'Ready-made module',
    palette: 'Elements',
    canvas: 'Canvas',
    automationPath: 'Automation path',
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
    automationCap: 'Автоматизація',
    automations: 'автоматизації',
    subscriberData: 'дані підписника',
    customerField: 'поле підписника',
    customerFields: 'поля підписника',
    activityLog: 'Журнал активності',
    healthCheck: 'Перевірка сценарію',
    codeGeneration: 'генерація коду',
    codePreview: 'Превʼю коду',
    thoroughCheck: 'Детальна перевірка',
    readyModule: 'Готовий модуль',
    palette: 'Елементи',
    canvas: 'Полотно',
    automationPath: 'Шлях автоматизації',
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
 * Panel chrome & simulator copy (product abstraction layer).
 * @param {ProductLang | string} [lang]
 */
export function getProductUiLabels(lang = 'ru') {
  const t = productTerms(lang);
  const isEn = lang === 'en';
  const isUk = lang === 'uk';

  if (isEn) {
    return {
      flowHealthTitle: t.healthCheck,
      activityLogTitle: t.activityLog,
      automationPath: t.automationPath,
      customerFields: capitalize(t.customerFields),
      customerFieldsCap: capitalize(t.customerFields),
      subscriberData: capitalize(t.subscriberData),
      noCustomerFields: `No ${t.customerFields} yet`,
      currentStep: 'Current step',
      session: 'Session',
      branch: 'Branch',
      replayHint: 'Rewind restores the chat and customer fields.',
      testMode: 'Test mode (typing & delays)',
      liveUpdates: 'Live updates',
      pathTab: t.automationPath,
      dataTab: t.subscriberData,
      subscriberTab: 'Subscriber',
      replayTab: 'Replay',
      showAllSteps: `Show all ${t.steps}`,
      conversationTrace: t.activityLog,
      eventsCount: (n) => `${n} events`,
      activeSteps: (ids) => (ids?.length ? ids.join(', ') : '—'),
      nodeHeatmap: `${t.stepCap} engagement`,
      slowestSteps: `Slowest ${t.steps}`,
      stepVolume: `${t.stepCap} volume`,
      blocksPalette: t.palette,
      dragStepHint: `Drag an element from «${t.palette}» onto the ${t.canvas.toLowerCase()}.`,
      effects: 'actions',
      technicalDetails: 'Technical details (dev)',
    };
  }

  if (isUk) {
    return {
      flowHealthTitle: t.healthCheck,
      activityLogTitle: t.activityLog,
      automationPath: t.automationPath,
      customerFields: capitalize(t.customerFields),
      customerFieldsCap: capitalize(t.customerFields),
      subscriberData: capitalize(t.subscriberData),
      noCustomerFields: `${capitalize(t.customerFields)} ще немає`,
      currentStep: 'Поточний крок',
      session: 'Сесія',
      branch: 'Гілка',
      replayHint: 'Перемотка відновлює чат і поля підписника.',
      testMode: 'Тестовий режим (друкує… і паузи)',
      liveUpdates: 'Оновлення в реальному часі',
      pathTab: t.automationPath,
      dataTab: t.subscriberData,
      subscriberTab: 'Підписник',
      replayTab: 'Повтор',
      showAllSteps: `Показати всі ${t.steps}`,
      conversationTrace: t.activityLog,
      eventsCount: (n) => `${n} подій`,
      activeSteps: (ids) => (ids?.length ? ids.join(', ') : '—'),
      nodeHeatmap: `Активність ${t.steps}`,
      slowestSteps: `Найповільніші ${t.steps}`,
      stepVolume: `Охоплення ${t.steps}`,
      blocksPalette: t.palette,
      dragStepHint: `Перетягніть елемент з «${t.palette}» на полотно.`,
      effects: 'дії',
      technicalDetails: 'Технічні деталі (dev)',
    };
  }

  return {
    flowHealthTitle: t.healthCheck,
    activityLogTitle: t.activityLog,
    automationPath: t.automationPath,
    customerFields: capitalize(t.customerFields),
    customerFieldsCap: capitalize(t.customerFields),
    subscriberData: capitalize(t.subscriberData),
    noCustomerFields: `${capitalize(t.customerFields)} пока нет`,
    currentStep: 'Текущий шаг',
    session: 'Сессия',
    branch: 'Ветка',
    replayHint: 'Перемотка восстанавливает чат и поля подписчика.',
    testMode: 'Тестовый режим (печатает… и паузы)',
    liveUpdates: 'Обновления в реальном времени',
    pathTab: t.automationPath,
    dataTab: t.subscriberData,
    subscriberTab: 'Подписчик',
    replayTab: 'Повтор',
    showAllSteps: `Показать все ${t.steps}`,
    conversationTrace: t.activityLog,
    eventsCount: (n) => `${n} событий`,
    activeSteps: (ids) => (ids?.length ? ids.join(', ') : '—'),
    nodeHeatmap: `Активность ${t.steps}`,
    slowestSteps: `Самые медленные ${t.steps}`,
    stepVolume: `Охват ${t.steps}`,
    blocksPalette: t.palette,
    dragStepHint: `Перетащите элемент из «${t.palette}» на холст.`,
    effects: 'действия',
    technicalDetails: 'Технические детали (dev)',
  };
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
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
      [/\bgraph document\b/gi, t.flowCap],
      [/\bgraph\b/gi, (m) => (m[0] === 'G' ? t.flowCap : t.flow)],
      [/\bnodes?\b/gi, (m) => (m[0] === 'N' ? t.stepCap : t.step)],
      [/\bedges?\b/gi, (m) => (m[0] === 'E' ? capitalize(t.connection) : t.connections)],
      [/\bexecution path\b/gi, t.automationPath],
      [/\bexecution\b/gi, t.automation],
      [/\bruntime\b/gi, 'bot'],
      [/\bcompile\b/gi, t.codeGeneration],
      [/\bcompilation\b/gi, t.codeGeneration],
      [/\bdebug trace\b/gi, t.activityLog],
      [/\bdebug\b/gi, t.activityLog],
      [/\bvalidation\b/gi, 'check'],
      [/\bGraphDocument\b/g, t.flowCap],
      [/\bnode ids?\b/gi, t.steps],
      [/\bvariables?\b/gi, (m) => (m[0] === 'V' ? capitalize(t.customerFields) : t.customerField)],
      [/\bcustomer field\b/gi, t.customerField],
      [/\bsubscriber state\b/gi, t.subscriberData],
      [/\bsubscriber state\b/gi, t.subscriberData],
      [/\bsession state\b/gi, t.subscriberData],
      [/\bundo\b/gi, 'history'],
      [/\bblocks?\b/gi, (m) => (m[0] === 'B' ? t.palette : t.step)],
      [/\bPython preview\b/gi, t.codePreview],
      [/\bpython preview\b/gi, t.codePreview],
      [/\bDSL\b/g, 'Code'],
      [/\btelemetry\b/gi, t.activityLog],
      [/\bdiagnostics\b/gi, t.healthCheck],
      [/\btranspile\b/gi, t.codeGeneration],
      [/\bcompiler\b/gi, t.codeGeneration],
      [/\bFSM\b/g, 'form'],
      [/\bmiddleware\b/gi, 'extensions'],
      [/\beffects\b/gi, 'actions'],
    ]
    : [
      [/graph state/gi, t.subscriberData],
      [/graph-модул/gi, t.readyModule],
      [/graph document/gi, t.flowCap],
      [/graph/gi, t.flow],
      [/GraphDocument/gi, t.flowCap],
      [/node ids?/gi, t.steps],
      [/execution path/gi, t.automationPath],
      [/execution/gi, t.automation],
      [/рантайм/gi, 'бот'],
      [/компиляц/gi, t.codeGeneration],
      [/отладк/gi, 'журнал'],
      [/debug/gi, 'журнал'],
      [/переменн(ая|ые|ых|ой|ую)?/gi, (_, suf) => {
        if (suf === 'ая' || suf === 'ой' || suf === 'ую') return t.customerField;
        return t.customerFields;
      }],
      [/состояни(е|я)\s+подписчика/gi, t.subscriberData],
      [/состояни(е|я)\s+сессии/gi, t.subscriberData],
      [/состояни(е|я)\s+графа/gi, `данные ${t.flow}`],
      [/узл(а|ов|е|у)?/gi, t.step],
      [/рёбр(а|о|е|ам)?/gi, t.connection],
      [/нод(а|ы|е|у)?/gi, t.step],
      [/блок(а|ов|и|е|у|ом)?/gi, (match, suf) => {
        if (suf === 'и' && /палитр/i.test(match)) return t.palette.toLowerCase();
        if (suf === 'а' || suf === 'е' || suf === 'у' || suf === 'ом') return t.step;
        if (suf === 'ов' || suf === 'и') return t.steps;
        return t.step;
      }],
      [/«Блоки»/g, `«${t.palette}»`],
      [/«Blocks»/g, `«${t.palette}»`],
      [/схем(а|е|у|ы)/gi, (_, suf) => (suf === 'ы' ? t.flows : t.flow)],
      [/диагностик(а|и|у)/gi, 'проверка'],
      [/telemetry/gi, t.activityLog],
      [/Python preview/gi, t.codePreview],
      [/python preview/gi, t.codePreview],
      [/DSL/g, 'Код'],
      [/transpile/gi, t.codeGeneration],
      [/compiler/gi, t.codeGeneration],
      [/FSM/gi, 'форма'],
      [/Middleware/gi, 'Расширения'],
      [/middleware/gi, 'расширения'],
      [/undo/gi, 'изменений'],
      [/effects/gi, 'действия'],
    ];

  for (const [re, rep] of rules) {
    s = typeof rep === 'function' ? s.replace(re, rep) : s.replace(re, rep);
  }
  return s;
}

/**
 * Soften user-visible fields on normalized error objects.
 * @param {object} err
 * @param {ProductLang | string} [lang]
 */
export function softenProductError(err, lang = 'ru') {
  if (!err || typeof err !== 'object') return err;
  const next = { ...err };
  for (const key of ['title', 'cause', 'fix', 'hint', 'manualStrategy', 'aiNote']) {
    if (typeof next[key] === 'string') next[key] = softenEngineeringCopy(next[key], lang);
  }
  return next;
}

/**
 * Deep-map string values in plain objects (i18n bundles).
 * @param {object} obj
 * @param {ProductLang | string} [lang]
 */
export function mapProductStrings(obj, lang = 'ru') {
  if (!obj || typeof obj !== 'object') return obj;
  if (typeof obj === 'function') return obj;
  if (Array.isArray(obj)) return obj.map((v) => mapProductStrings(v, lang));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = softenEngineeringCopy(v, lang);
    else if (v && typeof v === 'object') out[k] = mapProductStrings(v, lang);
    else out[k] = v;
  }
  return out;
}
