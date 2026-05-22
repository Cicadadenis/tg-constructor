/**
 * Graph module: broadcast to all users (broadcast_all).
 */
import { moduleFlow, moduleHandlerColumn } from '../helpers.js';

const col1 = moduleHandlerColumn(1, [
  { id: 'n_cb_broadcast', type: 'callback', props: { data: 'mod_broadcast:open', label: 'Рассылка' } },
  {
    id: 'n_admin_gate',
    type: 'condition',
    props: { cond: 'пользователь.id == ADMIN_ID' },
  },
  { id: 'n_denied', type: 'message', props: { text: '⛔ Нет доступа' } },
  { id: 'n_stop_denied', type: 'stop' },
  {
    id: 'n_ask_text',
    type: 'ask',
    props: { question: '✍️ Введите текст рассылки:', varname: 'текст_рассылки' },
  },
  {
    id: 'n_do_broadcast',
    type: 'message',
    props: { text: '📢 Рассылка всем: {текст_рассылки}' },
  },
  {
    id: 'n_done',
    type: 'message',
    props: { text: '✅ Рассылка отправлена всем пользователям!' },
  },
]);

const col2 = moduleHandlerColumn(2, [
  { id: 'n_cb_vip', type: 'callback', props: { data: 'mod_broadcast:vip', label: 'VIP' } },
  {
    id: 'n_admin_gate_vip',
    type: 'condition',
    props: { cond: 'пользователь.id == ADMIN_ID' },
  },
  { id: 'n_denied_vip', type: 'message', props: { text: '⛔ Нет доступа' } },
  { id: 'n_stop_vip', type: 'stop' },
  {
    id: 'n_ask_vip',
    type: 'ask',
    props: { question: '✍️ Введите текст для VIP-рассылки:', varname: 'текст_рассылки' },
  },
  {
    id: 'n_do_vip',
    type: 'message',
    props: { text: '👑 VIP-рассылка: {текст_рассылки}' },
  },
  { id: 'n_done_vip', type: 'message', props: { text: '✅ VIP-рассылка отправлена!' } },
]);

const graph = moduleFlow(
  [...col1.nodes, ...col2.nodes],
  [...col1.edges, ...col2.edges],
);

/** @type {import('../../composition/types.js').GraphModuleManifest} */
export const broadcastAllManifest = {
  id: 'broadcast_all',
  version: 2,
  name: 'Рассылка всем пользователям',
  category: '📢 Уведомления и рассылка',
  dependencies: ['admin_by_id'],
  capabilities: ['broadcast'],
  globals: ['ADMIN_ID'],
  callbacks: ['mod_broadcast:open', 'mod_broadcast:vip'],
  commands: [],
  mergeStrategy: {
    dedupeBot: true,
    dedupeStart: true,
    mergeGlobals: 'reuse',
    mergeMenus: true,
    placement: 'fragment',
  },
  graph,
  exports: { broadcastOpenCallback: 'mod_broadcast:open' },
  imports: ['ADMIN_ID'],
};
