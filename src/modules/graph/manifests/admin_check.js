/**
 * Graph module: admin gate by Telegram ID (admin_by_id).
 */
import { mergeModuleColumns, moduleHandlerColumn } from '../helpers.js';

const graph = mergeModuleColumns(0, [
  moduleHandlerColumn(1, [
    { id: 'n_global_admin', type: 'global', props: { varname: 'ADMIN_ID', value: '123456789' } },
  ], 20),
  moduleHandlerColumn(2, [
    { id: 'n_start', type: 'start' },
    {
      id: 'n_welcome',
      type: 'message',
      props: { text: '👋 Добро пожаловать!', markup: 'reply' },
    },
    {
      id: 'n_menu_kb',
      type: 'buttons',
      props: {
        rows: '⚙️ Панель управления|mod_admin:panel\n📊 Статистика|mod_admin:stats\n🏠 Главное меню|mod_admin:home',
      },
    },
    {
      id: 'n_admin_check',
      type: 'condition',
      props: { cond: 'пользователь.id == ADMIN_ID' },
    },
    {
      id: 'n_admin_ok',
      type: 'message',
      props: { text: '👑 Добро пожаловать, администратор!' },
    },
    { id: 'n_else', type: 'else' },
    {
      id: 'n_denied',
      type: 'message',
      props: { text: '🚫 Доступ запрещён' },
    },
    { id: 'n_stop_denied', type: 'stop' },
  ]),
  moduleHandlerColumn(3, [
    { id: 'n_cb_panel', type: 'callback', props: { data: 'mod_admin:panel', label: 'Панель' } },
    { id: 'n_panel_msg', type: 'message', props: { text: '⚙️ Вы в панели управления' } },
  ]),
  moduleHandlerColumn(4, [
    { id: 'n_cb_stats', type: 'callback', props: { data: 'mod_admin:stats', label: 'Статистика' } },
    {
      id: 'n_stats_msg',
      type: 'message',
      props: { text: '📊 Статистика: пользователи, активность, конверсии' },
    },
  ]),
  moduleHandlerColumn(5, [
    { id: 'n_cb_home', type: 'callback', props: { data: 'mod_admin:home', label: 'Главное' } },
    { id: 'n_home_msg', type: 'message', props: { text: '🏠 Главное меню администратора' } },
  ]),
]);

/** @type {import('../../composition/types.js').GraphModuleManifest} */
export const adminCheckManifest = {
  id: 'admin_by_id',
  version: 2,
  name: 'Проверка админа по ID',
  category: '🔐 Доступ и авторизация',
  dependencies: [],
  capabilities: ['admin_gate', 'admin_menu'],
  globals: ['ADMIN_ID'],
  callbacks: ['mod_admin:panel', 'mod_admin:stats', 'mod_admin:home'],
  commands: [],
  mergeStrategy: {
    dedupeBot: true,
    dedupeStart: true,
    mergeGlobals: 'first_wins',
    mergeMenus: true,
    placement: 'foundation',
  },
  graph,
  exports: { startNodeId: 'n_start', botNodeId: 'n_bot' },
  imports: [],
};
