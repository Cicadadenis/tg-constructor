import React from 'react';
import { canAttach, canRenderUi } from '../../core/capabilityEngine.js';
import { RUNTIME_PROPERTY_NAMES } from '../constructor/blockUiRules.js';
import { apiFetch, isMobileBuilderViewport, postJsonWithCsrf } from '../apiClient.js';
import { AddBlockContext, BlockInfoContext, BuilderUiContext } from '../builderContext.js';
import {
  getConstructorStrings,
  localizedPropFields,
  mergeBeginnerGuide,
  blockNoteForLang,
  RU_GROUP_TO_ID,
} from '../builderI18n.js';
import {
  getPaletteEntryDisplay,
  groupPaletteForSidebar,
  isPaletteDebugEnabled,
  isPaletteEntryDraggable,
  paletteSidebarSectionOrder,
} from '../constructor/graph_document/graph_ui_palette.js';
import {
  DEFAULT_PROPS,
  CAN_STACK_BELOW,
  getBlockDef,
  getCompatibleBlockTypes,
  getPaletteBlockTypes,
  QUICK_ADD_FREQUENT_BLOCK_TYPES,
  resolveBuilderCatalog,
} from '../constructor/block_catalog.js';
import { UI_ATTACHMENT_LEGACY_BLOCK_TYPES } from '../../core/blockRegistry.js';
import { appAlert } from '../dialog/appDialog.js';
import { getPreview } from './blockPreview.js';
import { listCallbackButtonRefs, getRefsByCategories, resolveCallbackBindingRef } from '../constructor/graph_document/graph_reference_registry.js';
import { bindingPatchFromReference } from '../constructor/graph_document/graph_reference_bindings.js';
import { getSmartRefFieldConfig } from './graph_reference_field_map.js';
import SmartGraphRefPicker from './SmartGraphRefPicker.jsx';
import { hasCustomInspector, resolveNodeInspector } from './inspectors/NodeInspectorRegistry.js';

/** @deprecated use getPaletteBlockTypes / buildLocalizedBlockCatalog — registry is source of truth */
export const BLOCK_TYPES = getPaletteBlockTypes();

const BLOCK_FOOTER_ACTION_TYPES = Object.freeze({
  buttons: { label: 'Кнопки', icon: '⊞', color: '#a78bfa' },
  inline: { label: 'Inline', icon: '▦', color: '#7c3aed' },
  keyboard: { label: 'Клавиатура', icon: '⌨', color: '#8b5cf6' },
  media: { label: 'Медиа', icon: '▣', color: '#34d399' },
});
const RENDER_FOOTER_ACTION_KINDS = Object.freeze(['buttons', 'inline', 'keyboard', 'media']);

function getBlockFooterAddableActions(type) {
  if (!canRenderUi(type)) return [];
  return RENDER_FOOTER_ACTION_KINDS.filter((kind) => canAttach(kind, type));
}

function normalizeBlockUi(block) {
  const ui = block?.ui && typeof block.ui === 'object' ? block.ui : {};
  if (!canRenderUi(block?.type)) {
    return { ...ui, addableActions: [] };
  }
  const configured = Array.isArray(ui.addableActions)
    ? ui.addableActions
    : (Array.isArray(ui.addable) ? ui.addable : getBlockFooterAddableActions(block?.type));
  return {
    ...ui,
    addableActions: configured.filter((kind) => Boolean(BLOCK_FOOTER_ACTION_TYPES[kind])),
  };
}

function normalizeUiAttachments(value) {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    replies: Array.isArray(src.replies) ? src.replies : [],
    buttons: Array.isArray(src.buttons) ? src.buttons : [],
    inline: Array.isArray(src.inline) ? src.inline : [],
    media: Array.isArray(src.media) ? src.media : [],
    transitions: Array.isArray(src.transitions) ? src.transitions : [],
  };
}

function normalizeUiAttachmentsForOwner(value, ownerType) {
  const normalized = normalizeUiAttachments(value);
  if (!canRenderUi(ownerType)) return normalizeUiAttachments(null);
  const allowed = new Set(getBlockFooterAddableActions(ownerType));
  return {
    ...normalizeUiAttachments(null),
    buttons: allowed.has('buttons') ? normalized.buttons : [],
    inline: allowed.has('inline') ? normalized.inline : [],
    media: allowed.has('media') ? normalized.media : [],
  };
}

function normalizeStudioBlockNode(block) {
  if (!block) return block;
  return {
    ...block,
    ui: normalizeBlockUi(block),
    uiAttachments: normalizeUiAttachmentsForOwner(block.uiAttachments, block.type),
  };
}

function normalizeStudioStacks(stacks) {
  return (stacks || []).map((stack) => ({
    ...stack,
    blocks: (stack.blocks || []).map(normalizeStudioBlockNode),
  }));
}

function createStudioBlockNode(type, props = {}, id = uid()) {
  return normalizeStudioBlockNode({ id, type, props });
}

function countUiAttachments(block) {
  const attachments = normalizeUiAttachmentsForOwner(block?.uiAttachments, block?.type);
  return Object.values(attachments).reduce((sum, list) => sum + list.length, 0);
}

function defaultUiAttachment(kind, source = {}) {
  const id = attachmentUid();
  if (kind === 'reply') return { id, text: source.text || 'Ответ' };
  if (kind === 'buttons') return { id, text: source.text || 'Кнопка', action: source.action || 'goto:main' };
  if (kind === 'inline') return { id, text: source.text || 'Кнопка', callback: source.callback || 'callback', action: source.action || '' };
  if (kind === 'media') return { id, kind: source.kind || 'photo', url: source.url || '', caption: source.caption || '' };
  if (kind === 'transition') return { id, action: source.action || 'goto', target: source.target || 'main' };
  return { id };
}

function legacyBlockToUiAttachment(type, props = {}) {
  if (type === 'buttons') return { kind: 'buttons', attachment: defaultUiAttachment('buttons', { text: firstReplyButtonLabelFromRows(props.rows) || 'Кнопка' }) };
  if (type === 'inline') {
    const [first = 'Кнопка', callback = 'callback'] = String(props.buttons || '').split(/[,\n]/)[0]?.split('|').map((x) => x.trim()) || [];
    return { kind: 'inline', attachment: defaultUiAttachment('inline', { text: first || 'Кнопка', callback: callback || 'callback' }) };
  }
  if (type === 'inline_db') {
    return {
      kind: 'inline',
      attachment: {
        ...defaultUiAttachment('inline', { text: props.backText || 'Назад', callback: props.backCallback || 'назад' }),
        inlineDb: { ...props },
      },
    };
  }
  return null;
}

function addUiAttachment(block, kind, attachment = defaultUiAttachment(kind)) {
  if (!canRenderUi(block?.type) || !BLOCK_FOOTER_ACTION_TYPES[kind]) return normalizeStudioBlockNode(block);
  const next = normalizeStudioBlockNode(block);
  const key = kind === 'reply' ? 'replies' : (kind === 'transition' ? 'transitions' : kind);
  return {
    ...next,
    uiAttachments: {
      ...next.uiAttachments,
      [key]: [...(next.uiAttachments[key] || []), attachment],
    },
  };
}

function canStackBelow(parentType, childType) {
  return getCompatibleBlockTypes(parentType).includes(childType);
}

/** Высота стека в координатах холста (согласовано с расчётом snap при перетаскивании стека) */
function getStackBlocksHeight(stack) {
  if (!stack?.blocks?.length) return 0;
  return stack.blocks.reduce((acc, b, i) => {
    const def = getBlockDef(b.type);
    const h = i === 0 ? ROOT_H : BLOCK_H;
    return acc + h + (def?.canStack && !['stop', 'goto', 'bot', 'version', 'global', 'commands'].includes(b.type) ? 0 : 0);
  }, 0);
}

function getBlockTopInStack(stack, blockIndex) {
  if (!stack?.blocks?.length || blockIndex <= 0) return 0;
  return stack.blocks.slice(0, blockIndex).reduce((acc, b, i) => {
    const def = getBlockDef(b.type);
    const h = i === 0 ? ROOT_H : BLOCK_H;
    return acc + h + (def?.canStack && !['stop', 'goto', 'bot', 'version', 'global', 'commands'].includes(b.type) ? 0 : 0);
  }, 0);
}

const SNAP_NEW_TO_STACK_DX = 70;
const SNAP_NEW_TO_STACK_DY = 50;

/** Подносим новый блок с палитры к низу стека: в зоне snap — { stackId, valid }; иначе null */
function findNewBlockSnapTarget(stacks, worldGhostLeft, worldGhostTop, newType) {
  let best = null;
  let bestScore = Infinity;
  for (const s of stacks) {
    const last = s.blocks[s.blocks.length - 1];
    if (!last) continue;
    const stackBottom = s.y + getStackBlocksHeight(s);
    const dx = Math.abs(worldGhostLeft - s.x);
    const dy = Math.abs(worldGhostTop - stackBottom);
    if (dx < SNAP_NEW_TO_STACK_DX && dy < SNAP_NEW_TO_STACK_DY) {
      const score = dx + dy;
      if (score < bestScore) {
        bestScore = score;
        best = {
          stackId: s.id,
          valid: canStackBelow(last.type, newType),
          parentType: last.type,
        };
      }
    }
  }
  return best;
}

function snapAttachRejectHint(parentType, childType, ui) {
  const t = ui || getConstructorStrings('ru');
  if (UI_ATTACHMENT_LEGACY_BLOCK_TYPES.includes(childType)) {
    return t.snapButtonsNeedMessage;
  }
  if (childType === 'inline' && parentType === 'inline') {
    return t.snapInlineTwice;
  }
  return t.snapWrongType;
}

// Порядок подсказки «что поставить ниже» — сначала самые нужные новичку
const NEXT_BLOCK_PRIORITY = [
  'message', 'buttons', 'inline', 'inline_db', 'condition', 'condition_not', 'else', 'ask', 'remember', 'use',
  'typing', 'delay', 'get', 'save', 'random', 'photo', 'video', 'stop', 'goto',
  'log', 'loop', 'switch', 'http', 'menu', 'poll', 'document', 'send_file', 'audio', 'sticker',
  'contact', 'location', 'notify', 'broadcast', 'database', 'classify', 'role', 'payment', 'analytics',
  'check_sub', 'member_role', 'forward_msg', 'db_delete', 'save_global', 'set_global', 'get_user', 'all_keys', 'call_block',
];

function getSuggestedNextBlockLabels(parentType, max = 14, blockTypes = BLOCK_TYPES) {
  const allowed = getCompatibleBlockTypes(parentType);
  if (!allowed?.length) return [];
  const set = new Set(allowed);
  const out = [];
  for (const t of NEXT_BLOCK_PRIORITY) {
    if (set.has(t)) {
      out.push(getBlockDef(t, blockTypes)?.label || t);
      if (out.length >= max) return out;
    }
  }
  for (const t of allowed) {
    const label = getBlockDef(t, blockTypes)?.label || t;
    if (!out.includes(label) && out.length < max) out.push(label);
  }
  return out;
}

/** Короткие подсказки для панели свойств (новичок) */
const BEGINNER_GUIDE = {
  version: 'Версия бота в шапке .ccd — для себя, один раз.',
  bot: 'Токен от @BotFather. Обязателен для запуска.',
  commands: 'Команды в меню Telegram (строка = одна команда). Показываются при вводе /.',
  global: 'Общая переменная на весь бот (одно значение для всех пользователей).',
  block: 'Именованный шаблон: внутри стека — обычная цепочка (ответ, кнопки…). Снаружи вызывай блоком «Использовать» с тем же именем (часто называют «приветствие», «главное_меню»).',
  use: 'Подставляет сюда код из блока «Блок» с тем же именем. Имя должно совпадать.',
  start: 'Точка входа при /start. Обычно: ответ приветствия → кнопки меню.',
  command: 'Реакция на /команда. В поле — имя без слэша (help для /help).',
  callback: 'Реакция на нажатие: для reply-клавиатуры — точный текст кнопки; для inline — callback из поля после «|».',
  on_photo: 'Срабатывает, когда пользователь прислал фото. Дальше — ответ, подпись к медиа и т.д.',
  on_voice: 'Срабатывает на голосовое сообщение.',
  on_document: 'Срабатывает на файл-документ.',
  on_sticker: 'Срабатывает на стикер.',
  on_location: 'Срабатывает на геолокацию (в DSL: при геолокации:).',
  on_contact: 'Срабатывает на отправленный контакт.',
  message: 'Текст ответа пользователю. Поддерживаются {переменные} и выражения в фигурных скобках.',
  buttons: 'Reply-клавиатура. Только после блока «Ответ» (нужен текст сообщения). Под «При нажатии» укажи тот же текст кнопки.',
  inline: 'Inline-кнопки под сообщением. Только после «Ответ». Формат: Текст|callback — под «При нажатии» укажи callback.',
  inline_db: 'Создаёт inline-кнопки из списка в БД: по одной кнопке на категорию/запись и последней строкой кнопку «Назад».',
  menu: 'Упрощённое меню из пунктов; часто перед переходами.',
  condition: 'Ветка если условие истинно. После можно добавить «Иначе» на том же уровне.',
  condition_not: 'Ветка если условие ложно (в коде: «если … не == …»). После можно добавить «Иначе».',
  else: 'Ветка «во всех остальных случаях». Ставь сразу под связанным «Если».',
  switch: 'Много вариантов по значению переменной (аналог switch).',
  ask: 'Бот задаёт вопрос и ждёт ответа пользователя; дальнейшие блоки идут после ввода.',
  remember: 'Временная переменная в сессии пользователя (до перезапуска диалога).',
  get: 'Читает значение из постоянного хранилища по ключу в переменную.',
  save: 'Ключ — имя записи в постоянном хранилище, значение — что именно сохранить.',
  random: 'Случайно выбирает одну строку из списка; обычно дальше — «Ответ».',
  loop: 'Повторяет вложенные блоки. Добавь «Стоп» или «Переход», чтобы не зациклиться.',
  http: 'Запрос к URL; ответ можно сохранить в переменную из поля.',
  delay: 'Пауза в секундах перед следующим блоком.',
  typing: 'Индикатор «печатает…» перед следующим сообщением или медиа.',
  stop: 'Прерывает сценарий; дальше по этому стеку ничего не выполняется.',
  goto: 'Переход к сценарию, команде или шагу по имени из поля.',
  log: 'Запись в консоль сервера — удобно для отладки.',
  notify: 'Отправляет прямое сообщение пользователю по его Telegram ID. Поле «target» — числовой ID или переменная с ним.',
  broadcast: 'Рассылка всем (mode=all) или группе (mode=group + тег). Тег — значение поля _сегмент в профиле пользователя.',
  check_sub: 'Проверяет подписку через getChatMember API. Результат true/false сохраняется в переменную. Используй в условии «если» дальше.',
  member_role: 'Возвращает роль участника в канале/группе: creator, administrator, member, restricted, left, kicked.',
  forward_msg: 'Пересылает всё сообщение другому Telegram ID или возвращает выбранное входящее содержимое: текст, фото, документ и т.д.',
  db_delete: 'Полностью удаляет ключ из БД (не обнуляет, а удаляет запись). Используй вместо сохранить "" = "".',
  save_global: 'Сохраняет значение в глобальную БД (общую для всех пользователей). Читать через обычный «Получить».',
  set_global: 'Обновляет runtime-глобальную переменную проекта. Подходит для общих списков и настроек, которые используют разные сценарии.',
  get_user: 'Читает данные ДРУГОГО пользователя по его ID. Только для adminской логики.',
  all_keys: 'Возвращает список всех ключей текущего пользователя в БД. Удобно для отладки и динамических операций.',
  call_block: 'Вызывает именованный блок и сохраняет значение «вернуть» в переменную. Блок должен содержать «вернуть значение».',
  database: 'SQL к внешней БД (если настроена).',
  payment: 'Инициация оплаты; нужны провайдер и сумма.',
  analytics: 'Событие для аналитики.',
  classify: 'Классификация текста по намерениям (AI).',
  role: 'Проверка роли пользователя.',
  photo: 'Отправка фото по URL или file_id.',
  video: 'Отправка видео.',
  audio: 'Отправка аудио.',
  document: 'Отправка файла.',
  send_file: 'Отправка уже сохранённого файла по Telegram file_id (не текстом). Укажите переменную или выражение.',
  sticker: 'Отправка стикера по file_id.',
  contact: 'Отправка контакта.',
  location: 'Отправка точки на карте.',
  poll: 'Опрос с вариантами ответа.',
  scenario: 'Именованный сценарий из шагов. На него можно перейти блоком «Переход».',
  step: 'Шаг внутри сценария. Переходы между шагами — блок «Переход».',
  middleware: 'Код до/после каждого сообщения (логирование, фильтры). Тип before или after.',
};

const NO_CHILD_HINT_TYPES = new Set(['stop', 'goto', 'bot', 'version', 'global', 'commands']);

function getBeginnerPanelHint(block, opts = {}) {
  const {
    omitSuggestedList = false,
    blockTypes = BLOCK_TYPES,
    ui,
    lang = 'ru',
  } = opts;
  const guide = mergeBeginnerGuide(lang, BEGINNER_GUIDE);
  const bt = block.type;
  const props = block.props || {};
  // Special UI for `location` block: latitude/longitude + map picker
  if (block.type === 'location') {
    // Location hint is currently rendered as a simple text hint in the beginner guide.
    // Avoid using hooks inside this helper function.
  }
  const parts = [];
  const base = guide[bt];
  if (base) parts.push(base);

  if (bt === 'block' && props.name?.trim() && ui) {
    parts.push(ui.beginnerBlockNamed(props.name.trim()));
  }
  if (bt === 'use' && props.blockname?.trim() && ui) {
    parts.push(ui.beginnerUseNamed(props.blockname.trim()));
  }
  if (bt === 'command' && props.cmd && ui) {
    parts.push(ui.beginnerCommand(props.cmd));
  }

  if (!omitSuggestedList && !NO_CHILD_HINT_TYPES.has(bt)) {
    const next = getSuggestedNextBlockLabels(bt, 16, blockTypes);
    if (next.length && ui) {
      parts.push(`${ui.beginnerChainIntro} ${next.join(' · ')}.`);
    }
  } else if ((bt === 'stop' || bt === 'goto') && ui) {
    parts.push(ui.beginnerStopGotoFooter);
  }

  return parts.filter(Boolean).join('\n\n');
}

const UNIQUE_BLOCK_TYPES = new Set(['version', 'bot', 'start']);
const FALLBACK_COMMAND_NAMES = ['help', 'menu', 'settings', 'about'];

function flattenBlocks(stacks) {
  return (stacks || []).flatMap((s) => s.blocks || []);
}

function hasBlockOfType(stacks, type) {
  return flattenBlocks(stacks).some((b) => b.type === type);
}

function normalizeCommandName(cmd) {
  return String(cmd ?? '').replace(/^\//, '').trim().toLowerCase();
}

function hasCommandNamed(stacks, commandName) {
  const name = normalizeCommandName(commandName);
  if (!name) return false;
  return flattenBlocks(stacks).some((b) => (
    b.type === 'command' && normalizeCommandName(b.props?.cmd) === name
  ));
}

function getNextAvailableCommandName(stacks) {
  for (const name of FALLBACK_COMMAND_NAMES) {
    if (!hasCommandNamed(stacks, name)) return name;
  }
  let i = 2;
  while (hasCommandNamed(stacks, `command${i}`)) i += 1;
  return `command${i}`;
}

function getUniqueBlockConflictMessage(stacks, type, props = {}) {
  if (UNIQUE_BLOCK_TYPES.has(type) && hasBlockOfType(stacks, type)) {
    const label = getBlockDef(type)?.label || type;
    return `Блок «${label}» уже есть на холсте. Удалите старый, чтобы добавить новый.`;
  }

  if (type === 'start' && hasCommandNamed(stacks, 'start')) {
    return 'Для /start уже есть блок «Команда /start». Удалите его перед добавлением «Старт».';
  }

  if (type === 'command') {
    const cmd = normalizeCommandName(props.cmd ?? DEFAULT_PROPS.command.cmd);
    if (!cmd) return null;
    if (cmd === 'start' && hasBlockOfType(stacks, 'start')) {
      return 'Для /start уже есть блок «Старт». Используйте другую команду или удалите «Старт».';
    }
    if (hasCommandNamed(stacks, cmd)) {
      return `Команда /${cmd} уже есть на холсте. У каждой команды должен быть один обработчик.`;
    }
  }

  return null;
}

/** Токен для нового блока «Бот»: test_token из профиля или первый непустой токен с холста. */
function resolveBotTokenForNewBlock(stacks, currentUser) {
  const fromProfile = currentUser?.test_token?.trim();
  if (fromProfile) return fromProfile;
  if (!Array.isArray(stacks)) return '';
  for (const s of stacks) {
    for (const b of s.blocks || []) {
      if (b.type === 'bot') {
        const t = String(b.props?.token ?? '').trim();
        if (t) return t;
      }
    }
  }
  return '';
}

function normalizeAiDiagnosticItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return { code: 'IR_DIAGNOSTIC', title: 'IR diagnostic', detail: item };
      if (!item || typeof item !== 'object') return null;
      return {
        code: item.code || item.reasonCode || 'IR_DIAGNOSTIC',
        title: item.title || item.label || item.code || 'IR diagnostic',
        detail: item.detail || item.message || item.disabledReason || '',
        severity: item.severity || 'info',
      };
    })
    .filter(Boolean);
}

function normalizeAiPartialResponse(data) {
  const sections = data?.diagnosticSections || {};
  const diagnostics = normalizeAiDiagnosticItems(data?.diagnostics || data?.warnings);
  const repairActions = normalizeAiDiagnosticItems(
    (data?.repairActions || []).map((action) => ({
      code: 'IR_AUTO_REPAIR',
      title: 'Автоисправление схемы',
      detail: action,
      severity: 'info',
    })),
  );
  const normalizedFixed = normalizeAiDiagnosticItems(sections.whatWasFixed);
  const normalizedFailed = normalizeAiDiagnosticItems(sections.whatFailed);
  const whatWorks = normalizeAiDiagnosticItems(sections.whatWorks);
  const whatWasFixed = normalizedFixed.length ? normalizedFixed : repairActions;
  const reasonCodes = Array.isArray(data?.reasonCodes)
    ? data.reasonCodes.filter(Boolean).map(String)
    : (data?.reason ? [String(data.reason)] : []);
  const executionMode = data?.executionMode || data?.meta?.executionMode || null;
  const skeletonFallback = (
    executionMode === 'FALLBACK_SKELETON' ||
    reasonCodes.includes('IR_FALLBACK_SKELETON_USED') ||
    data?.irState === 'SKELETON_IR'
  );
  const recoveryMode = executionMode === 'AI_RECOVERY';
  const fallbackFailed = normalizedFailed.length ? normalizedFailed : diagnostics;
  const whatFailed = fallbackFailed.filter((item) => (
    item?.severity !== 'info' &&
    item?.code !== 'IR_FALLBACK_SKELETON_USED'
  ));
  const safeToRun = Boolean(data?.safeToRun ?? data?.safeToExecute);
  const userActions = Array.isArray(data?.userActions) ? data.userActions : [];
  const hasContext = Boolean(
    reasonCodes.length ||
    whatWorks.length ||
    whatWasFixed.length ||
    whatFailed.length ||
    data?.reason ||
    data?.irState,
  );

  return {
    raw: data,
    status: data?.status || 'partial_success',
    reason: data?.reason || null,
    reasonCodes,
    executionMode,
    rootCause: data?.rootCause || data?.meta?.rootCause || null,
    aiConfidenceLabel: data?.aiConfidenceLabel || data?.meta?.aiConfidenceLabel || 'LOW',
    executionDecisionScore: data?.executionDecisionScore || data?.meta?.executionDecisionScore || null,
    isDegraded: Boolean(data?.isDegraded ?? skeletonFallback),
    isAIGenerated: Boolean(data?.isAIGenerated ?? !skeletonFallback),
    skeletonFallback,
    recoveryMode,
    safeToRun,
    userActions,
    sections: {
      whatWorks: whatWorks.length
        ? whatWorks
        : [{
          code: skeletonFallback ? 'IR_FALLBACK_SKELETON_USED' : 'IR_CONTEXT_MISSING',
          title: skeletonFallback ? 'Базовая версия сценария готова' : 'Рабочие части не описаны',
          detail: skeletonFallback
            ? 'Запущена базовая версия сценария (без сложной логики).'
            : 'Сервер не вернул список валидных частей IR, поэтому показана диагностическая карточка.',
          severity: skeletonFallback ? 'info' : 'warning',
        }],
      whatWasFixed,
      whatFailed: whatFailed.length
        ? whatFailed
        : (skeletonFallback
          ? []
          : [{ code: data?.reason || 'PARTIAL_IR', title: 'Блокирующих диагностик нет', detail: 'Для partial IR не осталось блокирующих ошибок.', severity: 'info' }]),
    },
    hasContext,
    canRunPartial: safeToRun && Array.isArray(data?.stacks) && data.stacks.length > 0,
  };
}

function AiDiagnosticSection({ title, items, emptyText }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
        {title}
      </div>
      {list.length > 0 ? list.map((item, index) => (
        <div
          key={`${item.code || title}-${index}`}
          style={{
            padding: '7px 9px',
            borderRadius: 8,
            background: item.severity === 'error' ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.04)',
            border: item.severity === 'error' ? '1px solid rgba(248,113,113,0.18)' : '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: 10, color: '#93c5fd' }}>
              {item.code}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>
              {item.title}
            </span>
          </div>
          {item.detail ? (
            <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text3)', lineHeight: 1.45 }}>
              {item.detail}
            </div>
          ) : null}
        </div>
      )) : (
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{emptyText}</div>
      )}
    </div>
  );
}

// ─── PROPS FIELDS ─────────────────────────────────────────────────────────
const FIELDS = {
  version:   [{ key:'version',   label:'версия (например 1.0)',                        tag:'input' }],
  bot:       [{ key:'token',     label:'Telegram Bot Token',                           tag:'input' }],
  commands:  [{ key:'commands',  label:'команды (каждая с новой строки)\n/cmd - Описание', tag:'textarea', rows:5 }],
  global:    [{ key:'varname',   label:'имя переменной',  tag:'input' },
              { key:'value',     label:'значение',         tag:'input' }],
  block:     [{ key:'name',      label:'имя блока',        tag:'input' }],
  use:       [{ key:'blockname', label:'имя блока',        tag:'input' }],
  middleware: [{ key:'type',     label:'тип: before или after', tag:'input' },
              { key:'return',    label:'вернуть после (true/false)', tag:'input' }],
  start:     [],
  on_photo:  [],
  on_voice:  [],
  on_document:[],
  on_sticker:[],
  on_location:[],
  on_contact:[],
  message:   [{ key:'text',      label:'текст ответа',     tag:'textarea', rows:3 },
              { key:'markup',    label:'разметка текста',  tag:'select',
                options:[
                  { value:'', label:'без разметки: ответ' },
                  { value:'html', label:'HTML: ответ_html' },
                  { value:'md2', label:'Markdown: ответ_md2' },
                  { value:'markdown_v2', label:'MarkdownV2: ответ_markdown_v2' },
                  { value:'md', label:'Markdown legacy: ответ_md' },
                ] },
              { key:'buttons',   label:'кнопки ответа: Текст → блок/сценарий', tag:'textarea', rows:3,
                placeholder:'➕ Добавить ещё → добавить_товар\n🏠 Главная → главная' }],
  buttons:   [{ key:'rows',      label:'кнопки (запятая = в ряд, Enter = новый ряд)', tag:'textarea', rows:4 }],
  command:   [{ key:'cmd',       label:'команда (без /)',   tag:'input' }],
  callback:  [{ key:'label',     label:'Reply-кнопка (текст)', tag:'input' },
              { key:'data',      label:'Inline-кнопка', tag:'input' },
              { key:'callbackPrefix', label:'Группа кнопок (префикс)', tag:'input' },
              { key:'return',    label:'вернуть после (true/false)', tag:'input' }],
  condition: [{ key:'cond',      label:'условие',           tag:'input' }],
  condition_not: [{ key:'cond',      label:'условие (будет отрицано)', tag:'input' }],
  else:      [],
  switch:    [{ key:'varname',   label:'переменная',        tag:'input' },
              { key:'cases',     label:'значения (каждое с новой строки)', tag:'textarea', rows:3 }],
  ask:       [{ key:'question',  label:'вопрос',            tag:'textarea', rows:2 },
              { key:'varname',   label:'переменная →',      tag:'input' }],
  remember:  [{ key:'varname',   label:'переменная',        tag:'input' },
              { key:'value',     label:'значение',           tag:'input' }],
  get:       [{ key:'key',       label:'ключ',              tag:'input' },
              { key:'varname',   label:'переменная →',      tag:'input' }],
  save:      [{ key:'key',       label:'ключ в хранилище',   tag:'input' },
              { key:'value',     label:'значение для сохранения', tag:'input' }],
  scenario:  [{ key:'name',      label:'название',          tag:'input' }],
  step:      [{ key:'name',      label:'имя шага',          tag:'input' },
              { key:'text',      label:'текст',              tag:'textarea', rows:2 }],
  random:    [{ key:'variants',  label:'варианты (каждый с новой строки)', tag:'textarea', rows:4 }],
  loop:      [{ key:'mode',       label:'режим: count / while / foreach / timeout', tag:'input' },
              { key:'count',     label:'кол-во повторений (count)',                 tag:'input' },
              { key:'cond',      label:'условие (while)',                            tag:'input' },
              { key:'var',       label:'переменная элемента (foreach)',              tag:'input' },
              { key:'collection',label:'коллекция (foreach)',                        tag:'input' },
              { key:'seconds',   label:'секунд (timeout)',                           tag:'input' }],
  menu:      [{ key:'title',     label:'заголовок меню',    tag:'input' },
              { key:'items',     label:'пункты (каждый с новой строки)', tag:'textarea', rows:4 }],
  photo:     [{ key:'url',       label:'URL фото или file_id', tag:'input' },
              { key:'caption',   label:'подпись (опц.)',     tag:'textarea', rows:2 }],
  video:     [{ key:'url',       label:'URL видео или file_id', tag:'input' },
              { key:'caption',   label:'подпись (опц.)',     tag:'textarea', rows:2 }],
  audio:     [{ key:'url',       label:'URL аудио или file_id', tag:'input' }],
  document:  [{ key:'url',       label:'URL файла или file_id', tag:'input' },
              { key:'filename',  label:'имя файла',          tag:'input' }],
  send_file: [{ key:'file',      label:'file_id или {переменная}', tag:'input' }],
  sticker:   [{ key:'file_id',   label:'file_id стикера',   tag:'input' }],
  contact:   [{ key:'phone',     label:'номер телефона',     tag:'input' },
              { key:'first_name',label:'имя',                tag:'input' },
              { key:'last_name', label:'фамилия (опц.)',     tag:'input' }],
  location:  [{ key:'lat',       label:'широта (latitude)',  tag:'input' },
              { key:'lon',       label:'долгота (longitude)',tag:'input' }],
  poll:      [{ key:'question',  label:'вопрос',             tag:'input' },
              { key:'options',   label:'варианты (каждый с новой строки)', tag:'textarea', rows:3 },
              { key:'type',      label:'тип: regular или quiz', tag:'input' }],
  delay:     [{ key:'seconds',   label:'секунд',             tag:'input' }],
  typing:    [{ key:'seconds',   label:'секунд',             tag:'input' }],
  http:      [{ key:'method',  label:'метод: GET / POST / PATCH / PUT / DELETE / HEADERS', tag:'input' },
              { key:'url',     label:'URL (не нужен для HEADERS)',                           tag:'input' },
              { key:'body',    label:'тело с "данные" (опц., для POST/PATCH/PUT)',           tag:'input' },
              { key:'jsonVar', label:'json-переменная (опц., вместо body)',                  tag:'input' },
              { key:'isJson',  label:'тело — json-переменная? (true/false)',                 tag:'input' },
              { key:'varname', label:'переменная → (результат или имя переменной заголовков)', tag:'input' }],
  goto:      [{ key:'target',    label:'Куда перейти',       tag:'input' }],
  stop:      [],
  inline:    [{ key:'buttons',   label:'кнопки: Текст|callback, ...\n(запятая = в ряд, Enter = новый ряд)', tag:'textarea', rows:4 }],
  inline_db: [{ key:'key',       label:'ключ БД со списком', tag:'input' },
              { key:'labelField', label:'поле текста кнопки', tag:'input' },
              { key:'idField', label:'поле id для callback', tag:'input' },
              { key:'callbackPrefix', label:'callback prefix', tag:'input' },
              { key:'backText',  label:'текст кнопки назад', tag:'input' },
              { key:'backCallback', label:'callback назад', tag:'input' },
              { key:'columns',   label:'кнопок в ряд', tag:'input' }],
  database:  [{ key:'query',     label:'SQL запрос',         tag:'textarea', rows:3 },
              { key:'varname',   label:'переменная →',      tag:'input' }],
  classify:  [{ key:'intents',   label:'намерения (каждое с новой строки)', tag:'textarea', rows:3 },
              { key:'varname',   label:'переменная →',      tag:'input' }],
  log:       [{ key:'message',   label:'сообщение',          tag:'input' },
              { key:'level',     label:'уровень: info/warn/error', tag:'input' }],
  role:      [{ key:'roles',     label:'роли (каждая с новой строки)', tag:'textarea', rows:3 },
              { key:'varname',   label:'переменная с ролью', tag:'input' }],
  payment:   [{ key:'provider',  label:'провайдер: stripe / telegram', tag:'input' },
              { key:'amount',    label:'сумма',              tag:'input' },
              { key:'currency',  label:'валюта (USD, EUR...)', tag:'input' },
              { key:'title',     label:'название платежа',   tag:'input' }],
  analytics: [{ key:'event',     label:'название события',   tag:'input' },
              { key:'params',    label:'параметры (опц.)',    tag:'textarea', rows:2 }],
  // ── Новые типы ────────────────────────────────────────────────────────────
  notify:      [{ key:'target',  label:'user_id или переменная',                  tag:'input' },
                { key:'text',    label:'текст уведомления',                        tag:'textarea', rows:2 }],
  broadcast:   [{ key:'mode',   label:'режим: all или group',                     tag:'input' },
                { key:'tag',    label:'тег группы (если mode=group)',              tag:'input' },
                { key:'text',   label:'текст рассылки',                            tag:'textarea', rows:2 }],
  check_sub:   [{ key:'channel',label:'канал (например @mychannel)',               tag:'input' },
                { key:'varname',label:'переменная → (true/false)',                 tag:'input' }],
  member_role: [{ key:'channel',label:'канал (например @mychannel)',               tag:'input' },
                { key:'user_id',label:'user_id (или переменная)',                  tag:'input' },
                { key:'varname',label:'переменная → (creator/admin/member/left)',  tag:'input' }],
  forward_msg: [{ key:'mode',   label:'что переслать', tag:'select',
                  options:[
                    { value:'message', label:'сообщение другому пользователю' },
                    { value:'text', label:'текст в этот чат' },
                    { value:'photo', label:'фото в этот чат' },
                    { value:'document', label:'документ в этот чат' },
                    { value:'voice', label:'голосовое в этот чат' },
                    { value:'audio', label:'аудио в этот чат' },
                    { value:'sticker', label:'стикер в этот чат' },
                  ] },
                { key:'target', label:'кому переслать (ID или переменная)',       tag:'input' },
                { key:'caption',label:'подпись для медиа (опц.)',                 tag:'input' }],
  db_delete:   [{ key:'key',    label:'ключ для удаления из БД',                  tag:'input' }],
  save_global: [{ key:'key',   label:'ключ (глобальная БД)',                       tag:'input' },
                { key:'value', label:'значение',                                   tag:'input' }],
  set_global:  [{ key:'varname',label:'имя глобальной переменной',                 tag:'input' },
                { key:'value', label:'новое значение',                             tag:'input' }],
  get_user:    [{ key:'user_id',label:'user_id другого пользователя',             tag:'input' },
                { key:'key',   label:'ключ в его БД',                              tag:'input' },
                { key:'varname',label:'переменная →',                             tag:'input' }],
  all_keys:    [{ key:'varname',label:'переменная → (список ключей)',              tag:'input' }],
  call_block:  [{ key:'blockname',label:'имя блока (вернуть внутри)',              tag:'input' },
                { key:'varname', label:'переменная → (результат вернуть)',         tag:'input' }],
};


// ─── SMART PROP INFERENCE ─────────────────────────────────────────────────────
// Смотрит на блок-родитель (верхний в стеке) и подставляет умные дефолты
// для нового блока типа newType. Возвращает объект props или {} если ничего не нашёл.
function suggestStorageKeyForVar(varname) {
  const clean = String(varname || '').trim();
  if (!clean) return '';
  if (/(^|_)(user|profile|пользователь|профиль)|(_пользователя|_user|_profile)$/i.test(clean)) {
    return clean;
  }
  return `${clean}_пользователя`;
}

function inferPropsFromParent(parentBlock, newType, allBlocksInStack) {
  if (!parentBlock) return {};
  const p = parentBlock.props || {};
  const parentType = parentBlock.type;

  // Собираем все переменные, определённые выше в стеке (ask → varname, get → varname, remember → varname)
  const definedVars = [];
  (allBlocksInStack || []).forEach(b => {
    if (b.props?.varname) definedVars.push(b.props.varname);
    if (b.props?.key) definedVars.push(b.props.key);
  });
  const lastVar = definedVars[definedVars.length - 1] || '';

  switch (newType) {

    // ── Сохранить: берём ключ и значение из контекста родителя ───────────────
    case 'save': {
      // После ask — сохраняем то что спросили
      if (parentType === 'ask') {
        return { key: suggestStorageKeyForVar(p.varname), value: p.varname || '' };
      }
      // После get — сохраняем обратно по тому же ключу
      if (parentType === 'get') {
        return { key: p.key || '', value: p.varname || '' };
      }
      // После remember — тот же varname
      if (parentType === 'remember') {
        return { key: suggestStorageKeyForVar(p.varname), value: p.varname || '' };
      }
      // После http — сохраняем результат запроса
      if (parentType === 'http') {
        const varname = p.varname || 'результат';
        return { key: suggestStorageKeyForVar(varname), value: varname };
      }
      // Если в стеке есть переменная — предлагаем её
      if (lastVar) {
        return { key: suggestStorageKeyForVar(lastVar), value: lastVar };
      }
      return {};
    }

    // ── Получить: берём ключ из контекста ────────────────────────────────────
    case 'get': {
      if (parentType === 'save') {
        return { key: p.key || '', varname: p.key || '' };
      }
      if (parentType === 'ask') {
        return { key: p.varname || '', varname: p.varname || '' };
      }
      if (lastVar) {
        return { key: lastVar, varname: lastVar };
      }
      return {};
    }

    // ── Запомнить: берём varname из ask/get ──────────────────────────────────
    case 'remember': {
      if (parentType === 'ask') {
        return { varname: p.varname || '', value: '' };
      }
      if (parentType === 'get') {
        return { varname: p.varname || '', value: p.varname || '' };
      }
      if (lastVar) {
        return { varname: lastVar, value: '' };
      }
      return {};
    }

    // ── Условие: строим условие из переменной родителя ───────────────────────
    case 'condition':
    case 'condition_not': {
      if (parentType === 'ask') {
        return { cond: `${p.varname || 'ответ'} == ""` };
      }
      if (parentType === 'get') {
        return { cond: `${p.varname || 'значение'} == ""` };
      }
      if (parentType === 'remember') {
        return { cond: `${p.varname || 'переменная'} == ""` };
      }
      if (parentType === 'save') {
        return { cond: `${p.key || 'ключ'} == ""` };
      }
      if (parentType === 'http') {
        return { cond: `${p.varname || 'результат'} != ""` };
      }
      return {};
    }

    // ── Ответ: подсказываем использовать переменную ───────────────────────────
    case 'message': {
      if (parentType === 'ask') {
        return { text: `Вы ввели: {${p.varname || 'ответ'}}` };
      }
      if (parentType === 'get') {
        return { text: `{${p.varname || 'значение'}}` };
      }
      if (parentType === 'http') {
        return { text: `{${p.varname || 'результат'}}` };
      }
      return {};
    }

    // ── Переход: берём цель из контекста ─────────────────────────────────────
    case 'goto': {
      // После callback — часто переходят к сценарию с похожим именем
      if (parentType === 'callback') {
        return { target: (p.label || '').toLowerCase().replace(/\s+/g, '_') };
      }
      return {};
    }

    // ── Спросить: берём вопрос из текста ответа выше ─────────────────────────
    case 'ask': {
      if (parentType === 'message') {
        // Если текст выглядит как вопрос — предлагаем varname
        const text = p.text || '';
        const isQuestion = text.includes('?') || text.includes(':');
        return isQuestion ? { question: text, varname: '' } : {};
      }
      return {};
    }

    // ── Переключатель: берём varname из контекста ────────────────────────────
    case 'switch': {
      if (lastVar) return { varname: lastVar, cases: '' };
      return {};
    }

    default:
      return {};
  }
}

// ─── ID GENERATOR ─────────────────────────────────────────────────────────
let seq = 1;
let attachmentSeq = 1;
const uid = () => `b${seq++}`;
function resetUidSequence(value = 1) { seq = value; }
function attachmentUid() { return `ua${attachmentSeq++}`; }
function resetAttachmentUidSequence(value = 1) { attachmentSeq = value; }

/** After loading a graph, bump node id sequence past existing bN node ids. */
function syncUidSequenceFromGraph(doc) {
  let max = 0;
  for (const id of Object.keys(doc?.nodes || {})) {
    const match = /^b(\d+)$/i.exec(String(id));
    if (match) max = Math.max(max, Number.parseInt(match[1], 10) || 0);
  }
  resetUidSequence(max + 1);
  let maxAttachment = 0;
  for (const node of Object.values(doc?.nodes || {})) {
    const groups = node?.meta?.uiAttachments;
    if (!groups || typeof groups !== 'object') continue;
    for (const list of Object.values(groups)) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        const m = /^ua(\d+)$/i.exec(String(item?.id || ''));
        if (m) maxAttachment = Math.max(maxAttachment, Number.parseInt(m[1], 10) || 0);
      }
    }
  }
  resetAttachmentUidSequence(maxAttachment + 1);
}

// ─── PUZZLE SVG PATH ──────────────────────────────────────────────────────
// Blocks snap vertically. Tab protrudes from bottom, socket on top.
function puzzlePath(w, h, hasTopSocket, hasBottomTab) {
  const R  = 6;   // corner radius
  const TW = 10;  // tab width (horizontal protrusion from bottom)
  const TH = 8;   // tab height (vertical)
  const TX = 22;  // tab X from left

  // Top edge: flat with socket notch if hasTopSocket
  let top = `M ${R} 0`;
  if (hasTopSocket) {
    top += ` L ${TX} 0 C ${TX} -${TH} ${TX+TW} -${TH} ${TX+TW} 0`;
  }
  top += ` L ${w-R} 0 Q ${w} 0 ${w} ${R}`;

  // Right edge
  const right = `L ${w} ${h-R} Q ${w} ${h} ${w-R} ${h}`;

  // Bottom edge: tab protrudes down if hasBottomTab
  let bottom;
  if (hasBottomTab) {
    bottom = `L ${TX+TW} ${h} C ${TX+TW} ${h+TH} ${TX} ${h+TH} ${TX} ${h} L ${R} ${h} Q 0 ${h} 0 ${h-R}`;
  } else {
    bottom = `L ${R} ${h} Q 0 ${h} 0 ${h-R}`;
  }

  // Left edge
  const left = `L 0 ${R} Q 0 0 ${R} 0`;

  return `${top} ${right} ${bottom} ${left} Z`;
}

function darken(hex, amt = 40) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `rgb(${r},${g},${b})`;
}

// ─── BLOCK DIMENSIONS ────────────────────────────────────────────────────
const BLOCK_W  = 200;
const BLOCK_H  = 36;  // regular block
const ROOT_H   = 42;  // first block in stack (root)
const MOBILE_TOP_BAR_H = 52;
const MOBILE_BOTTOM_NAV_H = 56;

// ─── SINGLE BLOCK VISUAL ──────────────────────────────────────────────────
// Предупреждения и заметки для конкретных блоков
const BLOCK_NOTES = {
  start:    { icon: '💡', color: '#3ecf8e', text: 'Точка входа /start. Часто: «Ответ» или «Использовать» с именем блока «приветствие» / главное_меню.' },
  command:  { icon: '💡', color: '#fbbf24', text: 'Своя команда: в поле имя без / (help → /help). Можно связать с пунктом из «Команды меню».' },
  block:    { icon: '💡', color: '#a78bfa', text: 'Именованный фрагмент сценария. Внутри — цепочка блоков; снаружи вызывай «Использовать» с тем же именем.' },
  message:  { icon: '💡', color: '#5b7cf6', text: 'Текст сообщения. К «Ответу» и медиа можно добавить «Кнопки» и «Inline» (reply_markup).' },
  photo:    { icon: '💡', color: '#34d399', text: 'Фото с подписью. Под блоком — «Кнопки», «Inline» и «При нажатии» для callback.' },
  video:    { icon: '💡', color: '#2dd4bf', text: 'Видео с подписью. Inline/reply-клавиатура поддерживается (reply_markup).' },
  audio:    { icon: '💡', color: '#818cf8', text: 'Аудио. Можно добавить reply/inline-кнопки под отправкой.' },
  document: { icon: '💡', color: '#94a3b8', text: 'Документ с подписью. Кнопки и inline — как у «Ответа».' },
  sticker:  { icon: '💡', color: '#f472b6', text: 'Стикер. Inline/reply-кнопки можно привязать к отправке.' },
  scenario: { icon: '💡', color: '#34d399', text: 'Сценарий из шагов. Перейти сюда: блок «Переход» → имя сценария.' },
  step:     { icon: '💡', color: '#059669', text: 'Шаг внутри сценария. К другому шагу — «Переход» с именем шага.' },
  middleware:{ icon: '💡', color: '#64748b', text: 'before/after — до или после каждого сообщения. «вернуть» прерывает обработку.' },
  on_photo: { icon: '💡', color: '#34d399', text: 'Когда прислали фото. Дальше — ответ, подпись, кнопки как в обычном диалоге.' },
  on_voice: { icon: '💡', color: '#818cf8', text: 'Когда прислали голосовое. Дальше — тот же набор блоков, что после «Ответ».' },
  on_document:{ icon: '💡', color: '#94a3b8', text: 'Когда прислали документ. Дальше — ответ, логика, сохранение файла и т.д.' },
  send_file:  { icon: '💡', color: '#64748b', text: 'Вызывает Telegram sendDocument: передайте file_id из переменной (не путать с текстом в «Ответ»).' },
  on_sticker:{ icon: '💡', color: '#f472b6', text: 'Когда прислали стикер.' },
  on_location:{ icon: '💡', color: '#ef4444', text: 'Когда поделились геолокацией (в .ccd: при геолокации:).' },
  on_contact:{ icon: '💡', color: '#0ea5e9', text: 'Когда отправили контакт.' },
  inline:   { icon: '⚠️', color: '#f59e0b', text: 'Inline-кнопки под «Ответом» или медиа (фото, видео, документ…). Нажатия — блок «При нажатии» (callback).' },
  buttons:  { icon: '⚠️', color: '#f59e0b', text: 'Reply-клавиатура под «Ответом» или медиа. Меняет раскладку клавиатуры пользователя.' },
  callback: { icon: '💡', color: '#60a5fa', text: 'Inline: укажите callback_data в поле «callback_data» (или префикс). Reply-клавиатура: точный текст кнопки в поле «текст reply-кнопки».' },
  else:     { icon: '⚠️', color: '#f59e0b', text: 'Блок «Иначе» должен идти сразу после блока «Если».' },
  stop:     { icon: '🛑', color: '#ef4444', text: 'Блок «Стоп» завершает выполнение сценария. После него блоки не добавляются.' },
  goto:     { icon: '↩️', color: '#a3a3a3', text: 'Блок «Переход» передаёт управление другому сценарию. После него блоки не выполняются.' },
  ask:      { icon: '💡', color: '#60a5fa', text: 'Бот ждёт ввода от пользователя. Следующий шаг выполнится только после его ответа.' },
  condition:{ icon: '💡', color: '#60a5fa', text: 'После «Если» можно добавить «Иначе» для обработки альтернативной ветки.' },
  condition_not:{ icon: '💡', color: '#f472b6', text: 'После «Если не» можно добавить «Иначе» для альтернативной ветки.' },
  http:     { icon: '💡', color: '#60a5fa', text: 'Укажи «переменная →» чтобы сохранить ответ сервера и использовать его в следующих блоках.' },
  remember: { icon: '💡', color: '#60a5fa', text: 'Значение хранится только в рамках текущей сессии пользователя.' },
  save:     { icon: '💡', color: '#60a5fa', text: 'Ключ — имя записи в БД, например имя_пользователя. Значение — переменная или текст, который нужно сохранить.' },
  bot:      { icon: '⚠️', color: '#f59e0b', text: 'Обязательно укажи токен от @BotFather. Без токена бот не запустится.' },
  version:  { icon: '💡', color: '#60a5fa', text: 'Версия указывается один раз в начале файла.' },
  use:      { icon: '💡', color: '#60a5fa', text: 'Вызывает ранее объявленный блок «Блок» по имени.' },
  loop:       { icon: '⚠️', color: '#f59e0b', text: 'Режимы: count (повторить N раз), while (пока условие), foreach (для каждого в коллекции), timeout (с ограничением по времени). Добавь «Прервать» или «Стоп» внутри чтобы выйти.' },
  payment:    { icon: '⚠️', color: '#f59e0b', text: 'Для Telegram-платежей нужен токен провайдера от @BotFather.' },
  classify:   { icon: '💡', color: '#60a5fa', text: 'Классифицирует текст пользователя по заданным намерениям с помощью AI.' },
  random:     { icon: '💡', color: '#60a5fa', text: 'Каждый раз выбирает случайный вариант из списка.' },
  // ── Новые типы ────────────────────────────────────────────────────────────
  check_sub:   { icon: '💡', color: '#10b981', text: 'Реальная проверка подписки через Telegram API. Результат true/false — проверяй после через «Если».' },
  member_role: { icon: '💡', color: '#059669', text: 'Возвращает роль: creator → administrator → member → restricted → left → kicked.' },
  forward_msg: { icon: '💡', color: '#34d399', text: 'Режим «сообщение» пересылает весь update на ID. Режимы «текст/фото/документ…» возвращают входящее содержимое в текущий чат.' },
  broadcast:   { icon: '⚠️', color: '#0ea5e9', text: 'Рассылка отправляет сообщения последовательно — для больших баз может занять время. Используй только из обработчика кнопки.' },
  db_delete:   { icon: '💡', color: '#ef4444', text: 'Удаляет ключ полностью, не обнуляет. Для обнуления используй «Сохранить» с пустым значением.' },
  save_global: { icon: '💡', color: '#10b981', text: 'Глобальная БД одна для всех пользователей. Читается через обычный «Получить».' },
  set_global:  { icon: '💡', color: '#10b981', text: 'Обновляет общую переменную проекта: например товары = добавить(товары, новый_товар).' },
  get_user:    { icon: '⚠️', color: '#f59e0b', text: 'Читает данные ДРУГОГО пользователя — только для admin-функций. В «user_id» укажи ID цели.' },
  all_keys:    { icon: '💡', color: '#64748b', text: 'Возвращает список всех ключей текущего пользователя. Хорошо сочетается с циклом «для каждого».' },
  call_block:  { icon: '💡', color: '#8b5cf6', text: 'Блок должен содержать «вернуть значение». Результат сохранится в указанную переменную.' },
};

function BlockNoteBox({ note, compact }) {
  return (
    <div style={{
      display: 'flex', gap: compact ? 8 : 6, alignItems: 'flex-start',
      background: note.color + (compact ? '14' : '18'),
      border: `1px solid ${note.color}${compact ? '40' : '44'}`,
      borderRadius: compact ? 10 : 6,
      padding: compact ? '10px 12px' : '6px 8px',
      marginBottom: compact ? 12 : 8,
      fontSize: compact ? 12 : 10,
      color: note.color,
      lineHeight: 1.55,
    }}>
      <span style={{ flexShrink: 0, fontSize: compact ? 16 : undefined }}>{note.icon}</span>
      <span>{note.text}</span>
    </div>
  );
}

function CompatibleBlockChip({ def, isModal, color, onAdd, ui }) {
  const hasNote = !!BLOCK_NOTES[def.type];
  return (
    <span
      key={def.type}
      onClick={isModal && onAdd ? (e) => { e.stopPropagation(); onAdd(def.type); } : undefined}
      title={isModal && onAdd ? ui.compatibleAddBlock(def.label) : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: isModal ? `${def.color}18` : def.color + '22',
        border: `1px solid ${hasNote ? def.color + (isModal ? '55' : 'aa') : def.color + (isModal ? '35' : '55')}`,
        borderRadius: 6,
        padding: isModal ? '4px 8px' : '2px 5px',
        fontSize: isModal ? 11 : 10,
        color: def.color,
        fontFamily: 'system-ui',
        cursor: (isModal && onAdd) ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: isModal ? 12 : 9 }}>{def.icon}</span>
      {def.label}
      {hasNote && <span style={{ fontSize: 8, opacity: 0.7 }}>ℹ</span>}
      {isModal && onAdd && <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 1 }}>＋</span>}
    </span>
  );
}

function CompatibleBlocksSection({ header, blocks, isModal, color, onAdd, ui }) {
  if (!blocks?.length) return null;
  return (
    <div style={{ marginBottom: isModal ? 10 : 6 }}>
      {header ? (
        <div style={{
          fontSize: isModal ? 10 : 9,
          color: isModal ? 'var(--text3)' : 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: isModal ? 5 : 3,
          fontFamily: 'Syne, system-ui',
        }}>{header}</div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isModal ? 5 : 3 }}>
        {blocks.map((def) => (
          <CompatibleBlockChip
            key={def.type}
            def={def}
            isModal={isModal}
            color={color}
            onAdd={onAdd}
            ui={ui}
          />
        ))}
      </div>
    </div>
  );
}

/** Список типов блоков, которые можно поставить под данным (по CAN_STACK_BELOW). mode: tooltip — тёмный фон тултипа; modal — панель модалки */
function CompatibleBlocksHint({ type, color, mode = 'tooltip', onAdd }) {
  const ctx = React.useContext(BuilderUiContext);
  const blockTypes = resolveBuilderCatalog(ctx);
  const ui = ctx?.t || getConstructorStrings('ru');

  const allowed = getCompatibleBlockTypes(type);
  const isModal = mode === 'modal';
  const allowedSet = new Set(allowed);
  const defsByType = new Map();
  allowed.forEach((ct) => {
    const d = blockTypes.find((b) => b.type === ct);
    if (d) defsByType.set(ct, d);
  });

  if (allowed.length === 0) {
    return (
      <div style={{
        fontSize: isModal ? 12 : 11,
        color: isModal ? 'var(--text3)' : 'rgba(255,255,255,0.5)',
        fontStyle: 'italic',
      }}>
        {ui.compatibleNoBelow}
      </div>
    );
  }

  const grouped = {};
  for (const def of defsByType.values()) {
    const gid = def.groupId || RU_GROUP_TO_ID[def.group] || def.group;
    if (!grouped[gid]) grouped[gid] = [];
    grouped[gid].push(def);
  }

  const frequentBlocks = isModal
    ? QUICK_ADD_FREQUENT_BLOCK_TYPES
      .filter((ct) => allowedSet.has(ct) && defsByType.has(ct))
      .map((ct) => defsByType.get(ct))
    : [];
  const frequentTypes = new Set(frequentBlocks.map((d) => d.type));

  return (
    <div style={{ minWidth: isModal ? undefined : 200, maxWidth: isModal ? undefined : 260 }}>
      <div style={{
        fontSize: isModal ? 11 : 10,
        fontWeight: 700,
        color: isModal ? 'var(--text)' : color,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: isModal ? 10 : 8,
        fontFamily: 'Syne, system-ui',
        borderBottom: isModal ? '1px solid var(--border)' : `1px solid ${color}44`,
        paddingBottom: isModal ? 8 : 5,
      }}>{ui.compatibleCanAddBelow}</div>
      {isModal && frequentBlocks.length > 0 && (
        <CompatibleBlocksSection
          header={ui.compatibleFrequentBelow || 'Часто используются'}
          blocks={frequentBlocks}
          isModal={isModal}
          color={color}
          onAdd={onAdd}
          ui={ui}
        />
      )}
      {paletteSidebarSectionOrder().map((gid) => {
        const groupBlocks = (grouped[gid] || []).filter((def) => !frequentTypes.has(def.type));
        if (!groupBlocks.length) return null;
        const header = groupBlocks[0]?.group || gid;
        return (
          <CompatibleBlocksSection
            key={gid}
            header={header}
            blocks={groupBlocks}
            isModal={isModal}
            color={color}
            onAdd={onAdd}
            ui={ui}
          />
        );
      })}
    </div>
  );
}

function BlockTooltip({ type, color }) {
  const ctx = React.useContext(BuilderUiContext);
  const lang = ctx?.lang || 'ru';
  const ui = ctx?.t || getConstructorStrings('ru');
  const allowed = getCompatibleBlockTypes(type);
  const rawNote = BLOCK_NOTES[type];
  const note = blockNoteForLang(lang, type, rawNote);

  if (allowed.length === 0) return (
    <div style={{ minWidth: 200, maxWidth: 260 }}>
      {note && <BlockNoteBox note={note} compact={false} />}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
        {ui.compatibleNoBelow}
      </div>
    </div>
  );

  return (
    <div style={{ minWidth: 200, maxWidth: 260 }}>
      {note && <BlockNoteBox note={note} compact={false} />}
      <CompatibleBlocksHint type={type} color={color} mode="tooltip" />
    </div>
  );
}

function BlockShape({ block, type, props, isFirst, selected, attention, onClick, onDelete, onAddFooterAction }) {
  const ctx = React.useContext(BuilderUiContext);
  const blockTypes = resolveBuilderCatalog(ctx);
  const ui = ctx?.t || getConstructorStrings('ru');
  const openBlockInfo = React.useContext(BlockInfoContext);
  const addBlockCtx = React.useContext(AddBlockContext);
  const isMobile = isMobileBuilderViewport();
  const actualBlock = normalizeStudioBlockNode(block || { type, props });
  const actualType = actualBlock.type;
  const actualProps = actualBlock.props || {};
  const def = getBlockDef(actualType, blockTypes);
  if (!def) return null;

  const color   = def.color;
  const icon    = def.icon;
  const label   = def.label;
  const preview = getPreview(actualType, actualProps, { uiAttachments: actualBlock.uiAttachments });

  // Puzzle notch logic
  const hasTopSocket  = !isFirst;
  const hasBottomTab  = def.canStack && !['stop','goto','bot','version','global','commands'].includes(type);
  const h = isFirst ? ROOT_H : BLOCK_H;
  const path = puzzlePath(BLOCK_W, h, hasTopSocket, hasBottomTab);
  const dark = darken(color, 45);

  return (
    <div
      data-block-shape=""
      style={{
        '--new-block-glow': color,
        position: 'relative',
        width: BLOCK_W + 4,
        height: h + (hasBottomTab ? 8 : 0),
        marginBottom: hasBottomTab ? -8 : 0,
        cursor: 'pointer',
        userSelect: 'none',
        animation: attention ? 'editorNewBlockBlink 0.9s ease-in-out infinite' : undefined,
      }}
      onClick={onClick}
      onDoubleClick={e => {
        if (e.target.closest?.('button')) return;
        e.stopPropagation();
        if (openBlockInfo) openBlockInfo({ type: actualType, props: actualProps });
      }}
    >
      <svg
        width={BLOCK_W + 24}
        height={h + 24}
        viewBox={`-4 -8 ${BLOCK_W + 16} ${h + 16}`}
        style={{
          position: 'absolute', top: 0, left: 0,
          overflow: 'visible', pointerEvents: 'none',
          filter: selected
            ? `drop-shadow(0 0 7px ${color}cc) drop-shadow(0 2px 10px rgba(0,0,0,.8))`
            : 'drop-shadow(0 2px 7px rgba(0,0,0,.65))',
        }}
      >
        <path d={path} fill="rgba(0,0,0,0.35)" transform="translate(0,3)" />
        <path d={path} fill={color} />
        <clipPath id={`hc-${actualType}-${isFirst}`}><rect x="0" y="0" width={BLOCK_W} height={h} /></clipPath>
        <path d={path} fill={dark} clipPath={`url(#hc-${actualType}-${isFirst})`} opacity="0.45" />
        <path d={path} fill="rgba(255,255,255,0.12)" />
        <path d={path} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
        <path d={path} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1" transform="translate(0,1)" />
        {selected && <path d={path} fill="none" stroke="white" strokeWidth="2" opacity="0.85" />}
      </svg>

      {/* Content */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: BLOCK_W, height: h,
        display: 'flex', alignItems: 'center',
        padding: '0 8px 0 10px', gap: 6, zIndex: 2,
      }}>
        <span style={{ fontSize: isFirst ? 14 : 12, flexShrink: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }}>
          {icon}
        </span>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontSize: isFirst ? 11 : 10, fontWeight: 700, color: '#fff',
            fontFamily: 'Syne, system-ui', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
            textShadow: '0 1px 3px rgba(0,0,0,.7)', letterSpacing: '0.02em',
          }}>
            {label}
          </div>
          {preview && (
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.78)',
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textShadow: '0 1px 2px rgba(0,0,0,.5)', marginTop: 1,
            }}>
              {preview}
            </div>
          )}
        </div>
        {(!isMobile || selected) && (
        <button
          type="button"
          title={ui.blockHelpTitle}
          aria-label={ui.blockHelpAria}
          onClick={e => {
            e.stopPropagation();
            if (openBlockInfo) openBlockInfo({ type: actualType, props: actualProps });
          }}
          style={{
            width: 26, height: 26, minWidth: 26, minHeight: 26, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            fontSize: 13, display: 'flex', alignItems: 'center',
            justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.35)',
            cursor: 'pointer', flexShrink: 0, fontWeight: 700, lineHeight: 1,
            fontFamily: 'Georgia, serif', fontStyle: 'italic', transition: 'background 0.15s',
            boxSizing: 'border-box', padding: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
        >i</button>
        )}
        {selected && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{
              width: 26, height: 26, minWidth: 26, minHeight: 26, borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff4444, #cc2222)', color: '#fff',
              fontSize: 14, display: 'flex', alignItems: 'center',
              justifyContent: 'center', border: '1.5px solid rgba(255,100,100,0.4)',
              cursor: 'pointer', flexShrink: 0, fontWeight: 700, lineHeight: 1,
              boxSizing: 'border-box', padding: 0,
              boxShadow: '0 2px 6px rgba(255,50,50,0.4)',
            }}>×</button>
        )}
      </div>
    </div>
  );
}

// ─── BLOCK INFO MODAL ─────────────────────────────────────────────────────────
function BlockInfoModal({ block, onClose }) {
  const ctx = React.useContext(BuilderUiContext);
  const lang = ctx?.lang || 'ru';
  const blockTypes = resolveBuilderCatalog(ctx);
  const ui = ctx?.t || getConstructorStrings('ru');

  const type = block?.type;
  const def = getBlockDef(type, blockTypes);
  const addBlock = React.useContext(AddBlockContext);

  React.useEffect(() => {
    if (!def || !type) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, def, type]);

  if (!def || !type) return null;
  const color = def.color;
  const note = blockNoteForLang(lang, type, BLOCK_NOTES[type]);
  const extendedHint = getBeginnerPanelHint(block, {
    omitSuggestedList: true,
    blockTypes,
    ui,
    lang,
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: 12,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-info-title"
    >
      <div
        style={{
          width: '100%', maxWidth: 520, maxHeight: 'min(86vh, 640px)',
          background: 'var(--bg2)', borderRadius: 14,
          border: `1px solid ${color}44`,
          borderTop: `3px solid ${color}`,
          display: 'flex', flexDirection: 'column',
          boxShadow: `0 24px 64px rgba(0,0,0,0.75), 0 0 0 1px ${color}18`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 22 }}>{def.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="block-info-title" style={{ fontSize: 17, fontWeight: 700, color, fontFamily: 'Syne, system-ui' }}>
              {def.label}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Syne, system-ui', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2 }}>
              {def.group}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--bg3)', color: 'var(--text)',
              fontSize: 18, border: '1px solid var(--border2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 18px' }}>
          {note && <BlockNoteBox note={note} compact />}
          {extendedHint && (
            <div style={{
              marginTop: note ? 12 : 0,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(96, 165, 250, 0.08)',
              border: '1px solid rgba(96, 165, 250, 0.22)',
              fontSize: 11,
              lineHeight: 1.55,
              color: 'var(--text2)',
              whiteSpace: 'pre-wrap',
            }}>
              <div style={{
                fontSize: 9, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6, fontWeight: 700,
              }}>{ui.hintLabel}</div>
              {extendedHint}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <CompatibleBlocksHint type={type} color={color} mode="modal" onAdd={addBlock ? (t) => { addBlock(t); onClose(); } : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BLOCK STACK ──────────────────────────────────────────────────────────
/** newBlockDrop: 'valid' | 'invalid' | null — подсветка при перетаскивании блока с палитры */
function BlockStack({ stack, selectedId, attentionBlockId, onSelectBlock, onDeleteBlock, onDragStack, onAddFooterAction, isDragTarget, newBlockDrop, newBlockDropHint }) {
  const ui = React.useContext(BuilderUiContext)?.t || getConstructorStrings('ru');
  const dragStartRef = React.useRef(null);

  const beginStackDragIfMoved = (clientX, clientY) => {
    if (!dragStartRef.current) return false;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    if (Math.abs(dx) <= 3 && Math.abs(dy) <= 3) return false;
    onDragStack(stack.id, { clientX: dragStartRef.current.x, clientY: dragStartRef.current.y });
    dragStartRef.current = null;
    return true;
  };

  const onStackPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button') || e.target.closest('[data-block-shape]')) return;
    e.stopPropagation();
    dragStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    // Do not setPointerCapture here — it steals pointerup from child blocks and breaks click/dblclick.
  };

  const onStackPointerMove = (e) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;
    beginStackDragIfMoved(e.clientX, e.clientY);
  };

  const onStackPointerEnd = (e) => {
    if (dragStartRef.current?.pointerId === e.pointerId) dragStartRef.current = null;
  };

  return (
    <div
      data-block-stack=""
      style={{
        position: 'absolute', left: stack.x, top: stack.y,
        zIndex: stack.dragging ? 1000 : (isDragTarget ? 500 : 1),
        opacity: stack.dragging ? 0.45 : 1,
        touchAction: 'none',
        borderRadius: newBlockDrop ? 10 : 0,
        outline: newBlockDrop === 'invalid'
          ? '2px solid rgba(248,113,113,0.95)'
          : newBlockDrop === 'valid'
            ? '2px solid rgba(56,189,248,0.85)'
            : 'none',
        outlineOffset: 3,
        transition: 'outline 0.12s ease',
      }}
      onTouchStart={e => e.stopPropagation()}
      onPointerDown={onStackPointerDown}
      onPointerMove={onStackPointerMove}
      onPointerUp={onStackPointerEnd}
      onPointerCancel={onStackPointerEnd}
      onPointerLeave={() => { dragStartRef.current = null; }}
    >
      {stack.blocks.map((block, i) => (
        <MemoBlockShape
          key={block.id}
          block={block}
          type={block.type}
          props={block.props}
          isFirst={i === 0}
          selected={selectedId === block.id}
          attention={attentionBlockId === block.id}
          onClick={e => { e.stopPropagation(); onSelectBlock(block.id, stack.id); }}
          onDelete={() => onDeleteBlock(stack.id, block.id)}
          onAddFooterAction={onAddFooterAction}
        />
      ))}

      {/* Drop zone: слияние стека */}
      {isDragTarget && (
        <div style={{
          width: BLOCK_W, height: 12,
          background: 'rgba(80,200,255,0.35)',
          border: '2px dashed rgba(80,200,255,0.75)',
          borderRadius: 4, marginTop: 2,
        }} />
      )}
      {/* Подсказка при перетаскивании нового блока с палитры */}
      {newBlockDrop === 'valid' && (
        <div style={{
          width: BLOCK_W, marginTop: 4,
          padding: '5px 6px',
          borderRadius: 6,
          background: 'rgba(56,189,248,0.12)',
          border: '1px dashed rgba(56,189,248,0.65)',
          fontSize: 9,
          color: '#7dd3fc',
          textAlign: 'center',
          fontWeight: 600,
        }}>{ui.dropAttach}</div>
      )}
      {newBlockDrop === 'invalid' && (
        <div style={{
          width: BLOCK_W, marginTop: 4,
          padding: '6px 8px',
          borderRadius: 6,
          background: 'rgba(239,68,68,0.14)',
          border: '2px dashed rgba(248,113,113,0.85)',
          fontSize: 9,
          color: '#fca5a5',
          textAlign: 'center',
          lineHeight: 1.35,
          fontWeight: 600,
        }}>{newBlockDropHint || ui.dropReject}</div>
      )}
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────

function PaletteEntryDebugPanel({ entry }) {
  const d = entry?._debug;
  if (!d) {
    return (
      <div style={{
        margin: '0 8px 6px',
        padding: '6px 8px',
        fontSize: 9,
        fontFamily: 'ui-monospace, monospace',
        color: 'rgba(251,191,36,0.85)',
        background: 'rgba(251,191,36,0.06)',
        borderRadius: 6,
        border: '1px dashed rgba(251,191,36,0.25)',
      }}>
        no _debug metadata (build in DEV)
      </div>
    );
  }
  const lines = [
    ['id', d.id],
    ['type', d.type],
    ...(d.paletteKind ? [['paletteKind', d.paletteKind]] : []),
    ['raw', d.rawCategory],
    ['normalized', d.normalizedCategory],
    ['final', d.finalCategory],
    ['section', d.section],
    ['dedupe', d.dedupeKey],
    ['movedToFallback', String(d.movedToFallback)],
    ...(d.normalizeReason ? [['normalize', d.normalizeReason]] : []),
    ...(d.mainExtraReason ? [['main_extra', d.mainExtraReason]] : []),
  ];
  return (
    <div style={{
      margin: '0 8px 6px',
      padding: '6px 8px',
      fontSize: 9,
      lineHeight: 1.45,
      fontFamily: 'ui-monospace, monospace',
      color: 'rgba(148,163,184,0.95)',
      background: d.movedToFallback ? 'rgba(249,115,22,0.08)' : 'rgba(99,102,241,0.08)',
      borderRadius: 6,
      border: `1px solid ${d.movedToFallback ? 'rgba(249,115,22,0.35)' : 'rgba(99,102,241,0.25)'}`,
    }}>
      {lines.map(([k, v]) => (
        <div key={k}><span style={{ color: 'rgba(99,102,241,0.9)' }}>{k}</span>: {v}</div>
      ))}
    </div>
  );
}

function Sidebar({ onDragStart, onDragEnd, onTapAdd }) {
  const ctx = React.useContext(BuilderUiContext);
  const paletteDebugAvailable = isPaletteDebugEnabled();
  const [showPaletteDebug, setShowPaletteDebug] = React.useState(false);
  const palette = ctx?.graphPalette ?? [];
  const sidebarSectionOrder = React.useMemo(() => paletteSidebarSectionOrder(), []);
  const { groups, sectionOrder } = React.useMemo(
    () => groupPaletteForSidebar(palette, sidebarSectionOrder),
    [palette, sidebarSectionOrder],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {paletteDebugAvailable && (
        <div style={{
          padding: '6px 8px 4px',
          borderBottom: '1px solid rgba(99,102,241,0.12)',
          flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={() => setShowPaletteDebug((v) => !v)}
            style={{
              width: '100%',
              padding: '5px 8px',
              fontSize: 10,
              fontFamily: 'Syne, system-ui',
              fontWeight: 700,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              borderRadius: 8,
              border: `1px solid ${showPaletteDebug ? 'rgba(249,115,22,0.5)' : 'rgba(99,102,241,0.35)'}`,
              background: showPaletteDebug ? 'rgba(249,115,22,0.12)' : 'rgba(99,102,241,0.1)',
              color: showPaletteDebug ? '#fdba74' : 'rgba(165,180,252,0.95)',
            }}
          >
            Debug Palette {showPaletteDebug ? '▾' : '▸'}
          </button>
        </div>
      )}
    <div style={{ overflowY: 'auto', flex: 1, padding: '6px 6px 14px' }}>
      {sectionOrder.map((gid) => {
        const blocks = groups[gid];
        if (!blocks?.length) return null;
        const header = getPaletteEntryDisplay(blocks[0]).categoryLabel || gid;
        return (
          <div key={gid}>
            <div className="editor-group-header">{header}</div>
            {blocks.map((b) => {
              const display = getPaletteEntryDisplay(b);
              const draggable = isPaletteEntryDraggable(b);
              return (
              <div key={b.id}>
              <div
                draggable={draggable}
                onDragStart={(e) => {
                  if (!draggable) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData('cicada/palette-id', b.id);
                  const el = e.currentTarget;
                  const clone = el.cloneNode(true);
                  clone.style.position = 'absolute';
                  clone.style.top = '-9999px';
                  clone.style.left = '-9999px';
                  clone.style.width = `${el.offsetWidth}px`;
                  document.body.appendChild(clone);
                  e.dataTransfer.setDragImage(clone, 20, 16);
                  requestAnimationFrame(() => document.body.removeChild(clone));
                  onDragStart(b);
                }}
                onDragEnd={() => { onDragEnd && onDragEnd(); }}
                onClick={() => onTapAdd && onTapAdd(b)}
                className="editor-sidebar-block"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 10px',
                  cursor: draggable || onTapAdd ? 'pointer' : 'default',
                  userSelect: 'none',
                  transition: 'background .15s, border-color .15s, transform .15s',
                  borderRadius: 10,
                  margin: '2px 0',
                  background: 'rgba(255,255,255,0.018)',
                  opacity: draggable || onTapAdd ? 1 : 0.72,
                }}
              >
                <span style={{
                  width: 23, height: 23, borderRadius: 7,
                  background: `${display.color}28`, color: display.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, flexShrink: 0,
                  boxShadow: `0 0 12px ${display.color}20`,
                }}>{display.icon}</span>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', flex: 1, fontFamily: 'Syne, system-ui', fontWeight: 650 }}>{b.label}</div>
                {onTapAdd && <span style={{ fontSize: 16, color: 'var(--text3)', opacity: 0.5 }}>+</span>}
              </div>
              {showPaletteDebug && paletteDebugAvailable && (
                <PaletteEntryDebugPanel entry={b} />
              )}
              </div>
            );
            })}
          </div>
        );
      })}
    </div>
    </div>
  );
}

// ─── PROPS PANEL ──────────────────────────────────────────────────────────
/** Единый список блоков проекта для полей «При нажатии», «Сохранить», «Если», «Переход», «Использовать»… */
const PROJECT_BLOCK_PICKER_KINDS = [
  'callback_label',
  'save_key',
  'save_value',
  'condition_cond',
  'goto_target',
  'use_blockname',
  'forward_target',
];

function firstReplyButtonLabelFromRows(rowsStr) {
  const rows = String(rowsStr || '').split('\n');
  for (const row of rows) {
    for (const cell of row.split(',')) {
      const t = cell.trim();
      if (t) return t;
    }
  }
  return '';
}

function firstInlineCallbackFromButtons(buttonsStr) {
  const rows = String(buttonsStr || '').split('\n');
  for (const row of rows) {
    for (const cell of row.split(',')) {
      const pair = cell.trim();
      if (!pair) continue;
      const [title, cb] = pair.split('|').map((x) => x?.trim());
      if (cb) return cb;
      if (title) return title;
    }
  }
  return '';
}

function getStackContextTitle(stack, blockTypes) {
  const blocks = stack?.blocks || [];
  const named = blocks.find((b) => b?.type === 'block')?.props?.name?.trim();
  if (named) return named;
  const root = blocks[0];
  if (!root) return '—';
  const p = root.props || {};
  const def = getBlockDef(root.type, blockTypes);
  const fallback = def?.label || root.type;
  switch (root.type) {
    case 'scenario':
      return p.name?.trim() || fallback;
    case 'command': {
      const c = String(p.cmd || '').replace(/^\//, '').trim();
      return c ? `/${c}` : fallback;
    }
    case 'callback':
      return p.label?.trim() || fallback;
    case 'start':
      return fallback;
    default:
      return fallback;
  }
}

function resolvePickerInsertForKind(kind, targetBlock) {
  if (!targetBlock) return null;
  const t = targetBlock.type;
  const p = targetBlock.props || {};
  switch (kind) {
    case 'callback_label': {
      if (t === 'callback') return (p.label || '').trim() || null;
      if (t === 'buttons') {
        const v = firstReplyButtonLabelFromRows(p.rows);
        return v || null;
      }
      if (t === 'inline') {
        const v = firstInlineCallbackFromButtons(p.buttons);
        return v || null;
      }
      return null;
    }
    case 'save_key': {
      if (['save', 'save_global', 'get', 'get_user', 'db_delete'].includes(t)) {
        const k = (p.key || '').trim();
        return k || null;
      }
      if (t === 'global' || t === 'set_global') {
        const k = (p.varname || '').trim();
        return k || null;
      }
      return null;
    }
    case 'save_value': {
      if (
        t === 'remember' ||
        t === 'ask' ||
        t === 'get' ||
        t === 'get_user' ||
        t === 'http' ||
        t === 'classify' ||
        t === 'database' ||
        t === 'all_keys' ||
        t === 'check_sub' ||
        t === 'member_role' ||
        t === 'call_block'
      ) {
        const v = (p.varname || '').trim();
        return v || null;
      }
      if (t === 'save' || t === 'save_global' || t === 'set_global') {
        const v = (p.value || p.varname || p.key || '').trim();
        return v || null;
      }
      return null;
    }
    case 'condition_cond': {
      if (t === 'condition' || t === 'condition_not') {
        const c = String(p.cond || '').trim().replace(/:?\s*$/, '');
        return c || null;
      }
      const vn = (p.varname || '').trim();
      if (
        vn &&
        ['ask', 'remember', 'get', 'get_user', 'http', 'classify', 'database', 'check_sub', 'member_role', 'role', 'all_keys', 'call_block'].includes(t)
      ) {
        return `не ${vn}`;
      }
      return null;
    }
    case 'goto_target': {
      if (t === 'goto') return (p.target || '').trim() || null;
      if (t === 'scenario' || t === 'step' || t === 'block') return (p.name || '').trim() || null;
      if (t === 'command') return String(p.cmd || '').replace(/^\//, '').trim() || null;
      if (t === 'callback') return (p.label || '').trim() || null;
      return null;
    }
    case 'use_blockname': {
      if (t === 'block') return (p.name || '').trim() || null;
      if (t === 'use' || t === 'call_block') return (p.blockname || '').trim() || null;
      return null;
    }
    case 'forward_target': {
      if (t === 'global' || t === 'set_global') return (p.varname || '').trim() || null;
      if (t === 'notify' || t === 'forward_msg') return (p.target || '').trim() || null;
      if (t === 'member_role') return (p.user_id || '').trim() || null;
      if (
        [
          'ask',
          'remember',
          'get',
          'get_user',
          'http',
          'classify',
          'database',
          'check_sub',
          'role',
          'all_keys',
          'call_block',
        ].includes(t)
      ) {
        return (p.varname || '').trim() || null;
      }
      return null;
    }
    default:
      return null;
  }
}

function getPropsFieldPickerKind(blockType, fieldKey) {
  if (blockType === 'callback' && (fieldKey === 'label' || fieldKey === 'data')) return 'callback_label';
  if ((blockType === 'save' || blockType === 'save_global') && fieldKey === 'key') return 'save_key';
  if ((blockType === 'save' || blockType === 'save_global') && fieldKey === 'value') return 'save_value';
  if (blockType === 'set_global' && (fieldKey === 'varname' || fieldKey === 'value')) return fieldKey === 'varname' ? 'save_key' : 'save_value';
  if ((blockType === 'condition' || blockType === 'condition_not') && fieldKey === 'cond') return 'condition_cond';
  if (blockType === 'goto' && fieldKey === 'target') return 'goto_target';
  if ((blockType === 'use' || blockType === 'call_block') && fieldKey === 'blockname') return 'use_blockname';
  if (blockType === 'forward_msg' && fieldKey === 'target') return 'forward_target';
  if (blockType === 'inline_db' && fieldKey === 'key') return 'save_key';
  if (blockType === 'get' && (fieldKey === 'key' || fieldKey === 'varname')) return fieldKey === 'key' ? 'save_key' : 'save_value';
  if (blockType === 'db_delete' && fieldKey === 'key') return 'save_key';
  if (blockType === 'get_user' && (fieldKey === 'key' || fieldKey === 'varname')) return fieldKey === 'key' ? 'save_key' : 'save_value';
  if (blockType === 'call_block' && fieldKey === 'varname') return 'save_value';
  return null;
}

function collectProjectBlockPickerOptionsByKind(stacks, blockTypes) {
  const map = Object.fromEntries(PROJECT_BLOCK_PICKER_KINDS.map((k) => [k, []]));
  for (const stack of stacks || []) {
    const st = getStackContextTitle(stack, blockTypes);
    for (const b of stack.blocks || []) {
      for (const kind of PROJECT_BLOCK_PICKER_KINDS) {
        const insert = resolvePickerInsertForKind(kind, b);
        if (!insert) continue;
        const def = getBlockDef(b.type, blockTypes);
        const typeLabel = def?.label || b.type;
        const preview = getPreview(b.type, b.props) || '';
        const panelLabel = `${st} — ${typeLabel}: ${preview}`.slice(0, 200);
        map[kind].push({ id: b.id, panelLabel, insert });
      }
    }
  }
  return map;
}

function collectReplyButtonOptions(stacks) {
  const options = [];
  const seen = new Set();
  const addOption = (scope, text) => {
    const value = String(text || '').trim();
    if (!value) return;
    const key = `${scope}::${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ value, label: `${scope} / ${value}` });
  };

  (stacks || []).forEach((stack) => {
    const blockName = stack?.blocks?.find?.((b) => b?.type === 'block')?.props?.name || 'блок';
    (stack?.blocks || []).forEach((b) => {
      if (b?.type === 'buttons') {
        const rows = String(b?.props?.rows || '');
        rows
          .split('\n')
          .flatMap((row) => row.split(','))
          .forEach((text) => addOption(blockName, text));
      }

      if (b?.type === 'inline') {
        const rows = String(b?.props?.buttons || '');
        rows
          .split('\n')
          .flatMap((row) => row.split(','))
          .map((x) => x.trim())
          .filter(Boolean)
          .forEach((pair) => {
            const [title, callback] = pair.split('|').map((x) => x?.trim());
            if (callback) addOption(`${blockName} (inline)`, callback);
            else if (title) addOption(`${blockName} (inline)`, title);
          });
      }
      const attachments = normalizeUiAttachmentsForOwner(b?.uiAttachments, b?.type);
      attachments.buttons.forEach((item) => addOption(`${blockName} (ui buttons)`, item.text));
      attachments.inline.forEach((item) => addOption(`${blockName} (ui inline)`, item.callback || item.text));
    });
  });
  return options;
}

function UiAttachmentAddPanel({ block, onAddAttachment }) {
  const actions = (Array.isArray(block?.ui?.addableActions) && block.ui.addableActions.length)
    ? block.ui.addableActions
    : getBlockFooterAddableActions(block?.type);
  if (!actions.length || !onAddAttachment) return null;
  const proxied = Boolean(block?.ui?.attachmentTargetId && block.ui.attachmentTargetId !== block?.id);
  return (
    <div style={{ marginTop: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 9, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontWeight: 700 }}>
        UI к сообщению
      </div>
      {proxied && (
        <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.45, marginBottom: 8 }}>
          Кнопки добавляются к блоку ответа/сообщения ниже по цепочке, не к «Старт».
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {actions.map((kind) => {
          const meta = BLOCK_FOOTER_ACTION_TYPES[kind];
          if (!meta) return null;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onAddAttachment(kind)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${meta.color}55`,
                background: `${meta.color}18`,
                color: meta.color,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{meta.icon}</span>
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UiAttachmentsPanel({ block, onAttachmentChange, onAttachmentDelete }) {
  const attachments = normalizeUiAttachmentsForOwner(block?.uiAttachments, block?.type);
  const groups = [
    { key: 'buttons', title: 'UI buttons', fields: [{ key: 'text', label: 'текст' }, { key: 'action', label: 'action' }] },
    { key: 'inline', title: 'UI inline', fields: [{ key: 'text', label: 'текст' }, { key: 'callback', label: 'callback' }, { key: 'action', label: 'action' }] },
    { key: 'media', title: 'UI media', fields: [{ key: 'kind', label: 'тип' }, { key: 'url', label: 'url' }, { key: 'caption', label: 'caption' }] },
  ];
  const total = Object.values(attachments).reduce((sum, list) => sum + list.length, 0);
  if (!total) return null;
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 9, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontWeight: 700 }}>
        Кнопки у сообщения ({total})
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.45, marginBottom: 10 }}>
        Эти элементы принадлежат только render action и компилируются рядом с ним.
      </div>
      {groups.map((group) => {
        const list = attachments[group.key] || [];
        if (!list.length) return null;
        return (
          <div key={group.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 700, marginBottom: 6 }}>{group.title}</div>
            {list.map((item) => (
              <div key={item.id} style={{ padding: 8, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, marginBottom: 6, background: 'rgba(255,255,255,0.025)' }}>
                {group.fields.map((field) => (
                  <label key={field.key} style={{ display: 'block', marginBottom: 6 }}>
                    <span style={{ display: 'block', fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>{field.label}</span>
                    <input
                      value={item[field.key] || ''}
                      onChange={(e) => onAttachmentChange(group.key, item.id, { [field.key]: e.target.value })}
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => onAttachmentDelete(group.key, item.id)}
                  style={{ marginTop: 2, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: 10, cursor: 'pointer' }}
                >
                  Удалить attachment
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

const MARKUP_FORMATTING_HELP = {
  ru: {
    title: 'Примеры форматирования',
    commandLabel: 'Команда DSL',
    noteLabel: 'Важно',
    modes: {
      '': {
        name: 'Без разметки',
        command: 'ответ',
        note: 'Текст отправится как есть. Используй этот режим, если в сообщении есть символы разметки, которые не нужно обрабатывать.',
        examples: [
          'Привет, {пользователь.имя}!',
          'Цена: 990 ₽',
        ],
      },
      html: {
        name: 'HTML',
        command: 'ответ_html',
        note: 'Подходят Telegram HTML-теги. Не забывай закрывать теги.',
        examples: [
          '<b>Жирный</b> и <i>курсив</i>',
          '<u>подчёркнутый</u> и <s>зачёркнутый</s>',
          '<code>код</code>',
          '<a href="https://example.com">ссылка</a>',
        ],
      },
      md2: {
        name: 'MarkdownV2',
        command: 'ответ_md2',
        note: 'В MarkdownV2 спецсимволы нужно экранировать обратным слэшем: _ * [ ] ( ) ~ ` > # + - = | { } . !',
        examples: [
          '*Жирный* и _курсив_',
          '__подчёркнутый__ и ~зачёркнутый~',
          '`код`',
          '[ссылка](https://example.com)',
        ],
      },
      markdown_v2: {
        name: 'MarkdownV2',
        command: 'ответ_markdown_v2',
        note: 'Полная форма команды для MarkdownV2. Правила такие же, как у ответ_md2.',
        examples: [
          '*Жирный* и _курсив_',
          '||скрытый текст||',
          '`код`',
          '[ссылка](https://example.com)',
        ],
      },
      md: {
        name: 'Markdown legacy',
        command: 'ответ_md',
        note: 'Старый Telegram Markdown проще, но менее гибкий. Для новых сообщений лучше HTML или MarkdownV2.',
        examples: [
          '*Жирный* и _курсив_',
          '`код`',
          '[ссылка](https://example.com)',
        ],
      },
    },
  },
  en: {
    title: 'Formatting examples',
    commandLabel: 'DSL command',
    noteLabel: 'Note',
    modes: {
      '': {
        name: 'No markup',
        command: 'ответ',
        note: 'The text is sent as-is. Use this when markup characters should stay plain.',
        examples: ['Hi, {user.name}!', 'Price: 990'],
      },
      html: {
        name: 'HTML',
        command: 'ответ_html',
        note: 'Telegram HTML tags are supported. Make sure every tag is closed.',
        examples: ['<b>Bold</b> and <i>italic</i>', '<u>underline</u> and <s>strike</s>', '<code>code</code>', '<a href="https://example.com">link</a>'],
      },
      md2: {
        name: 'MarkdownV2',
        command: 'ответ_md2',
        note: 'Escape MarkdownV2 special characters with a backslash: _ * [ ] ( ) ~ ` > # + - = | { } . !',
        examples: ['*Bold* and _italic_', '__underline__ and ~strike~', '`code`', '[link](https://example.com)'],
      },
      markdown_v2: {
        name: 'MarkdownV2',
        command: 'ответ_markdown_v2',
        note: 'Full MarkdownV2 command form. Same formatting rules as ответ_md2.',
        examples: ['*Bold* and _italic_', '||spoiler||', '`code`', '[link](https://example.com)'],
      },
      md: {
        name: 'Markdown legacy',
        command: 'ответ_md',
        note: 'Legacy Telegram Markdown is simpler but less flexible. Prefer HTML or MarkdownV2 for new messages.',
        examples: ['*Bold* and _italic_', '`code`', '[link](https://example.com)'],
      },
    },
  },
  uk: {
    title: 'Приклади форматування',
    commandLabel: 'DSL-команда',
    noteLabel: 'Важливо',
    modes: {
      '': {
        name: 'Без розмітки',
        command: 'ответ',
        note: 'Текст буде надіслано як є. Використовуй цей режим, якщо символи розмітки мають лишитися звичайним текстом.',
        examples: ['Привіт, {пользователь.имя}!', 'Ціна: 990 ₴'],
      },
      html: {
        name: 'HTML',
        command: 'ответ_html',
        note: 'Підтримуються Telegram HTML-теги. Не забувай закривати теги.',
        examples: ['<b>Жирний</b> і <i>курсив</i>', '<u>підкреслений</u> і <s>закреслений</s>', '<code>код</code>', '<a href="https://example.com">посилання</a>'],
      },
      md2: {
        name: 'MarkdownV2',
        command: 'ответ_md2',
        note: 'У MarkdownV2 спецсимволи потрібно екранувати зворотним слешем: _ * [ ] ( ) ~ ` > # + - = | { } . !',
        examples: ['*Жирний* і _курсив_', '__підкреслений__ і ~закреслений~', '`код`', '[посилання](https://example.com)'],
      },
      markdown_v2: {
        name: 'MarkdownV2',
        command: 'ответ_markdown_v2',
        note: 'Повна форма команди MarkdownV2. Правила такі самі, як у ответ_md2.',
        examples: ['*Жирний* і _курсив_', '||прихований текст||', '`код`', '[посилання](https://example.com)'],
      },
      md: {
        name: 'Markdown legacy',
        command: 'ответ_md',
        note: 'Старий Telegram Markdown простіший, але менш гнучкий. Для нових повідомлень краще HTML або MarkdownV2.',
        examples: ['*Жирний* і _курсив_', '`код`', '[посилання](https://example.com)'],
      },
    },
  },
};

function MarkupFormattingExamples({ markup, lang }) {
  const copy = MARKUP_FORMATTING_HELP[lang] || MARKUP_FORMATTING_HELP.ru;
  const mode = copy.modes[markup] || copy.modes[''];

  return (
    <div style={{
      marginTop: 8,
      padding: '10px 11px',
      borderRadius: 10,
      border: '1px solid rgba(96,165,250,0.22)',
      background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(167,139,250,0.06))',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {copy.title}
        </span>
        <code style={{ fontSize: 10, color: '#67e8f9', background: 'rgba(34,211,238,0.09)', border: '1px solid rgba(34,211,238,0.16)', borderRadius: 6, padding: '2px 6px' }}>
          {mode.command}
        </code>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, marginBottom: 7 }}>
        {mode.name}
      </div>
      <div style={{ display: 'grid', gap: 5, marginBottom: 8 }}>
        {mode.examples.map((example) => (
          <code key={example} style={{
            display: 'block',
            padding: '6px 7px',
            borderRadius: 7,
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: '#dbeafe',
            fontSize: 11,
            lineHeight: 1.35,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {example}
          </code>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.45 }}>
        <span style={{ color: '#fbbf24', fontWeight: 700 }}>{copy.noteLabel}: </span>{mode.note}
      </div>
    </div>
  );
}

async function uploadBotMediaFile(file, projectId = '') {
  const headers = {
    'Content-Type': file.type || 'application/octet-stream',
    'x-file-name': encodeURIComponent(file.name || 'file'),
  };
  if (projectId) headers['x-project-id'] = String(projectId);
  const data = await apiFetch('/api/media-upload', {
    method: 'POST',
    headers,
    body: file,
  });
  if (!data?.fileName || !data?.filePath) throw new Error(data?.error || 'upload_failed');
  return data;
}

function displayMediaValue(value) {
  const s = String(value || '');
  return s.includes('/uploads/media/') || (s.includes('/bots/') && s.includes('/media/')) ? s.split('/').pop() : s;
}

const CANVAS_SELECT_STYLE = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 11,
  borderRadius: 8,
  border: '1px solid rgba(99,102,241,0.5)',
  background: 'var(--bg)',
  color: 'var(--text)',
  cursor: 'pointer',
};

function CallbackLinkSelect({ options, value, onChange, placeholder, emptyHint }) {
  if (!options?.length) {
    return emptyHint ? (
      <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.45 }}>{emptyHint}</div>
    ) : null;
  }
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      style={CANVAS_SELECT_STYLE}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={`${opt.kind || ''}:${opt.label}:${opt.value}`} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function CallbackCanvasBindingPanel({ options, onPick }) {
  if (!options?.length) {
    return (
      <div style={{
        marginBottom: 12,
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 10,
        lineHeight: 1.5,
        color: 'var(--text3)',
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.25)',
      }}>
        На холсте пока нет кнопок для привязки. Добавьте inline к блоку «Фото»/«Ответ» (кнопка Inline в свойствах сообщения), затем снова откройте «При нажатии».
      </div>
    );
  }
  return (
    <div style={{
      marginBottom: 14,
      padding: '10px 12px',
      borderRadius: 8,
      background: 'rgba(99,102,241,0.12)',
      border: '1px solid rgba(99,102,241,0.35)',
    }}>
      <div style={{
        fontSize: 9,
        color: '#a78bfa',
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        marginBottom: 8,
        fontWeight: 700,
      }}>
        Привязка к кнопке на холсте
      </div>
      <select
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          const opt = options.find((o) => o.value === v);
          if (opt) onPick(opt);
          e.target.value = '';
        }}
        style={CANVAS_SELECT_STYLE}
      >
        <option value="">— Выберите кнопку или команду —</option>
        {options.map((opt) => (
          <option key={`bind:${opt.kind}:${opt.value}:${opt.label}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PropsPanel({
  block,
  onChange,
  onKeyboardDataChange,
  onAddAttachment,
  onAttachmentChange,
  onAttachmentDelete,
  graphRefIndex,
  graphDocument,
  onJumpToNode,
  onCreateCallbackHandler,
  stacks,
  projectId = '',
  isProjectMode = false,
  hasActiveProSubscription = false,
}) {
  const ctx = React.useContext(BuilderUiContext);
  const addBlockFromContext = React.useContext(AddBlockContext);
  const filePickerRef = React.useRef(null);
  const onChangeRef = React.useRef(onChange);
  const [pendingUploadField, setPendingUploadField] = React.useState(null);

  // Map picker state (unconditional hooks to respect Rules of Hooks)
  const [mapActive, setMapActive] = React.useState(false);
  const mapContainerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markerRef = React.useRef(null);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const openLocalFilePicker = React.useCallback((fieldKey) => {
    setPendingUploadField(fieldKey);
    if (filePickerRef.current) {
      filePickerRef.current.value = '';
      filePickerRef.current.click();
    }
  }, []);

  const onLocalFilePicked = React.useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !pendingUploadField) return;
    try {
      const uploaded = await uploadBotMediaFile(file, isProjectMode ? projectId : '');
      onChangeRef.current(pendingUploadField, uploaded.filePath);
      if (pendingUploadField === 'url') onChangeRef.current('filename', uploaded.fileName || file.name || '');
    } catch (err) {
      void appAlert({
        title: 'Ошибка загрузки',
        message: 'Не удалось загрузить файл: ' + (err?.message || 'ошибка'),
        variant: 'danger',
      });
    }
  }, [pendingUploadField, isProjectMode, projectId]);
  const lang = ctx?.lang || 'ru';
  const blockTypes = resolveBuilderCatalog(ctx);
  const ui = ctx?.t || getConstructorStrings('ru');
  const pickerByKind = React.useMemo(
    () => collectProjectBlockPickerOptionsByKind(stacks, blockTypes),
    [stacks, blockTypes],
  );
  const callbackButtonRefs = React.useMemo(
    () => listCallbackButtonRefs(graphRefIndex),
    [graphRefIndex],
  );
  const [callbackAdvancedOpen, setCallbackAdvancedOpen] = React.useState(false);
  const boundCallbackRef = React.useMemo(
    () => resolveCallbackBindingRef(graphRefIndex, block?.props || {}, block?.meta),
    [graphRefIndex, block?.props, block?.meta],
  );

  const applyRefBinding = React.useCallback((ref) => {
    if (!ref) return;
    const patch = bindingPatchFromReference(ref);
    Object.entries(patch).forEach(([key, val]) => onChange(key, val));
  }, [onChange]);
  const showMapUi = block?.type === 'location';
  const locationProps = block?.type === 'location' ? (block.props || {}) : null;

  // Must run on every render (before early returns) — otherwise selecting any block crashes React.
  React.useEffect(() => {
    let mounted = true;

    async function ensureLeafletLoaded() {
      if (typeof window === 'undefined') return;
      if (window.L) return;
      if (!document.querySelector('link[data-leaflet]')) {
        const lnk = document.createElement('link');
        lnk.rel = 'stylesheet';
        lnk.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        lnk.setAttribute('data-leaflet', '1');
        document.head.appendChild(lnk);
      }
      if (!document.querySelector('script[data-leaflet]')) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
          s.setAttribute('data-leaflet', '1');
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }
    }

    async function init() {
      if (!mapActive || !showMapUi || mapRef.current || typeof window === 'undefined') return;
      try {
        await ensureLeafletLoaded();
        if (!mounted) return;
        const L = window.L;
        const container = mapContainerRef.current;
        if (!container) return;
        mapRef.current = L.map(container).setView([55.75, 37.62], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapRef.current);

        mapRef.current.on('click', (e) => {
          const lat = e.latlng.lat.toFixed(6);
          const lng = e.latlng.lng.toFixed(6);
          if (onChangeRef.current) {
            onChangeRef.current('lat', lat);
            onChangeRef.current('lon', lng);
          }
          if (markerRef.current) mapRef.current.removeLayer(markerRef.current);
          markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
          mapRef.current.flyTo([lat, lng], 14);
        });

        const lat = locationProps?.latitude || locationProps?.lat || null;
        const lng = locationProps?.longitude || locationProps?.lng || locationProps?.lon || null;
        if (lat && lng) {
          markerRef.current = window.L.marker([lat, lng]).addTo(mapRef.current);
          mapRef.current.setView([lat, lng], 14);
        }
      } catch (err) {
        console.warn('Leaflet load failed', err);
      }
    }
    init();
    return () => {
      mounted = false;
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          markerRef.current = null;
        }
      } catch (e) {}
    };
  }, [mapActive, showMapUi, locationProps?.lat, locationProps?.lon, locationProps?.latitude, locationProps?.longitude, locationProps?.lng]);

  if (!block || !block.type) return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text3)', fontSize: 11, padding: 16, textAlign: 'center',
    }}>
      {ui.propsPickLine1}<br />{ui.propsPickLine2}
    </div>
  );
  const def = getBlockDef(block.type, blockTypes);
  if (!def) {
    console.error('Unknown block type:', block.type, block);
    return null;
  }
  const fields = localizedPropFields(block.type, lang, FIELDS[block.type] || []);
  const props = block.props || {};
  const CustomInspector = hasCustomInspector(block.type) ? resolveNodeInspector(block.type) : null;
  const showLocalUpload = block.type === 'photo' || block.type === 'document' || block.type === 'send_file';
  const uploadFieldKey = block.type === 'send_file' ? 'file' : 'url';
  const mediaStorageNote = isProjectMode
    ? (hasActiveProSubscription ? ui.mediaProjectNote : ui.startServerNeedsPremium)
    : ui.mediaEphemeralNote;

  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>{def?.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: def?.color }}>{def?.label}</span>
      </div>
      {showLocalUpload && (
        <div style={{
          marginBottom: 10, padding: '8px 10px', borderRadius: 8,
          fontSize: 10, lineHeight: 1.45, color: 'rgba(226,232,240,0.82)',
          background: isProjectMode ? 'rgba(62,207,142,0.08)' : 'rgba(251,191,36,0.08)',
          border: `1px solid ${isProjectMode ? 'rgba(62,207,142,0.22)' : 'rgba(251,191,36,0.22)'}`,
        }}>
          {isProjectMode ? `☁ ${ui.projectFilesNote}` : mediaStorageNote}
        </div>
      )}
      {/* Location map picker: show when block has latitude/longitude fields */}
      {showMapUi && (
        <>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 3, textTransform: 'uppercase' }}>Широта (Latitude)</div>
            <input value={props.latitude || props.lat || ''} readOnly />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 3, textTransform: 'uppercase' }}>Долгота (Longitude)</div>
            <input value={props.longitude || props.lng || props.lon || ''} readOnly />
          </div>

          <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={() => setMapActive(v => !v)} style={{ padding: '10px 14px', background: '#ff8c42', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              {mapActive ? 'Закрыть карту' : 'Выбрать на карте'}
            </button>
            <button type="button" onClick={() => {
              if (!navigator.geolocation) {
                void appAlert({ title: 'Геолокация', message: 'Геолокация не поддерживается', variant: 'warning' });
                return;
              }
              navigator.geolocation.getCurrentPosition((pos) => {
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                onChange('lat', lat);
                onChange('lon', lng);
                try {
                  if (markerRef.current) mapRef.current.removeLayer(markerRef.current);
                  markerRef.current = window.L.marker([lat, lng]).addTo(mapRef.current);
                  mapRef.current.flyTo([lat, lng], 14);
                  setMapActive(true);
                } catch (e) {}
              }, (err) => {
                void appAlert({
                  title: 'Геолокация',
                  message: 'Не удалось определить позицию: ' + (err.message || err.code),
                  variant: 'danger',
                });
              });
            }} style={{ padding: '10px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Определить мою позицию
            </button>
          </div>

          <div ref={mapContainerRef} style={{ height: mapActive ? 360 : 0, transition: 'height .2s', overflow: 'hidden', borderRadius: 8, marginBottom: 8 }} />
        </>
      )}
      {CustomInspector && (
        <CustomInspector
          block={block}
          nodeType={block.type}
          onDataChange={onKeyboardDataChange}
          graphRefIndex={graphRefIndex}
          graphDocument={graphDocument}
          onJumpToNode={onJumpToNode}
          onCreateCallbackHandler={onCreateCallbackHandler}
          lang={lang}
        />
      )}
      {block.type === 'callback' && (
        <SmartGraphRefPicker
          title="Выберите кнопку"
          refs={callbackButtonRefs}
          selectedRefId={boundCallbackRef?.id || props._graphRefId || ''}
          selectedCompileValue={props.data || props.label || ''}
          onSelect={applyRefBinding}
          onJumpToNode={onJumpToNode}
          onCreateNew={onCreateCallbackHandler}
          createLabel="Создать обработчик"
          emptyHint="Сначала добавьте inline-кнопки к блоку «Фото» или «Ответ» на холсте (кнопка Inline в свойствах сообщения)."
        />
      )}
      {block.type === 'callback' && (
        <button
          type="button"
          onClick={() => setCallbackAdvancedOpen((v) => !v)}
          style={{
            marginBottom: 10,
            padding: '4px 8px',
            fontSize: 9,
            border: 'none',
            background: 'transparent',
            color: 'var(--text3)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {callbackAdvancedOpen ? 'Скрыть доп. поля' : 'Дополнительные поля…'}
        </button>
      )}
      {fields.map(f => {
        if (CustomInspector) return null;
        if (showMapUi && (f.key === 'lat' || f.key === 'lon' || f.key === 'latitude' || f.key === 'longitude')) return null;
        const smartCfg = getSmartRefFieldConfig(block.type, f.key);
        if (block.type === 'callback' && smartCfg?.hideRaw && !callbackAdvancedOpen
          && ['data', 'label', 'callbackPrefix'].includes(f.key)) {
          return null;
        }
        const pickerKind = getPropsFieldPickerKind(block.type, f.key);
        const pickerOptions = pickerKind ? pickerByKind[pickerKind] : [];
        const pickerListId = pickerOptions.length > 0 ? `props-picker-${block.id || block.type}-${f.key}` : undefined;
        const smartRefs = smartCfg
          ? getRefsByCategories(graphRefIndex, smartCfg.categories)
          : [];

        return (
        <div key={f.key} style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: 9, color: 'var(--text3)', marginBottom: 3,
            textTransform: 'uppercase', letterSpacing: '.08em',
          }}>{(smartCfg?.label || f.label).split('\n')[0]}</div>
          {smartRefs.length > 0 && f.tag !== 'textarea' && f.tag !== 'select' ? (
            <SmartGraphRefPicker
              refs={smartRefs}
              selectedCompileValue={props[f.key] || ''}
              onSelect={(ref) => onChange(f.key, ref.compileValue)}
              onJumpToNode={onJumpToNode}
              allowManual
              manualValue={props[f.key] || ''}
              onManualChange={(val) => onChange(f.key, val)}
              manualPlaceholder="Или введите вручную…"
            />
          ) : null}
          {f.tag === 'textarea' ? (
            <textarea
              rows={f.rows || 3}
              value={props[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder || ''}
              style={{ resize: 'vertical', lineHeight: 1.5 }}
            />
          ) : f.tag === 'select' ? (
            <>
              <select
                value={props[f.key] || f.options?.[0]?.value || ''}
                onChange={e => onChange(f.key, e.target.value)}
              >
                {(f.options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {block.type === 'message' && f.key === 'markup' && (
                <MarkupFormattingExamples markup={props[f.key] || ''} lang={lang} />
              )}
            </>
          ) : smartRefs.length > 0 ? null : (
            <>
              <input
                list={pickerListId}
                value={showLocalUpload && f.key === uploadFieldKey ? displayMediaValue(props[f.key]) : (props[f.key] || '')}
                onChange={e => onChange(f.key, e.target.value)}
              />
              {showLocalUpload && f.key === uploadFieldKey && (
                <button
                  type="button"
                  onClick={() => openLocalFilePicker(uploadFieldKey)}
                  style={{ marginTop: 6, width: '100%', fontSize: 11, border: '1px dashed var(--border2)', borderRadius: 6, padding: '7px 10px', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer' }}
                >
                  Загрузить с устройства
                </button>
              )}
              {pickerListId && (
                <datalist id={pickerListId}>
                  {pickerOptions.map((opt) => (
                    <option
                      key={`${pickerKind}:${opt.id}:${opt.insert}`}
                      value={opt.insert}
                      label={opt.panelLabel}
                    />
                  ))}
                </datalist>
              )}
            </>
          )}
        </div>
        );
      })}
      <input
        ref={filePickerRef}
        type="file"
        accept={block.type === 'photo' ? 'image/*' : '*/*'}
        onChange={onLocalFilePicked}
        style={{ display: 'none' }}
      />
      {fields.length === 0 && !CustomInspector && (
        <>
          <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: addBlockFromContext ? 10 : 0 }}>
            {ui.noSettings}
          </div>
          {addBlockFromContext && (
            <CompatibleBlocksHint
              type={block.type}
              color={def?.color || '#60a5fa'}
              mode="modal"
              onAdd={(t) => addBlockFromContext(t)}
            />
          )}
        </>
      )}
      {!CustomInspector && (
        <>
          <UiAttachmentAddPanel block={block} onAddAttachment={onAddAttachment} />
          <UiAttachmentsPanel
            block={block}
            onAttachmentChange={onAttachmentChange}
            onAttachmentDelete={onAttachmentDelete}
          />
        </>
      )}
    </div>
  );
}

const MemoBlockShape = React.memo(BlockShape);
const MemoBlockStack = React.memo(BlockStack);
const MemoSidebar = React.memo(Sidebar);
const MemoPropsPanel = React.memo(PropsPanel);

export {
  AddBlockContext,
  BlockInfoContext,
  BuilderUiContext,
  CAN_STACK_BELOW,
  UI_ATTACHMENT_LEGACY_BLOCK_TYPES,
  BLOCK_FOOTER_ACTION_TYPES,
  BLOCK_W,
  BLOCK_H,
  ROOT_H,
  MOBILE_TOP_BAR_H,
  MOBILE_BOTTOM_NAV_H,
  DEFAULT_PROPS,
  FIELDS,
  uid,
  resetUidSequence,
  syncUidSequenceFromGraph,
  normalizeStudioBlockNode,
  normalizeStudioStacks,
  normalizeUiAttachments,
  normalizeUiAttachmentsForOwner,
  createStudioBlockNode,
  countUiAttachments,
  defaultUiAttachment,
  legacyBlockToUiAttachment,
  addUiAttachment,
  canStackBelow,
  getStackBlocksHeight,
  getBlockTopInStack,
  findNewBlockSnapTarget,
  snapAttachRejectHint,
  getSuggestedNextBlockLabels,
  flattenBlocks,
  hasBlockOfType,
  normalizeCommandName,
  hasCommandNamed,
  getNextAvailableCommandName,
  getUniqueBlockConflictMessage,
  resolveBotTokenForNewBlock,
  inferPropsFromParent,
  getBlockDef,
  getPreview,
  normalizeAiPartialResponse,
  BlockNoteBox,
  CompatibleBlocksHint,
  BlockTooltip,
  AiDiagnosticSection,
  BlockInfoModal,
  MemoBlockShape as BlockShape,
  MemoBlockStack as BlockStack,
  MemoSidebar as Sidebar,
  UiAttachmentsPanel,
  MarkupFormattingExamples,
  MemoPropsPanel as PropsPanel,
};
