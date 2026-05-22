/**
 * Builder block catalog — single pipeline: blockRegistry → localized catalog → graphPalette.
 * UI metadata (FIELDS, notes) stays in BuilderComponents; types/defaults/stack rules live here.
 */

import {
  BLOCK_STACK_COMPATIBILITY,
  canStackBlockBelow,
  getBlockDefaultProps,
  getPaletteBlockTypes,
  getCompatibleBlockTypes,
} from '../../core/blockRegistry.js';
import { localizeBlockTypes, RU_GROUP_TO_ID } from '../builderI18n.js';
import { getPaletteEntryDisplay } from './graph_document/palette_core.js';

export {
  BLOCK_STACK_COMPATIBILITY,
  canStackBlockBelow,
  getCompatibleBlockTypes,
  getPaletteBlockTypes,
};

/** @deprecated use BLOCK_STACK_COMPATIBILITY */
export const CAN_STACK_BELOW = BLOCK_STACK_COMPATIBILITY;

/** Studio UI defaults (merged on top of registry `constraints.defaults`). */
const BUILDER_UI_DEFAULT_PROPS = Object.freeze({
  version: { version: '1.0' },
  bot: { token: '' },
  commands: { commands: '/start - Главное меню\n/help - Помощь' },
  global: { varname: 'переменная', value: 'значение' },
  block: { name: 'мой_блок' },
  use: { blockname: 'мой_блок' },
  middleware: { type: 'before' },
  start: {},
  on_photo: {},
  on_voice: {},
  on_document: {},
  on_sticker: {},
  on_location: {},
  on_contact: {},
  message: { text: 'Привет, {пользователь.имя}!', markup: '' },
  buttons: { rows: 'Кнопка 1, Кнопка 2' },
  command: { cmd: 'start' },
  callback: { label: '', data: '' },
  condition: { cond: 'текст == "да"' },
  condition_not: { cond: 'текст == "да"' },
  switch: { varname: 'текст', cases: 'да\nнет' },
  ask: { question: 'Как вас зовут?', varname: 'имя' },
  remember: { varname: 'счёт', value: '0' },
  get: { key: 'посещений', varname: 'счётчик' },
  save: { key: 'посещений', value: 'счётчик' },
  scenario: { name: 'регистрация' },
  random: { variants: 'Привет!\nЗдорово!\nДаров!' },
  loop: { mode: 'count', count: '3', cond: 'счёт > 0', var: 'элемент', collection: 'список', seconds: '5' },
  menu: { title: 'Меню', items: 'Пункт 1\nПункт 2' },
  photo: { url: '', caption: '' },
  video: { url: '', caption: '' },
  audio: { url: '' },
  document: { url: '', filename: 'file.pdf' },
  send_file: { file: '{сохранённый_файл}' },
  sticker: { file_id: '' },
  contact: { phone: '', first_name: '', last_name: '' },
  location: { lat: '', lon: '' },
  poll: { question: 'Ваш выбор?', options: 'Вариант 1\nВариант 2', type: 'regular' },
  delay: { seconds: '2' },
  typing: { seconds: '1' },
  http: { method: 'GET', url: 'https://api.example.com/data', varname: 'результат', body: '', jsonVar: '', isJson: 'false' },
  goto: { target: 'сценарий' },
  stop: {},
  step: { name: 'шаг1', text: 'Следующий шаг' },
  inline: { buttons: 'Да|callback_да, Нет|callback_нет' },
  inline_db: { key: 'категории', labelField: 'name', callbackPrefix: 'category:', backText: '⬅️ Назад', backCallback: 'назад', columns: '1' },
  notify: { text: 'Ваш заказ готов!', target: 'user_id' },
  database: { query: 'SELECT * FROM users', varname: 'результат' },
  classify: { intents: 'заказ\nжалоба\nвопрос', varname: 'намерение' },
  log: { message: '...', level: 'info' },
  role: { roles: 'admin\nuser', varname: 'роль' },
  payment: { provider: 'stripe', amount: '9.99', currency: 'USD', title: 'Подписка' },
  analytics: { event: 'purchase' },
  check_sub: { channel: '@mychannel', varname: 'подписан' },
  member_role: { channel: '@mychannel', user_id: 'пользователь.id', varname: 'роль_участника' },
  forward_msg: { mode: 'message', target: 'ADMIN_ID', caption: '' },
  broadcast: { mode: 'all', text: 'Привет всем!', tag: '' },
  db_delete: { key: 'мой_ключ' },
  save_global: { key: 'global_key', value: 'значение' },
  set_global: { varname: 'товары', value: 'добавить(товары, значение)' },
  get_user: { user_id: 'target_id', key: 'профиль_имя', varname: 'имя' },
  all_keys: { varname: 'ключи' },
  call_block: { blockname: 'мой_блок', varname: 'результат' },
});

let cachedDefaultProps = null;

/** Clear cached defaults after palette/registry hot reload (dev). */
export function invalidateDefaultPropsCache() {
  cachedDefaultProps = null;
}

/** @returns {Record<string, object>} */
export function buildDefaultPropsMap() {
  if (import.meta.env?.DEV) cachedDefaultProps = null;
  if (cachedDefaultProps) return cachedDefaultProps;
  const map = {};
  for (const row of getPaletteBlockTypes()) {
    map[row.type] = {
      ...getBlockDefaultProps(row.type),
      ...(BUILDER_UI_DEFAULT_PROPS[row.type] || {}),
    };
  }
  cachedDefaultProps = Object.freeze(map);
  return cachedDefaultProps;
}

/** Единый источник дефолтов блоков для UI (BuilderComponents re-exports). */
export const DEFAULT_PROPS = buildDefaultPropsMap();

/** @param {string} [lang] */
export function buildLocalizedBlockCatalog(lang = 'ru') {
  return localizeBlockTypes(getPaletteBlockTypes(), lang);
}

/**
 * @deprecated use buildLocalizedBlockCatalog — kept for imports that expect BLOCK_TYPES name
 */
export function getBuilderBlockTypes(lang = 'ru') {
  return buildLocalizedBlockCatalog(lang);
}

/** @param {string} type @param {ReadonlyArray} [catalog] */
export function getBlockDef(type, catalog) {
  const list = catalog || getPaletteBlockTypes();
  return list.find((b) => b.type === type) || null;
}

/** @param {ReadonlyArray} palette graphPalette */
export function nodeEntriesFromPalette(palette) {
  return (palette || []).filter((e) => e.type === 'node');
}

/** @param {object} entry PaletteEntryV2 */
export function catalogRowFromPaletteEntry(entry) {
  const display = getPaletteEntryDisplay(entry);
  const blockType = entry.defaultNodeType || String(entry.id || '').replace(/^node:/, '');
  return {
    type: blockType,
    label: entry.label || blockType,
    icon: display.icon,
    color: display.color,
    group: entry.meta?.categoryLabel || display.categoryLabel || entry.category,
    groupId: entry.category,
    canBeRoot: entry.meta?.canBeRoot ?? true,
    canStack: entry.meta?.canStack ?? true,
  };
}

/** @param {ReadonlyArray} palette */
export function buildCatalogFromPalette(palette) {
  return nodeEntriesFromPalette(palette).map(catalogRowFromPaletteEntry);
}

/**
 * Resolve catalog rows for UI (palette-first, registry fallback).
 * @param {{ graphPalette?: ReadonlyArray, blockTypes?: ReadonlyArray, lang?: string }} ctx
 */
export function resolveBuilderCatalog(ctx = {}) {
  if (ctx.graphPalette?.length) {
    return buildCatalogFromPalette(ctx.graphPalette);
  }
  if (ctx.blockTypes?.length) {
    return ctx.blockTypes;
  }
  return buildLocalizedBlockCatalog(ctx.lang || 'ru');
}

/** @param {ReadonlyArray} palette @param {string} blockType */
export function findPaletteEntryForBlockType(palette, blockType) {
  const t = String(blockType || '').trim();
  return (palette || []).find(
    (e) => e.type === 'node' && e.defaultNodeType === t,
  ) || null;
}

/** @param {string} type @param {ReadonlyArray} [catalog] */
export function getGroupIdForBlockType(type, catalog) {
  const def = getBlockDef(type, catalog);
  if (!def) return 'main';
  return def.groupId || RU_GROUP_TO_ID[def.group] || def.group || 'main';
}
