import {
  AIOGRAM3_RUNTIME,
  getAiogram3BlockFlowMeta,
  isAiogram3PaletteBlockType,
} from './aiogram3Runtime.js';
import { sortCatalogByFlowOrder } from './aiogram3PaletteOrder.js';

const VALID_CATEGORIES = new Set([
  'render',
  'logic',
  'control',
  'action',
  'media',
  'telegram',
  'data',
  'settings',
]);

const VALID_UI_SCOPES = new Set(['render', 'none']);
const RENDER_UI_CAPABILITIES = Object.freeze(['buttons', 'inline', 'media']);

function freezeDefinition(definition) {
  return Object.freeze({
    ...definition,
    capabilities: Object.freeze([...(definition.capabilities || [])]),
    constraints: definition.constraints
      ? Object.freeze({
          ...definition.constraints,
          ui: definition.constraints.ui
            ? Object.freeze({ ...definition.constraints.ui })
            : undefined,
          flow: definition.constraints.flow
            ? Object.freeze({
                ...definition.constraints.flow,
                allowedTargetCategories: definition.constraints.flow.allowedTargetCategories
                  ? Object.freeze([...definition.constraints.flow.allowedTargetCategories])
                  : undefined,
                outputLabels: definition.constraints.flow.outputLabels
                  ? Object.freeze([...definition.constraints.flow.outputLabels])
                  : undefined,
              })
            : undefined,
          defaults: definition.constraints.defaults
            ? Object.freeze({ ...definition.constraints.defaults })
            : undefined,
        })
      : undefined,
  });
}

export function createBlockDefinition(definition) {
  const type = String(definition?.type || '').trim();
  const category = String(definition?.category || '').trim();
  const uiScope = definition?.uiScope || 'none';
  const description = String(definition?.description || '').trim();

  if (!type) throw new Error('BlockDefinition.type is required');
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error(`BlockDefinition.category is invalid for ${type}`);
  }
  if (!VALID_UI_SCOPES.has(uiScope)) {
    throw new Error(`BlockDefinition.uiScope is invalid for ${type}`);
  }
  if (!description) throw new Error(`BlockDefinition.description is required for ${type}`);

  const runtime = definition.runtime ?? AIOGRAM3_RUNTIME;
  if (runtime !== AIOGRAM3_RUNTIME) {
    throw new Error(`BlockDefinition.runtime must be aiogram3 for ${type}`);
  }

  return freezeDefinition({
    type,
    category,
    runtime,
    capabilities: [...new Set((definition.capabilities || []).map(String).filter(Boolean))],
    uiScope,
    description,
    constraints: definition.constraints || undefined,
  });
}

function block(type, category, description, options = {}) {
  return createBlockDefinition({
    type,
    category,
    capabilities: options.capabilities || [],
    uiScope: options.uiScope || 'none',
    description,
    constraints: options.constraints,
  });
}

function palette(label, icon, color, group, canBeRoot, canStack, extra = {}) {
  return {
    ui: {
      label,
      icon,
      color,
      group,
      canBeRoot,
      canStack,
      ...extra,
    },
  };
}

function hidden(extra = {}) {
  return { ui: { palette: false }, ...extra };
}

function withFlow(base, flow) {
  return {
    ...base,
    flow,
  };
}

function withDefaults(base, defaults) {
  return {
    ...base,
    defaults,
  };
}

export const renderBlocks = Object.freeze([
  block('message', 'render', 'Send a text reply to the current chat.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: withDefaults(
      withFlow(palette('Ответ', '✉', '#5b7cf6', 'Основные', false, true), { maxOutputs: 1 }),
      { text: 'Привет, {пользователь.имя}!', markup: '' },
    ),
  }),
  block('reply', 'render', 'Alias for a text reply render action.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: hidden(),
  }),
  block('caption', 'render', 'Caption-bearing render action.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: hidden(),
  }),
  block('buttons', 'render', 'Legacy reply keyboard block, normalized to a UI attachment when attached.', {
    constraints: palette('Кнопки', '⊞', '#a78bfa', 'Основные', false, true),
  }),
  block('inline', 'render', 'Legacy inline keyboard block, normalized to a UI attachment when attached.', {
    constraints: hidden(),
  }),
  block('inline_keyboard', 'render', 'Inline keyboard graph node (buttons under message/media).', {
    constraints: palette('Inline-клавиатура', '▦', '#7c3aed', 'Основные', false, false),
  }),
  block('reply_keyboard', 'render', 'Reply keyboard graph node (custom keyboard under message/media).', {
    constraints: palette('Reply-клавиатура', '⊞', '#a78bfa', 'Основные', false, false),
  }),
]);

export const controlBlocks = Object.freeze([
  block('start', 'control', 'Entry point for the /start update.', {
    constraints: withFlow(palette('Старт', '▶', '#3ecf8e', 'Основные', true, true), {
      maxOutputs: 1,
      allowedTargetCategories: ['render', 'media', 'logic', 'control', 'action', 'telegram', 'data', 'settings'],
    }),
  }),
  block('command', 'control', 'Entry point for a Telegram slash command.', {
    constraints: withDefaults(
      withFlow(palette('Команда', '/', '#fbbf24', 'Основные', true, true), {
        maxOutputs: 1,
        allowedTargetCategories: ['render', 'media', 'logic', 'control', 'action', 'telegram', 'data', 'settings'],
      }),
      { cmd: 'start' },
    ),
  }),
  block('callback', 'control', 'Entry point for a Telegram callback or reply button click.', {
    constraints: withDefaults(
      withFlow(palette('При нажатии', '⊙', '#60a5fa', 'Основные', true, true), {
        maxOutputs: 1,
        allowedTargetCategories: ['render', 'media', 'logic', 'control', 'action', 'telegram', 'data', 'settings'],
      }),
      { label: 'Кнопка' },
    ),
  }),
  block('on_text', 'control', 'Entry point for incoming text messages.', {
    constraints: withFlow(palette('При тексте', '💬', '#38bdf8', 'Точки входа', true, true), {
      maxOutputs: 1,
      allowedTargetCategories: ['render', 'media', 'logic', 'control', 'action', 'telegram', 'data', 'settings'],
    }),
  }),
  block('on_photo', 'control', 'Entry point for incoming photos.', {
    constraints: palette('При фото', '📷', '#34d399', 'Основные', true, true),
  }),
  block('photo_received', 'control', 'Alias for the incoming photo entry point.', {
    constraints: hidden(),
  }),
  block('on_voice', 'control', 'Entry point for incoming voice messages.', {
    constraints: palette('При голосовом', '🎤', '#818cf8', 'Основные', true, true),
  }),
  block('voice_received', 'control', 'Alias for the incoming voice entry point.', {
    constraints: hidden(),
  }),
  block('on_document', 'control', 'Entry point for incoming documents.', {
    constraints: palette('При документе', '📎', '#94a3b8', 'Основные', true, true),
  }),
  block('document_received', 'control', 'Alias for the incoming document entry point.', {
    constraints: hidden(),
  }),
  block('on_sticker', 'control', 'Entry point for incoming stickers.', {
    constraints: palette('При стикере', '🎭', '#f472b6', 'Основные', true, true),
  }),
  block('sticker_received', 'control', 'Alias for the incoming sticker entry point.', {
    constraints: hidden(),
  }),
  block('on_location', 'control', 'Entry point for incoming locations.', {
    constraints: palette('При локации', '📍', '#ef4444', 'Основные', true, true),
  }),
  block('location_received', 'control', 'Alias for the incoming location entry point.', {
    constraints: hidden(),
  }),
  block('on_contact', 'control', 'Entry point for incoming contacts.', {
    constraints: palette('При контакте', '👤', '#0ea5e9', 'Основные', true, true),
  }),
  block('contact_received', 'control', 'Alias for the incoming contact entry point.', {
    constraints: hidden(),
  }),
  block('goto', 'control', 'Jump to another handler label.', {
    constraints: withDefaults(
      withFlow(palette('Переход', '→', '#a3a3a3', 'Действия', false, false), { maxOutputs: 0 }),
      { target: 'сценарий' },
    ),
  }),
  block('loop', 'control', 'Repeat nested flow blocks.', {
    constraints: withDefaults(
      withFlow(palette('Цикл', '↻', '#f59e0b', 'Логика', false, true), { maxOutputs: 2, outputLabels: ['body', 'done'] }),
      { mode: 'count', count: '3' },
    ),
  }),
]);

export const logicBlocks = Object.freeze([
  block('condition', 'logic', 'Conditional branch.', {
    constraints: withDefaults(
      withFlow(palette('Если', '◇', '#fb923c', 'Логика', false, true), { maxOutputs: 2, outputLabels: ['true', 'false'] }),
      { cond: 'текст == "да"' },
    ),
  }),
  block('condition_not', 'logic', 'Negated conditional branch (если … не == …).', {
    constraints: withDefaults(
      withFlow(palette('Если не', '◈', '#f472b6', 'Логика', false, true), { maxOutputs: 2, outputLabels: ['true', 'false'] }),
      { cond: 'текст == "да"' },
    ),
  }),
  block('else', 'logic', 'Fallback branch for a condition.', {
    constraints: palette('Иначе', '⎇', '#f97316', 'Логика', false, true),
  }),
  block('ask', 'logic', 'Ask a question and store the user response.', {
    constraints: palette('Спросить', '?', '#f87171', 'Логика', false, true),
  }),
  block('remember', 'logic', 'Store a temporary session variable.', {
    constraints: palette('Запомнить', '♦', '#94a3b8', 'Логика', false, true),
  }),
  block('get', 'logic', 'Read a value from persistent storage.', {
    constraints: palette('Получить', '📥', '#0ea5e9', 'Логика', false, true),
  }),
  block('save', 'logic', 'Write a value to persistent storage.', {
    constraints: palette('Сохранить', '💾', '#059669', 'Логика', false, true),
  }),
]);

export const actionBlocks = Object.freeze([
  block('delay', 'action', 'Pause execution for a number of seconds.', {
    constraints: palette('Пауза', '⏱', '#64748b', 'Действия', false, true),
  }),
  block('pause', 'action', 'Alias for delay.', {
    constraints: hidden(),
  }),
  block('typing', 'action', 'Show a typing indicator.', {
    constraints: palette('Печатает...', '…', '#475569', 'Действия', false, true),
  }),
  block('stop', 'action', 'Stop, break, continue, or return from the current flow.', {
    constraints: palette('Стоп', '■', '#ef4444', 'Действия', false, false),
  }),
  block('log', 'action', 'Write a diagnostic log line.', {
    constraints: palette('Лог', '📋', '#6b7280', 'Действия', false, true),
  }),
]);

export const mediaBlocks = Object.freeze([
  block('media', 'media', 'Generic media render action.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: hidden(),
  }),
  block('photo', 'media', 'Send a photo by URL or file_id.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: withDefaults(
      withFlow(palette('Фото', '🖼', '#34d399', 'Медиа', false, true), { maxOutputs: 1 }),
      { url: '', caption: '' },
    ),
  }),
  block('video', 'media', 'Send a video by URL or file_id.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: withDefaults(
      withFlow(palette('Видео', '▷', '#2dd4bf', 'Медиа', false, true), { maxOutputs: 1 }),
      { url: '', caption: '' },
    ),
  }),
  block('audio', 'media', 'Send an audio file by URL or file_id.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: palette('Аудио', '♪', '#818cf8', 'Медиа', false, true),
  }),
  block('document', 'media', 'Send a document by URL or file_id.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: palette('Документ', '📄', '#94a3b8', 'Медиа', false, true),
  }),
  block('send_file', 'media', 'Send a previously stored Telegram file_id.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: palette('Отправить файл', '📎', '#64748b', 'Медиа', false, true),
  }),
  block('photo_var', 'media', 'Send a photo from variable (URL, file_id or BytesIO).', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: withDefaults(
      withFlow(palette('Фото из переменной', '🖼', '#34d399', 'Медиа', false, true), { maxOutputs: 1 }),
      { varname: 'фото', caption: '' },
    ),
  }),
  block('document_var', 'media', 'Send a document from variable (URL, file_id or BytesIO).', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: withDefaults(
      withFlow(palette('Документ из переменной', '📄', '#94a3b8', 'Медиа', false, true), { maxOutputs: 1 }),
      { varname: 'документ', filename: '', caption: '' },
    ),
  }),
  block('sticker', 'media', 'Send a sticker by file_id.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: palette('Стикер', '◉', '#f472b6', 'Медиа', false, true),
  }),
  block('contact', 'media', 'Send a Telegram contact.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: palette('Контакт', '👤', '#0ea5e9', 'Медиа', false, true),
  }),
  block('location', 'media', 'Send a Telegram location.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: palette('Локация', '📍', '#ef4444', 'Медиа', false, true),
  }),
  block('poll', 'media', 'Send a Telegram poll.', {
    capabilities: RENDER_UI_CAPABILITIES,
    uiScope: 'render',
    constraints: palette('Опрос', '📊', '#8b5cf6', 'Медиа', false, true),
  }),
]);

export const telegramBlocks = Object.freeze([]);

export const dataBlocks = Object.freeze([
  block('set_global', 'data', 'Update a module-level global variable.', {
    constraints: palette('Обновить глобальную', '🌍', '#10b981', 'Данные', false, true),
  }),
]);

export const settingsBlocks = Object.freeze([
  block('version', 'settings', 'Project DSL version declaration.', {
    constraints: palette('Версия', '📌', '#6b7280', 'Настройки', true, false),
  }),
  block('bot', 'settings', 'Telegram bot token declaration.', {
    constraints: palette('Бот', '🤖', '#3ecf8e', 'Настройки', true, false),
  }),
  block('commands', 'settings', 'Telegram bot menu commands declaration.', {
    constraints: palette('Команды меню', '📋', '#fbbf24', 'Настройки', true, false),
  }),
  block('global', 'settings', 'Project-wide global variable declaration.', {
    constraints: palette('Глобальная', '🌍', '#10b981', 'Настройки', true, false),
  }),
]);

export const blockDefinitionGroups = Object.freeze({
  renderBlocks,
  controlBlocks,
  logicBlocks,
  actionBlocks,
  mediaBlocks,
  telegramBlocks,
  dataBlocks,
  settingsBlocks,
});

export const blockDefinitions = Object.freeze([
  ...settingsBlocks,
  ...controlBlocks,
  ...renderBlocks,
  ...logicBlocks,
  ...actionBlocks,
  ...mediaBlocks,
  ...telegramBlocks,
  ...dataBlocks,
]);

export const blockRegistry = Object.freeze(
  Object.fromEntries(blockDefinitions.map((definition) => [definition.type, definition])),
);

const TERMINAL_CHILDREN = Object.freeze([]);
export const UI_ATTACHMENT_LEGACY_BLOCK_TYPES = Object.freeze(['buttons', 'inline']);

/** Quick-add row in block modal — most-used types first (filtered by parent compatibility). */
export const QUICK_ADD_FREQUENT_BLOCK_TYPES = Object.freeze([
  'message', 'photo', 'buttons', 'inline', 'typing', 'delay', 'ask',
]);

const FLOW_CHILDREN = Object.freeze([
  'message', 'typing', 'delay', 'condition', 'condition_not', 'else', 'ask', 'remember',
  'get', 'save', 'loop', 'log', 'photo', 'photo_var', 'video', 'audio', 'document',
  'document_var', 'send_file', 'sticker', 'contact', 'location', 'poll', 'stop', 'goto',
  'set_global',
]);

const FLOW_NO_MEDIA = Object.freeze([
  'message', 'typing', 'delay', 'condition', 'condition_not', 'ask', 'remember', 'get',
  'save', 'loop', 'log', 'stop', 'goto', 'set_global',
]);

const TEXT_ATTACHMENTS = Object.freeze(['buttons', 'inline', 'inline_keyboard', 'reply_keyboard']);

/** Media/output nodes that accept reply + inline keyboards (Telegram reply_markup on send_*). */
export const MEDIA_KEYBOARD_CAPABLE_TYPES = Object.freeze([
  'media',
  'photo',
  'photo_var',
  'video',
  'audio',
  'document',
  'document_var',
  'send_file',
  'sticker',
  'contact',
  'location',
  'poll',
]);

const MEDIA_STACK_BASE = Object.freeze([
  'message', 'typing', 'delay', 'condition', 'condition_not', 'ask', 'stop', 'goto', 'log',
]);
const MEDIA_STACK_CHILDREN = Object.freeze([...MEDIA_STACK_BASE, ...TEXT_ATTACHMENTS]);

function freezeCompatibilityMap(map) {
  return Object.freeze(Object.fromEntries(
    Object.entries(map).map(([type, allowed]) => [type, Object.freeze([...allowed])]),
  ));
}

export const BLOCK_STACK_COMPATIBILITY = freezeCompatibilityMap({
  version: TERMINAL_CHILDREN,
  bot: TERMINAL_CHILDREN,
  commands: TERMINAL_CHILDREN,
  global: TERMINAL_CHILDREN,

  start: FLOW_CHILDREN,
  command: FLOW_CHILDREN,
  callback: FLOW_CHILDREN,
  on_text: FLOW_CHILDREN,
  on_photo: FLOW_CHILDREN,
  photo_received: FLOW_CHILDREN,
  on_voice: FLOW_CHILDREN,
  voice_received: FLOW_CHILDREN,
  on_document: FLOW_CHILDREN,
  document_received: FLOW_CHILDREN,
  on_sticker: FLOW_CHILDREN,
  sticker_received: FLOW_CHILDREN,
  on_location: FLOW_CHILDREN,
  location_received: FLOW_CHILDREN,
  on_contact: FLOW_CHILDREN,
  contact_received: FLOW_CHILDREN,

  message: [...FLOW_CHILDREN, ...TEXT_ATTACHMENTS],
  reply: [...FLOW_CHILDREN, ...TEXT_ATTACHMENTS],
  caption: [...FLOW_CHILDREN, ...TEXT_ATTACHMENTS],
  buttons: FLOW_CHILDREN,
  inline: ['message', 'condition', 'condition_not', 'stop', 'goto'],
  inline_keyboard: [],
  reply_keyboard: [],

  condition: FLOW_CHILDREN,
  condition_not: FLOW_CHILDREN,
  else: FLOW_CHILDREN,
  ask: ['message', 'remember', 'get', 'save', 'condition', 'condition_not', 'log', 'stop', 'goto'],
  remember: FLOW_NO_MEDIA,
  get: FLOW_NO_MEDIA,
  save: FLOW_NO_MEDIA,
  loop: FLOW_CHILDREN,

  delay: ['message', 'typing', 'condition', 'condition_not', 'ask', 'remember', 'get', 'save', 'log', 'stop', 'goto'],
  typing: ['message', 'photo', 'photo_var', 'video', 'audio', 'document', 'document_var', 'send_file', 'sticker', 'condition', 'condition_not', 'ask', 'delay', 'stop', 'goto'],
  stop: TERMINAL_CHILDREN,
  goto: TERMINAL_CHILDREN,
  log: FLOW_NO_MEDIA,

  media: MEDIA_STACK_CHILDREN,
  photo: MEDIA_STACK_CHILDREN,
  photo_var: MEDIA_STACK_CHILDREN,
  video: MEDIA_STACK_CHILDREN,
  audio: MEDIA_STACK_CHILDREN,
  document: MEDIA_STACK_CHILDREN,
  document_var: MEDIA_STACK_CHILDREN,
  send_file: MEDIA_STACK_CHILDREN,
  sticker: MEDIA_STACK_CHILDREN,
  contact: MEDIA_STACK_CHILDREN,
  location: MEDIA_STACK_CHILDREN,
  poll: MEDIA_STACK_CHILDREN,

  set_global: FLOW_NO_MEDIA,
});

export function getCompatibleBlockTypes(parentType) {
  return [...(BLOCK_STACK_COMPATIBILITY[String(parentType || '').trim()] || [])];
}

export function canStackBlockBelow(parentType, childType) {
  return getCompatibleBlockTypes(parentType).includes(String(childType || '').trim());
}

export function getBlockDefinition(type) {
  return blockRegistry[String(type || '').trim()] || null;
}

export function getBlockUiConstraints(type) {
  return getBlockDefinition(type)?.constraints?.ui || null;
}

export function getBlockFlowConstraints(type) {
  return getBlockDefinition(type)?.constraints?.flow || null;
}

export function getBlockDefaultProps(type) {
  return { ...(getBlockDefinition(type)?.constraints?.defaults || {}) };
}

export function getPaletteBlockTypes() {
  const rows = blockDefinitions
    .map((definition) => {
      const ui = definition.constraints?.ui;
      if (!ui || ui.palette === false) return null;
      if (!isAiogram3PaletteBlockType(definition.type)) return null;
      if (definition.runtime !== AIOGRAM3_RUNTIME) return null;
      const flow = getAiogram3BlockFlowMeta(definition.type);
      return {
        type: definition.type,
        runtime: AIOGRAM3_RUNTIME,
        label: ui.label,
        icon: ui.icon,
        color: ui.color,
        group: ui.group,
        groupId: flow?.section,
        categoryOrder: flow?.categoryOrder,
        priority: flow?.priority,
        flowRole: flow?.flowRole,
        flowIndex: flow?.flowIndex,
        canBeRoot: Boolean(ui.canBeRoot),
        canStack: Boolean(ui.canStack),
      };
    })
    .filter(Boolean);
  return sortCatalogByFlowOrder(rows);
}

export function getRootBlockTypes() {
  return blockDefinitions
    .filter((definition) => (
      definition.constraints?.ui?.canBeRoot ||
      definition.constraints?.flow?.canBeRoot
    ))
    .map((definition) => definition.type);
}
