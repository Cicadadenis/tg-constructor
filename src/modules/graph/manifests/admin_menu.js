/**
 * Graph module: admin panel menu (admin_menu).
 */
import { moduleFlow, moduleHandlerColumn } from '../helpers.js';

const col = moduleHandlerColumn(1, [
  {
    id: 'n_admin_menu_start',
    type: 'condition',
    props: { cond: 'пользователь.id == ADMIN_ID' },
  },
  {
    id: 'n_admin_panel',
    type: 'message',
    props: { text: '👑 Панель администратора' },
  },
  {
    id: 'n_admin_inline',
    type: 'inline',
    props: {
      buttons:
        '👥 Пользователи|mod_menu:users\n📊 Статистика|mod_menu:stats\n📢 Рассылка|mod_menu:broadcast\n⚙️ Настройки|mod_menu:settings',
    },
  },
  {
    id: 'n_user_welcome',
    type: 'message',
    props: { text: '👋 Привет, {пользователь.имя}!' },
  },
  {
    id: 'n_user_kb',
    type: 'buttons',
    props: { rows: '📋 Меню|mod_menu:user_menu\n❓ Помощь|mod_menu:help' },
  },
]);

const handlers = [
  moduleHandlerColumn(2, [
    { id: 'n_cb_users', type: 'callback', props: { data: 'mod_menu:users', label: 'Пользователи' } },
    { id: 'n_users_msg', type: 'message', props: { text: '👥 Управление пользователями' } },
  ]),
  moduleHandlerColumn(3, [
    { id: 'n_cb_stats', type: 'callback', props: { data: 'mod_menu:stats', label: 'Статистика' } },
    { id: 'n_stats_msg', type: 'message', props: { text: '📊 Статистика бота' } },
  ]),
  moduleHandlerColumn(4, [
    { id: 'n_cb_broadcast', type: 'callback', props: { data: 'mod_menu:broadcast', label: 'Рассылка' } },
    { id: 'n_broadcast_hint', type: 'message', props: { text: '📢 Раздел рассылки (см. модуль broadcast)' } },
  ]),
];

const graph = moduleFlow(
  [col, ...handlers].flatMap((c) => c.nodes),
  [col, ...handlers].flatMap((c) => c.edges),
);

/** @type {import('../../composition/types.js').GraphModuleManifest} */
export const adminMenuManifest = {
  id: 'admin_menu',
  version: 2,
  name: 'Меню для админа',
  category: '📋 Меню и навигация',
  dependencies: ['admin_by_id'],
  capabilities: ['admin_menu', 'inline_menu'],
  globals: ['ADMIN_ID'],
  callbacks: [
    'mod_menu:users',
    'mod_menu:stats',
    'mod_menu:broadcast',
    'mod_menu:settings',
    'mod_menu:user_menu',
    'mod_menu:help',
  ],
  commands: [],
  mergeStrategy: {
    dedupeBot: true,
    dedupeStart: true,
    mergeGlobals: 'reuse',
    mergeMenus: true,
    placement: 'fragment',
  },
  graph,
  exports: { menuInlineNodeId: 'n_admin_inline' },
  imports: ['ADMIN_ID'],
};
