/**
 * UX-facing graph / compile / connection error normalization (RU-first, EN fallback).
 * Internal codes stay in logs only — UI never shows raw GRAPH_* / VALIDATION_* strings.
 */

import { getBuilderBlockTypes } from '../constructor/block_catalog.js';
import { graphResolveNodeType } from '../app/graph/graphHelpers.js';
import { softenProductError } from '../copy/productCopy.js';

const TYPE_LABEL_RU = Object.freeze({
  message: 'Ответ', reply: 'Ответ', inline: 'Inline-кнопки', buttons: 'Кнопки',
  start: 'Старт', command: 'Команда', callback: 'При нажатии', bot: 'Бот',
  version: 'Версия', global: 'Глобальная', commands: 'Команды меню',
  condition: 'Условие', loop: 'Цикл', photo: 'Фото', video: 'Видео',
});

const TYPE_LABEL_EN = Object.freeze({
  message: 'Reply', reply: 'Reply', inline: 'Inline buttons', buttons: 'Buttons',
  start: 'Start', command: 'Command', callback: 'On click', bot: 'Bot',
  version: 'Version', global: 'Global', commands: 'Menu commands',
  condition: 'Condition', loop: 'Loop', photo: 'Photo', video: 'Video',
});

/** @typedef {'error'|'warning'|'info'} GraphErrorSeverity */
/** @typedef {'jump'|'remove_edge'|'repair_callbacks'|'reset_graph'|'show_all_nodes'} GraphErrorAction */

/**
 * @param {string} blockType
 * @param {string} lang
 */
export function blockTypeLabel(blockType, lang = 'ru') {
  const t = String(blockType || '').trim();
  if (!t) return lang === 'en' ? 'step' : 'шаг';
  const catalog = getBuilderBlockTypes(lang);
  const row = catalog.find((b) => b.type === t);
  if (row?.label) return row.label;
  const map = lang === 'en' ? TYPE_LABEL_EN : TYPE_LABEL_RU;
  return map[t] || t;
}

function decodeCallbackLabel(callbackData) {
  const raw = String(callbackData || '').trim();
  if (!raw) return '';
  if (raw.startsWith('callback_')) {
    const rest = raw.slice('callback_'.length);
    if (/^[0-9a-f]+$/i.test(rest) && rest.length >= 4 && rest.length % 2 === 0) {
      try {
        const bytes = rest.match(/.{2}/g).map((p) => parseInt(p, 16));
        const decoded = new TextDecoder().decode(new Uint8Array(bytes));
        if (decoded && !/[\x00-\x08\x0e-\x1f]/.test(decoded)) return decoded;
      } catch { /* ignore */ }
    }
    if (rest) return rest;
  }
  return raw;
}

function tpl(str, ctx) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '');
}

/**
 * @param {GraphErrorSeverity} severity
 * @param {string} code
 * @param {{ title: object, cause: object, fix: object, actions?: GraphErrorAction[] }} def
 */
function def(severity, code, { title, cause, fix, actions = ['jump'] }) {
  return { severity, code, title, cause, fix, actions };
}

const CATALOG = Object.freeze({
  OUTPUT_AS_ROOT: def('error', 'OUTPUT_AS_ROOT', {
    title: { ru: '«{blockLabel}» не в сценарии', en: '«{blockLabel}» is outside the flow' },
    cause: { ru: 'У блока нет цепочки от точки входа.', en: 'This block is not reached from an entry point.' },
    fix: { ru: 'Проведите линию от «Старт», «Команда» или «При нажатии». «Бот» — только токен.', en: 'Connect from Start, Command, or On click. Bot is token-only.' },
  }),
  KEYBOARD_AS_ROOT: def('error', 'KEYBOARD_AS_ROOT', {
    title: { ru: 'Кнопки без сообщения', en: 'Buttons without a message' },
    cause: { ru: 'Клавиатура стоит отдельно от ответа.', en: 'Keyboard is not under a reply block.' },
    fix: { ru: 'Сначала «Ответ» или медиа, затем кнопки сразу под ним.', en: 'Add Reply or media first, then buttons below.' },
  }),
  KeyboardWithoutOutputNode: def('error', 'KeyboardWithoutOutputNode', {
    title: { ru: 'Кнопки не привязаны к тексту', en: 'Buttons not tied to text' },
    cause: { ru: 'Нет блока с текстом над кнопками.', en: 'No message block above the keyboard.' },
    fix: { ru: 'Добавьте «Ответ» / «Фото» выше кнопок в той же цепочке.', en: 'Place Reply / Photo above buttons in the same chain.' },
  }),
  MissingCallbackHandlerError: def('error', 'MissingCallbackHandlerError', {
    title: { ru: 'Нет реакции на «{callbackLabel}»', en: 'No handler for «{callbackLabel}»' },
    cause: { ru: 'Кнопка есть, блок «При нажатии» с тем же callback — нет.', en: 'Button exists but no On click with matching callback.' },
    fix: { ru: 'Добавьте «При нажатии» с тем же data → затем «Ответ».', en: 'Add On click with same callback data → then Reply.' },
    actions: ['jump', 'repair_callbacks'],
  }),
  missing_handlers: def('error', 'missing_handlers', {
    title: { ru: 'У кнопки «{callbackLabel}» нет действия при нажатии', en: 'Button «{callbackLabel}» has no action' },
    cause: { ru: 'Inline-кнопка без блока «При нажатии».', en: 'Inline button without On click handler.' },
    fix: { ru: 'Нажмите «Создать обработчик» или добавьте «При нажатии» с тем же callback.', en: 'Create handler or add On click with the same callback.' },
    actions: ['jump', 'repair_callbacks'],
  }),
  BUTTON_NO_ACTION: def('warning', 'BUTTON_NO_ACTION', {
    title: { ru: 'У кнопки «{callbackLabel}» нет действия при нажатии', en: 'Button «{callbackLabel}» has no action' },
    cause: { ru: 'Кнопка не связана с обработчиком в сценарии.', en: 'Button is not linked to a handler in the flow.' },
    fix: { ru: 'Создайте обработчик из панели свойств кнопки.', en: 'Create a handler from the button properties panel.' },
    actions: ['jump', 'repair_callbacks'],
  }),
  CALLBACK_HANDLER_DISCONNECTED: def('error', 'CALLBACK_HANDLER_DISCONNECTED', {
    title: { ru: '«При нажатии» без ответа', en: 'On click has no follow-up' },
    cause: { ru: 'После нажатия нет действия в цепочке.', en: 'Nothing happens after the button press in the flow.' },
    fix: { ru: 'Подключите «Ответ» или другое действие линией ниже.', en: 'Connect Reply or another action below.' },
  }),
  broken_callback_route: def('error', 'broken_callback_route', {
    title: { ru: 'Сломан маршрут кнопки', en: 'Broken button route' },
    cause: { ru: 'Обработчик callback не доведён до ответа.', en: 'Callback handler does not lead to a reply.' },
    fix: { ru: 'Добавьте «Ответ» после «При нажатии».', en: 'Add Reply after On click.' },
    actions: ['jump', 'repair_callbacks'],
  }),
  NO_ENTRYPOINT: def('error', 'NO_ENTRYPOINT', {
    title: { ru: 'Нет точки входа', en: 'No entry point' },
    cause: { ru: 'Нет «Старт», «Команда» или «При нажатии».', en: 'Missing Start, Command, or On click.' },
    fix: { ru: 'Добавьте «Старт» для /start или «Команда».', en: 'Add Start for /start or a Command block.' },
  }),
  FSM_AS_ROOT: def('error', 'FSM_AS_ROOT', {
    title: { ru: '«{blockLabel}» не может быть первым', en: '«{blockLabel}» cannot be first' },
    cause: { ru: 'Сценарий/шаг не может начинать бота.', en: 'Scenario/step cannot start the bot.' },
    fix: { ru: 'Поставьте после «Старт» или «Команда».', en: 'Place after Start or Command.' },
  }),
  CONTROL_AS_ROOT: def('error', 'CONTROL_AS_ROOT', {
    title: { ru: '«{blockLabel}» не может быть первым', en: '«{blockLabel}» cannot be first' },
    cause: { ru: 'Условие/цикл не может быть корнем.', en: 'Condition/loop cannot be the root.' },
    fix: { ru: 'Добавьте «Старт» выше, затем условие.', en: 'Add Start above, then the condition.' },
  }),
  API_AS_ROOT: def('error', 'API_AS_ROOT', {
    title: { ru: '«{blockLabel}» не может быть первым', en: '«{blockLabel}» cannot be first' },
    cause: { ru: 'HTTP/БД только внутри сценария.', en: 'HTTP/DB only inside a handler flow.' },
    fix: { ru: 'После «Старт» добавьте «Ответ», затем запрос.', en: 'After Start add Reply, then the request.' },
  }),
  CROSS_HANDLER_EDGE: def('error', 'CROSS_HANDLER_EDGE', {
    title: { ru: 'Две точки входа подряд', en: 'Two entry points in a row' },
    cause: { ru: '«Старт» и «Команда» соединены напрямую.', en: 'Start and Command linked directly.' },
    fix: { ru: 'Между ними — блоки сценария (Ответ и т.д.).', en: 'Put scenario blocks between them.' },
  }),
  NESTED_ENTRYPOINT: def('error', 'NESTED_ENTRYPOINT', {
    title: { ru: 'Вложенная точка входа', en: 'Nested entry point' },
    cause: { ru: 'Вторая точка входа внутри той же ветки.', en: 'Second entry inside the same branch.' },
    fix: { ru: 'Вынесите «Команда» / «При нажатии» в отдельную ветку.', en: 'Use a separate branch per entry.' },
  }),
  orphan_node: def('error', 'orphan_node', {
    title: { ru: '«{blockLabel}» не соединён', en: '«{blockLabel}» is disconnected' },
    cause: { ru: 'Блок не связан с «Старт» и другими.', en: 'Block is not linked to Start or the flow.' },
    fix: { ru: 'Проведите линию от «Старт» или удалите блок.', en: 'Connect from Start or delete the block.' },
  }),
  dangling_entry: def('error', 'dangling_entry', {
    title: { ru: '«{blockLabel}» без входа', en: '«{blockLabel}» has no incoming link' },
    cause: { ru: 'Нет линии от предыдущего блока.', en: 'No line from the previous block.' },
    fix: { ru: 'Подключите сверху: точка входа → ответ → этот блок.', en: 'Connect from above: entry → reply → this block.' },
  }),
  unreachable_node: def('warning', 'unreachable_node', {
    title: { ru: 'До «{blockLabel}» не дойти', en: 'Cannot reach «{blockLabel}»' },
    cause: { ru: 'Блок вне цепочки от «Старт».', en: 'Block is off the path from Start.' },
    fix: { ru: 'Соедините с «Старт» или удалите.', en: 'Link to Start or remove.' },
  }),
  dangling_edge: def('error', 'dangling_edge', {
    title: { ru: 'Битая связь', en: 'Broken connection' },
    cause: { ru: 'Линия ведёт в удалённый или несуществующий блок ({sourceLabel} → {targetLabel}).', en: 'Line points to a missing block ({sourceLabel} → {targetLabel}).' },
    fix: { ru: 'Удалите красную линию или восстановите блоки на концах.', en: 'Delete the red edge or restore both blocks.' },
    actions: ['jump', 'remove_edge'],
  }),
  hydration_orphan_edges: def('error', 'hydration_orphan_edges', {
    title: { ru: 'Остались битые связи', en: 'Stale broken connections' },
    cause: { ru: 'В сценарии сохранились связи без шагов.', en: 'Saved flow has connections without steps.' },
    fix: { ru: 'Нажмите «Удалить битые связи» или «Сбросить сценарий».', en: 'Use Remove broken connections or Reset flow.' },
    actions: ['remove_edge', 'reset_graph'],
  }),
  duplicate_edge: def('error', 'duplicate_edge', {
    title: { ru: 'Связь уже есть', en: 'Connection already exists' },
    cause: { ru: 'Такая же линия между этими блоками уже проведена.', en: 'The same link already exists.' },
    fix: { ru: 'Используйте существующую связь или удалите дубликат.', en: 'Use the existing link or remove the duplicate.' },
  }),
  self_connection: def('error', 'self_connection', {
    title: { ru: 'Нельзя соединить блок с собой', en: 'Cannot link block to itself' },
    cause: { ru: 'Линия выходит и входит в один блок.', en: 'Edge starts and ends on the same block.' },
    fix: { ru: 'Соедините с другим блоком.', en: 'Connect to a different block.' },
  }),
  cyclic_loop: def('error', 'cyclic_loop', {
    title: { ru: 'Цикл в сценарии', en: 'Loop in scenario' },
    cause: { ru: 'Связи образуют замкнутый круг — бот может зациклиться.', en: 'Edges form a cycle — the bot may loop forever.' },
    fix: { ru: 'Разорвите кольцо: у «Условие»/«Цикл» должен быть выход «нет» или «готово».', en: 'Break the ring: add FALSE or DONE branch.' },
  }),
  dead_end_branch: def('warning', 'dead_end_branch', {
    title: { ru: '«{blockLabel}»: нет ветки', en: '«{blockLabel}»: missing branch' },
    cause: { ru: 'У условия/цикла не заполнена обязательная ветка.', en: 'Required branch port is empty.' },
    fix: { ru: 'Добавьте блок на порт TRUE/FALSE, BODY или DONE.', en: 'Add a block on TRUE/FALSE, BODY, or DONE.' },
  }),
  dead_end_chain: def('warning', 'dead_end_chain', {
    title: { ru: '«{blockLabel}» обрывается', en: '«{blockLabel}» is a dead end' },
    cause: { ru: 'После блока нет продолжения сценария.', en: 'Nothing follows this block.' },
    fix: { ru: 'Добавьте следующий блок или «Переход».', en: 'Add the next block or a Goto.' },
  }),
  missing_successor: def('warning', 'missing_successor', {
    title: { ru: '«Спросить» без продолжения', en: 'Ask has no continuation' },
    cause: { ru: 'После ответа пользователя некуда идти.', en: 'No path after user reply.' },
    fix: { ru: 'Соедините «Спросить» с «При нажатии» или «Ответ».', en: 'Connect Ask to On click or Reply.' },
  }),
  incompatible_connection: def('error', 'incompatible_connection', {
    title: { ru: 'Нельзя соединить «{sourceLabel}» → «{targetLabel}»', en: 'Cannot connect «{sourceLabel}» → «{targetLabel}»' },
    cause: { ru: 'Типы блоков или порты не совместимы.', en: 'Block types or ports are incompatible.' },
    fix: { ru: 'Соединяйте выход снизу блока со входом сверху следующего по сценарию.', en: 'Link bottom output to top input of the next scenario block.' },
  }),
  CONDITION_BRANCH_REQUIRED: def('error', 'CONDITION_BRANCH_REQUIRED', {
    title: { ru: 'У блока «Условие» нужна ветка', en: 'Condition needs a branch' },
    cause: {
      ru: 'Нельзя вести линию с общего выхода — только с порта «Да» (TRUE) или «Нет» (FALSE).',
      en: 'Use the Yes (TRUE) or No (FALSE) port on the condition block, not a generic flow exit.',
    },
    fix: {
      ru: 'Подключите «Ответ» (или медиа) к выходу Да или Нет снизу блока «Условие».',
      en: 'Connect Reply (or media) to the Yes or No exit below the Condition block.',
    },
  }),
  invalid_target_type: def('error', 'invalid_target_type', {
    title: { ru: 'Сюда нельзя подключить', en: 'Cannot connect here' },
    cause: { ru: '«{targetLabel}» не принимает входящую линию.', en: '«{targetLabel}» does not accept incoming flow.' },
    fix: { ru: 'Подключайте к «Ответ», «Условие» и т.п., не к «Бот» / «Старт» как к входу.', en: 'Connect to Reply, Condition, etc., not Bot/Start as input.' },
  }),
  invalid_source_type: def('error', 'invalid_source_type', {
    title: { ru: 'Отсюда нельзя вести линию', en: 'Cannot connect from here' },
    cause: { ru: '«{sourceLabel}» не отдаёт исходящий поток.', en: '«{sourceLabel}» has no outgoing flow.' },
    fix: { ru: 'Ведите линию от «Старт», «Ответ», «Условие» (ветка), не от «Бот».', en: 'Connect from Start, Reply, or Condition branch.' },
  }),
  invalid_node_props: def('error', 'invalid_node_props', {
    title: { ru: 'Заполните «{blockLabel}»', en: 'Fill in «{blockLabel}»' },
    cause: { ru: 'Не хватает обязательного поля в свойствах.', en: 'A required property is missing.' },
    fix: { ru: 'Откройте свойства справа и заполните подсвеченные поля.', en: 'Open properties and fill required fields.' },
  }),
  PROPOSED_INSERTION_FAILED: def('error', 'PROPOSED_INSERTION_FAILED', {
    title: { ru: 'Блок нельзя вставить сюда', en: 'Cannot insert block here' },
    cause: { ru: 'Такое место в цепочке ломает правила сценария.', en: 'This position breaks scenario rules.' },
    fix: { ru: 'Вставьте после «Старт» / «Ответ» или в отдельную ветку.', en: 'Insert after Start / Reply or on a separate branch.' },
  }),
  CONNECTION_INCOMPATIBLE: def('error', 'CONNECTION_INCOMPATIBLE', {
    title: { ru: 'Соединение запрещено', en: 'Connection not allowed' },
    cause: { ru: '{causeDetail}', en: '{causeDetail}' },
    fix: { ru: '{fixDetail}', en: '{fixDetail}' },
  }),
  CONNECTION_DUPLICATE: def('error', 'CONNECTION_DUPLICATE', {
    title: { ru: 'Связь уже существует', en: 'Link already exists' },
    cause: { ru: 'Между этими блоками уже проведена линия.', en: 'These blocks are already connected.' },
    fix: { ru: 'Используйте текущую связь.', en: 'Use the existing connection.' },
  }),
  CONNECTION_SELF_LOOP: def('error', 'CONNECTION_SELF_LOOP', {
    title: { ru: 'Нельзя вести линию в себя', en: 'Cannot link to self' },
    cause: { ru: 'Блок нельзя соединить сам с собой.', en: 'A block cannot connect to itself.' },
    fix: { ru: 'Выберите другой блок.', en: 'Pick another block.' },
  }),
  CONNECTION_MISSING_NODE: def('error', 'CONNECTION_MISSING_NODE', {
    title: { ru: 'Блок не найден', en: 'Block not found' },
    cause: { ru: 'Один из концов связи удалён.', en: 'One end of the link was deleted.' },
    fix: { ru: 'Удалите битую линию и соедините заново.', en: 'Remove the broken line and reconnect.' },
    actions: ['remove_edge'],
  }),
  CONNECTION_MAX_OUTPUTS: def('error', 'CONNECTION_MAX_OUTPUTS', {
    title: { ru: 'Слишком много исходящих линий', en: 'Too many outgoing links' },
    cause: { ru: 'У этого выхода уже максимум связей.', en: 'This output already has the maximum links.' },
    fix: { ru: 'Удалите лишнюю линию или используйте другой порт (TRUE/FALSE).', en: 'Remove an extra link or use another port (TRUE/FALSE).' },
  }),
  IR_VALIDATION: def('error', 'IR_VALIDATION', {
    title: { ru: 'Сценарий не собран', en: 'Scenario structure invalid' },
    cause: { ru: 'Цепочка блоков не сходится в исполняемый сценарий.', en: 'Block chain does not form a runnable scenario.' },
    fix: { ru: 'Проверьте: Старт → Ответ → кнопки; все ветки условий заполнены.', en: 'Check: Start → Reply → buttons; fill all condition branches.' },
  }),
  GRAPH_IR_VALIDATION: def('error', 'GRAPH_IR_VALIDATION', {
    title: { ru: 'Сценарий нельзя сохранить', en: 'Flow cannot be saved' },
    cause: { ru: 'Внутренняя структура сценария невалидна.', en: 'Internal scenario structure is invalid.' },
    fix: { ru: 'Исправьте связи и точки входа (см. подсветку на холсте).', en: 'Fix links and entry points (see canvas highlights).' },
  }),
  GRAPH_COMPILE_GATE: def('error', 'GRAPH_COMPILE_GATE', {
    title: { ru: 'Схема не готова к запуску', en: 'Schema not ready to run' },
    cause: { ru: 'Есть блокирующие ошибки на холсте.', en: 'Blocking errors remain on the canvas.' },
    fix: { ru: 'Откройте проверку сценария и исправьте пункты с красной меткой.', en: 'Open flow review and fix red items.' },
  }),
  GRAPH_VALIDATION: def('error', 'GRAPH_VALIDATION', {
    title: { ru: 'Ошибка проверки схемы', en: 'Schema validation failed' },
    cause: { ru: 'Схема не прошла внутреннюю проверку.', en: 'Schema failed internal validation.' },
    fix: { ru: 'Проверьте связи и обязательные поля блоков.', en: 'Check links and required block fields.' },
  }),
  schema_mismatch: def('error', 'schema_mismatch', {
    title: { ru: 'Устаревший формат проекта', en: 'Outdated project format' },
    cause: { ru: 'Файл или автосохранение повреждено.', en: 'File or autosave is corrupted.' },
    fix: { ru: 'Сбросьте сценарий или загрузите пример заново.', en: 'Reset your flow or reload an example.' },
    actions: ['reset_graph'],
  }),
  registry_semantic: def('error', 'registry_semantic', {
    title: { ru: 'Недопустимая операция', en: 'Invalid operation' },
    cause: { ru: 'Действие нарушает правила редактора.', en: 'Action violates editor rules.' },
    fix: { ru: 'Отмените последний шаг (Ctrl+Z) и повторите.', en: 'Undo (Ctrl+Z) and try again.' },
  }),
  import_failed: def('error', 'import_failed', {
    title: { ru: 'Не удалось загрузить схему', en: 'Failed to load schema' },
    cause: { ru: 'Файл повреждён или несовместим.', en: 'File is corrupt or incompatible.' },
    fix: { ru: 'Очистите холст или выберите другой проект.', en: 'Clear canvas or pick another project.' },
    actions: ['reset_graph'],
  }),
  runtime_dispatch_failed: def('error', 'runtime_dispatch_failed', {
    title: { ru: 'Не удалось применить изменение', en: 'Could not apply change' },
    cause: { ru: 'Редактор отклонил операцию.', en: 'The editor rejected the operation.' },
    fix: { ru: 'Обновите страницу. Если повторится — сбросьте сценарий.', en: 'Refresh the page. If it persists, reset your flow.' },
  }),
  revision_conflict: def('warning', 'revision_conflict', {
    title: { ru: 'Конфликт версии схемы', en: 'Schema version conflict' },
    cause: { ru: 'Изменение устарело относительно холста.', en: 'Change is stale relative to the canvas.' },
    fix: { ru: 'Повторите действие.', en: 'Repeat the action.' },
  }),
  UNKNOWN: def('error', 'UNKNOWN', {
    title: { ru: 'Нужно поправить схему', en: 'Schema needs fixes' },
    cause: { ru: 'Обнаружена проблема в связях или блоках.', en: 'A problem was found in links or blocks.' },
    fix: { ru: 'Цепочка: Старт → Ответ → кнопки. Нажмите «Проверить».', en: 'Chain: Start → Reply → buttons. Press «Check».' },
  }),
});

/** Strip developer noise from strings shown in UI. */
export function sanitizeRawErrorText(text) {
  let s = String(text || '').trim();
  if (!s) return '';
  if (/^\s*at\s+/m.test(s) || s.includes('node:internal')) return '';
  s = s.replace(/\[(strict)\]\s*/gi, '');
  s = s.replace(/^(GRAPH_|IR_|VALIDATION_|CODEGEN_)[A-Z0-9_]+\s*:?\s*/i, '');
  s = s.replace(/\bedge_[a-zA-Z0-9_-]+:\s*/g, '');
  s = s.replace(/\bm_[a-zA-Z0-9_-]+:\s*/g, '');
  s = s.replace(/\bNode\s+([a-zA-Z0-9_-]+)\s+\(/g, 'Шаг «$1» (');
  s = s.replace(/\bnode\s+([a-zA-Z0-9_-]+)\b/gi, 'шаг');
  s = s.replace(/\bgraph\b/gi, 'сценарий');
  s = s.replace(/\bedge\b/gi, 'связь');
  return s.trim();
}

/**
 * @param {string} [code]
 * @param {string} [message]
 * @param {string} [reason]
 */
export function inferGraphErrorCode(code, message, reason) {
  const c = String(code || '').trim();
  if (c && c !== 'IR_VALIDATION' && c !== 'validation_error' && !c.startsWith('Error')) return c;
  const m = `${message || ''} ${reason || ''}`;
  if (/OUTPUT_AS_ROOT|Ответ\/медиа требуют/i.test(m)) return 'OUTPUT_AS_ROOT';
  if (/KEYBOARD_AS_ROOT|Клавиатура без handler/i.test(m)) return 'KEYBOARD_AS_ROOT';
  if (/KeyboardWithoutOutputNode|не привязана к блоку ответа/i.test(m)) return 'KeyboardWithoutOutputNode';
  if (/MissingCallbackHandler|missing_handlers|Нет handler для callback/i.test(m)) return 'MissingCallbackHandlerError';
  if (/CALLBACK_HANDLER_DISCONNECTED|без тела handler/i.test(m)) return 'CALLBACK_HANDLER_DISCONNECTED';
  if (/NO_ENTRYPOINT|Нужен хотя бы один handler/i.test(m)) return 'NO_ENTRYPOINT';
  if (/FSM_AS_ROOT|FSM-блок/i.test(m)) return 'FSM_AS_ROOT';
  if (/CONTROL_AS_ROOT|Управление потоком/i.test(m)) return 'CONTROL_AS_ROOT';
  if (/API_AS_ROOT|API\/DB/i.test(m)) return 'API_AS_ROOT';
  if (/CROSS_HANDLER|entry→entry/i.test(m)) return 'CROSS_HANDLER_EDGE';
  if (/NESTED_ENTRYPOINT|Второй entrypoint/i.test(m)) return 'NESTED_ENTRYPOINT';
  if (/orphan_node|not connected to the flow|fully disconnected/i.test(m)) return 'orphan_node';
  if (/unreachable_node|not reachable from any entry/i.test(m)) return 'unreachable_node';
  if (/dangling_entry|no incoming flow edge/i.test(m)) return 'dangling_entry';
  if (/dangling_edge|invalid edge|Preserved.*dangling|invalidReason/i.test(m)) return 'dangling_edge';
  if (/hydration_orphan/i.test(m)) return 'hydration_orphan_edges';
  if (/duplicate edge|Connection already exists|already exists/i.test(m)) return 'duplicate_edge';
  if (/self-loop|Self-loops/i.test(m)) return 'self_connection';
  if (/Cycle detected|cyclic_loop/i.test(m)) return 'cyclic_loop';
  if (/dead-end branch|no TRUE branch|no FALSE branch|no BODY|no DONE/i.test(m)) return 'dead_end_branch';
  if (/dead-end chain|dead end/i.test(m)) return 'dead_end_chain';
  if (/proposed insertion|Validation failed for proposed/i.test(m)) return 'PROPOSED_INSERTION_FAILED';
  if (/GRAPH_IR_VALIDATION/i.test(m)) return 'GRAPH_IR_VALIDATION';
  if (/GRAPH_COMPILE_GATE|compile blocked/i.test(m)) return 'GRAPH_COMPILE_GATE';
  if (/GRAPH_VALIDATION/i.test(m)) return 'GRAPH_VALIDATION';
  if (/schema_mismatch/i.test(m)) return 'schema_mismatch';
  if (/Revision conflict/i.test(m)) return 'revision_conflict';
  if (/Unknown source node|Unknown target node/i.test(m)) return 'CONNECTION_INCOMPATIBLE';
  if (/terminal node has no outputs/i.test(m)) return 'invalid_source_type';
  if (/settings nodes do not accept/i.test(m)) return 'invalid_target_type';
  if (/CONDITION_BRANCH|requires TRUE or FALSE|ветк/i.test(m)) return 'CONDITION_BRANCH_REQUIRED';
  if (/cannot be connected to/i.test(m)) return 'incompatible_connection';
  if (/does not exist/i.test(m)) return 'CONNECTION_MISSING_NODE';
  if (/output .* already has/i.test(m)) return 'CONNECTION_MAX_OUTPUTS';
  if (/import|Persisted graph|Unsupported persisted/i.test(m)) return 'import_failed';
  return c || 'UNKNOWN';
}

function resolveLabels(raw, graphDocument, lang) {
  const nodeId = raw.nodeId || raw.blockId || null;
  const edgeId = raw.edgeId || null;
  let blockType = String(raw.blockType || '').trim();
  if ((!blockType || blockType === 'inline') && nodeId && graphDocument?.nodes) {
    const n = graphDocument.nodes[nodeId];
    if (n) blockType = graphResolveNodeType(n);
  }
  let sourceLabel = '';
  let targetLabel = '';
  if (edgeId && graphDocument?.edges?.[edgeId]) {
    const e = graphDocument.edges[edgeId];
    sourceLabel = blockTypeLabel(graphResolveNodeType(graphDocument.nodes[e.source]), lang);
    targetLabel = blockTypeLabel(graphResolveNodeType(graphDocument.nodes[e.target]), lang);
  } else if (raw.source && graphDocument?.nodes?.[raw.source]) {
    sourceLabel = blockTypeLabel(graphResolveNodeType(graphDocument.nodes[raw.source]), lang);
  }
  if (raw.target && graphDocument?.nodes?.[raw.target]) {
    targetLabel = blockTypeLabel(graphResolveNodeType(graphDocument.nodes[raw.target]), lang);
  }
  let callbackLabel = '';
  const cbMatch = String(raw.message || '').match(/callback_data «([^»]+)»/i)
    || String(raw.message || '').match(/callback_data "([^"]+)"/i);
  if (cbMatch) callbackLabel = decodeCallbackLabel(cbMatch[1]);
  else if (raw.callbackData) callbackLabel = decodeCallbackLabel(raw.callbackData);

  return {
    blockLabel: blockTypeLabel(blockType, lang),
    blockType,
    sourceLabel: sourceLabel || (lang === 'en' ? 'source' : 'источник'),
    targetLabel: targetLabel || (lang === 'en' ? 'target' : 'цель'),
    callbackLabel: callbackLabel || (lang === 'en' ? 'button' : 'кнопка'),
  };
}

function connectionReasonToUx(reason, lang, labels) {
  const r = String(reason || '');
  const { sourceLabel, targetLabel, blockLabel } = labels;
  if (/terminal node has no outputs/i.test(r)) {
    return {
      code: 'invalid_source_type',
      causeDetail: lang === 'en' ? `«${sourceLabel}» cannot send flow further.` : `«${sourceLabel}» не передаёт поток дальше.`,
      fixDetail: lang === 'en' ? 'Connect from Start, Reply, or a condition branch.' : 'Ведите линию от «Старт», «Ответ» или ветки условия.',
    };
  }
  if (/settings nodes do not accept/i.test(r)) {
    return {
      code: 'invalid_target_type',
      causeDetail: lang === 'en' ? `«${targetLabel}» is settings-only (Bot, Version).` : `«${targetLabel}» — настройки (Бот, Версия), не шаг сценария.`,
      fixDetail: lang === 'en' ? 'Do not connect into Bot — use Bot token field only.' : 'Не подключайте к «Бот» — только токен в свойствах.',
    };
  }
  if (/condition requires TRUE or FALSE|CONDITION_BRANCH/i.test(r)) {
    return {
      code: 'CONDITION_BRANCH_REQUIRED',
      causeDetail: lang === 'en'
        ? 'Condition blocks only expose Yes (TRUE) and No (FALSE) exits.'
        : 'У «Условие» только выходы «Да» (TRUE) и «Нет» (FALSE).',
      fixDetail: lang === 'en'
        ? 'Connect Reply or media to the Yes or No port below the condition.'
        : 'Подключите «Ответ» к выходу Да или Нет снизу блока «Условие».',
    };
  }
  if (/condition cannot be connected to message/i.test(r)) {
    return {
      code: 'CONDITION_BRANCH_REQUIRED',
      causeDetail: lang === 'en'
        ? 'A plain flow link from Condition to Reply is not allowed.'
        : 'Нельзя соединять «Условие» с «Ответ» без выбора ветки.',
      fixDetail: lang === 'en'
        ? 'Use the Yes branch for the positive path and No for the negative path.'
        : 'Ветка «Да» — если условие выполняется, «Нет» — иначе. Подключите «Ответ» к нужному выходу.',
    };
  }
  if (/cannot be connected to/i.test(r)) {
    const m = r.match(/(\w+)\s+cannot be connected to\s+(\w+)/i);
    if (m?.[1] === 'condition' && m?.[2] === 'message') {
      return {
        code: 'CONDITION_BRANCH_REQUIRED',
        causeDetail: lang === 'en'
          ? 'Condition must branch before Reply.'
          : 'После «Условие» нужна ветка Да или Нет.',
        fixDetail: lang === 'en'
          ? 'Connect Reply to the TRUE or FALSE port on the condition block.'
          : 'Подключите «Ответ» к выходу Да (TRUE) или Нет (FALSE) блока «Условие».',
      };
    }
    return {
      code: 'incompatible_connection',
      causeDetail: lang === 'en'
        ? `«${blockTypeLabel(m?.[1], lang)}» and «${blockTypeLabel(m?.[2], lang)}» cannot be adjacent.`
        : `«${blockTypeLabel(m?.[1], lang)}» и «${blockTypeLabel(m?.[2], lang)}» нельзя соединять напрямую.`,
      fixDetail: lang === 'en'
        ? 'Typical order: Start → Reply → Buttons. Commands cannot follow Condition.'
        : 'Обычный порядок: Старт → Ответ → Кнопки. «Команда» не после «Условие».',
    };
  }
  if (/Connection already exists/i.test(r)) return { code: 'CONNECTION_DUPLICATE', causeDetail: '', fixDetail: '' };
  if (/Self-loops/i.test(r)) return { code: 'CONNECTION_SELF_LOOP', causeDetail: '', fixDetail: '' };
  if (/does not exist/i.test(r)) return { code: 'CONNECTION_MISSING_NODE', causeDetail: '', fixDetail: '' };
  if (/already has \d+ edge/i.test(r)) return { code: 'CONNECTION_MAX_OUTPUTS', causeDetail: '', fixDetail: '' };
  return {
    code: 'CONNECTION_INCOMPATIBLE',
    causeDetail: sanitizeRawErrorText(r) || (lang === 'en' ? 'These blocks cannot connect.' : 'Эти блоки нельзя соединить.'),
    fixDetail: lang === 'en' ? 'Follow Start → Reply → next step.' : 'Соблюдайте порядок: Старт → Ответ → следующий шаг.',
  };
}

/**
 * Normalize any graph/compile/runtime error for UI.
 * @param {object|string} raw
 * @param {{ lang?: string, graphDocument?: object, sourceType?: string, targetType?: string }} [options]
 */
export function normalizeGraphError(raw, options = {}) {
  const lang = options.lang === 'en' ? 'en' : 'ru';
  const graphDocument = options.graphDocument;

  if (typeof raw === 'string') {
    raw = { message: raw };
  }

  const rawMessage = sanitizeRawErrorText(raw.message || raw.error || raw.reason || '');
  const code = inferGraphErrorCode(raw.code || raw.reasonCode, rawMessage, raw.reason);
  const labels = resolveLabels(raw, graphDocument, lang);
  let entry = CATALOG[code] || CATALOG.UNKNOWN;

  const CALLBACK_SOFT_CODES = new Set([
    'missing_handlers',
    'MissingCallbackHandlerError',
    'broken_callback_route',
    'invalid_callbacks',
    'CALLBACK_HANDLER_DISCONNECTED',
  ]);
  if (CALLBACK_SOFT_CODES.has(code) && raw.severity === 'warning') {
    entry = {
      ...entry,
      severity: 'warning',
      fix: {
        ru: 'Нажмите «Создать обработчик» или добавьте блок «При нажатии» с тем же callback.',
        en: 'Click «Create handler» or add On click with the same callback.',
      },
      actions: ['repair_callbacks'],
    };
  }

  if (code === 'CONNECTION_INCOMPATIBLE' || code === 'CONDITION_BRANCH_REQUIRED' || raw.reason) {
    const conn = connectionReasonToUx(raw.reason || rawMessage, lang, {
      ...labels,
      blockLabel: blockTypeLabel(options.sourceType, lang) || labels.blockLabel,
    });
    if (conn.code && CATALOG[conn.code]) entry = CATALOG[conn.code];
    labels.causeDetail = conn.causeDetail;
    labels.fixDetail = conn.fixDetail;
  }

  const locale = (key) => tpl(entry[key]?.[lang] || entry[key]?.ru || '', labels);

  return softenProductError({
    code: entry.code,
    severity: raw.severity || entry.severity || 'error',
    title: locale('title'),
    cause: locale('cause'),
    fix: locale('fix'),
    hint: locale('fix'),
    nodeId: raw.nodeId || raw.blockId || null,
    edgeId: raw.edgeId || raw._edgeId || null,
    blockType: labels.blockType,
    _edgeId: raw.edgeId || null,
    actions: [...(entry.actions || ['jump'])],
    _internal: import.meta.env?.DEV ? { rawMessage, rawCode: raw.code } : undefined,
  }, lang);
}

/**
 * @param {string} reason
 * @param {{ lang?: string, graphDocument?: object, sourceType?: string, targetType?: string, source?: string, target?: string }} [options]
 */
export function normalizeConnectionError(reason, options = {}) {
  return normalizeGraphError({
    reason,
    source: options.source,
    target: options.target,
    blockType: options.sourceType,
  }, options);
}

/**
 * @param {object[]} items
 * @param {{ lang?: string, graphDocument?: object }} [options]
 */
export function groupGraphErrorsForDisplay(items, options = {}) {
  if (!Array.isArray(items) || !items.length) return [];

  const normalized = items.map((e) => normalizeGraphError(e, options));
  const structuralOrphans = normalized.filter((e) => (
    e.code === 'dangling_entry' || e.code === 'orphan_node' || e.code === 'OUTPUT_AS_ROOT'
  ));
  if (structuralOrphans.length >= 8) {
    const lang = options.lang || 'ru';
    const count = structuralOrphans.length;
    return [{
      code: 'corrupt_graph_shell',
      severity: 'error',
      title: lang === 'en' ? 'Many steps are disconnected' : 'Много несвязанных шагов',
      cause: lang === 'en'
        ? 'The flow has no Start/Command entry or valid links between steps.'
        : 'В сценарии нет «Старт»/«Команда» или рабочих связей между шагами.',
      fix: lang === 'en'
        ? 'Reset the flow, pick an example, or connect: Start → Reply → buttons.'
        : 'Сбросьте сценарий, выберите пример или соберите цепочку: Старт → Ответ → кнопки.',
      hint: lang === 'en'
        ? 'Reset the flow, pick an example, or connect: Start → Reply → buttons.'
        : 'Сбросьте сценарий, выберите пример или соберите цепочку: Старт → Ответ → кнопки.',
      count,
      nodeIds: structuralOrphans.flatMap((e) => (e.nodeId ? [e.nodeId] : [])).slice(0, 24),
      edgeIds: [],
      actions: ['reset_graph', 'show_all_nodes'],
    }];
  }

  const grouped = new Map();

  for (const item of normalized) {
    const key = `${item.severity}|${item.code}|${item.title}|${item.fix}`;
    const prev = grouped.get(key);
    if (!prev) {
      grouped.set(key, {
        ...item,
        count: 1,
        nodeIds: item.nodeId ? [item.nodeId] : [],
        edgeIds: item._edgeId ? [item._edgeId] : [],
      });
    } else {
      prev.count += 1;
      if (item.nodeId && !prev.nodeIds.includes(item.nodeId)) prev.nodeIds.push(item.nodeId);
      if (item._edgeId && !prev.edgeIds.includes(item._edgeId)) prev.edgeIds.push(item._edgeId);
    }
  }

  const order = { error: 0, warning: 1, info: 2 };
  return [...grouped.values()].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}

/**
 * @param {object[]} diagnostics — pipeline diagnostics
 * @param {{ lang?: string, graphDocument?: object }} [options]
 */
export function formatDiagnosticsForUser(diagnostics, options = {}) {
  return (diagnostics || [])
    .filter((d) => d.severity === 'error' || d.severity === 'warning')
    .map((d) => normalizeGraphError({
      code: d.code,
      message: d.message,
      severity: d.severity,
      nodeId: d.nodeId,
      edgeId: d.edgeId,
      callbackData: d.callbackData,
    }, options));
}

/**
 * @param {object[]} displayErrors — grouped normalize output
 */
export function graphErrorsToClipboardText(displayErrors) {
  if (!displayErrors?.length) return '';
  return displayErrors
    .map((err) => {
      const head = `${err.title}${err.count > 1 ? ` (${err.count})` : ''}`;
      const body = [err.cause, err.fix].filter(Boolean).join('\n');
      return body ? `${head}\n${body}` : head;
    })
    .join('\n\n');
}

/** @deprecated use normalizeGraphError — compile bridge */
export function formatCompileError(err, options = {}) {
  const n = normalizeGraphError(err, options);
  return { ...n, hint: n.fix };
}

/** @deprecated use groupGraphErrorsForDisplay */
export function formatCompileErrorsForDisplay(errors, options = {}) {
  return groupGraphErrorsForDisplay(errors, options);
}

/** @deprecated */
export function compileErrorsToClipboardText(displayErrors) {
  return graphErrorsToClipboardText(displayErrors);
}
