/** @category keyboards */
import { handlerColumn, mergeColumns } from './helpers.js';

const MENU_TEXT = '☀️ Выберите город:';
const MENU_ROWS = 'Запорожье, Киев\nЛьвов, Информация о боте';

function cityColumn(col, id, label, weatherText) {
  return handlerColumn(col, [
    { id: `n_${id}`, type: 'callback', props: { label } },
    { id: `n_${id}_msg`, type: 'message', props: { text: weatherText } },
    { id: `n_${id}_kb`, type: 'buttons', props: { rows: MENU_ROWS } },
    { id: `n_${id}_goto`, type: 'goto', props: { target: 'main' } },
  ]);
}

export const weather = mergeColumns(0, [
  handlerColumn(1, [
    { id: 'n_start', type: 'start' },
    { id: 'n_menu_msg', type: 'message', props: { text: MENU_TEXT } },
    { id: 'n_menu_kb', type: 'buttons', props: { rows: MENU_ROWS } },
  ]),
  handlerColumn(2, [
    { id: 'n_info', type: 'callback', props: { label: 'Информация о боте' } },
    {
      id: 'n_info_msg',
      type: 'message',
      props: { text: '🤖 Демо-погода (AST-first). Статические ответы.' },
    },
    { id: 'n_info_kb', type: 'buttons', props: { rows: MENU_ROWS } },
    { id: 'n_info_goto', type: 'goto', props: { target: 'main' } },
  ]),
  cityColumn(3, 'zp', 'Запорожье', '🌍 Запорожье\n🌡 Демо: +18°C'),
  cityColumn(4, 'kv', 'Киев', '🌍 Киев\n🌡 Демо: +15°C'),
  cityColumn(5, 'lv', 'Львов', '🌍 Львов\n🌡 Демо: +12°C'),
]);
