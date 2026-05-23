/**
 * Graph module: user/admin statistics (user_count style).
 */
import { moduleFlow, moduleHandlerColumn } from '../helpers.js';

const col = moduleHandlerColumn(1, [
  { id: 'n_cb_stats', type: 'callback', props: { data: 'mod_stats:view', label: 'Статистика' } },
  {
    id: 'n_get_refs',
    type: 'get',
    props: { key: 'ref_count', varname: 'ref_count' },
  },
  {
    id: 'n_init_refs',
    type: 'condition',
    props: { cond: 'не ref_count' },
  },
  {
    id: 'n_set_refs',
    type: 'remember',
    props: { varname: 'ref_count', value: '0' },
  },
  {
    id: 'n_save_refs',
    type: 'save',
    props: { key: 'ref_count', value: 'ref_count' },
  },
  {
    id: 'n_stats_msg',
    type: 'message',
    props: {
      text: '📊 Статистика:\n👥 Приглашено: {ref_count} чел.\n📅 ID: {пользователь.id}',
    },
  },
]);

/** @type {import('../../composition/types.js').GraphModuleManifest} */
export const adminStatsManifest = {
  id: 'user_count',
  version: 2,
  name: 'Статистика пользователя',
  category: '📊 Аналитика и статистика',
  dependencies: [],
  capabilities: ['stats'],
  globals: [],
  callbacks: ['mod_stats:view'],
  commands: [],
  mergeStrategy: {
    dedupeBot: true,
    dedupeStart: true,
    mergeGlobals: 'first_wins',
    mergeMenus: false,
    placement: 'fragment',
  },
  graph: moduleFlow(col.nodes, col.edges),
  exports: { statsCallback: 'mod_stats:view' },
  imports: [],
};
