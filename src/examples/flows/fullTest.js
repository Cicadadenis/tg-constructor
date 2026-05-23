/** @category advanced_routing */
import { handlerColumn, mergeColumns } from './helpers.js';

export const fullTest = mergeColumns(0, [
  handlerColumn(1, [
    {
      id: 'n_cmds',
      type: 'commands',
      props: { commands: '/start - 🧪\n/help - ❓\n/profile - 👤\n/media - 🖼' },
    },
  ], 20),
  handlerColumn(2, [
    { id: 'n_start', type: 'start' },
    { id: 'n_start_msg', type: 'message', props: { text: '🧪 Full Test AST-first' } },
    { id: 'n_start_kb', type: 'buttons', props: { rows: '👤 Профиль, 🖼 Медиа' } },
  ]),
  handlerColumn(3, [
    { id: 'n_help', type: 'command', props: { cmd: 'help' } },
    { id: 'n_help_inl', type: 'inline', props: { buttons: 'Профиль → go_profile' } },
    { id: 'n_help_msg', type: 'message', props: { text: '/profile, /media' } },
  ]),
  handlerColumn(4, [
    { id: 'n_cb_prof', type: 'callback', props: { callbackPrefix: 'go_' } },
    { id: 'n_goto_prof', type: 'goto', props: { target: 'profile' } },
  ]),
  handlerColumn(5, [
    { id: 'n_prof', type: 'command', props: { cmd: 'profile' } },
    { id: 'n_ask1', type: 'ask', props: { question: 'Имя?', varname: 'name' } },
    { id: 'n_ask2', type: 'ask', props: { question: 'Город?', varname: 'city' } },
    { id: 'n_prof_done', type: 'message', props: { text: '✅ {name}, {city}' } },
  ]),
  handlerColumn(6, [
    { id: 'n_media', type: 'command', props: { cmd: 'media' } },
    { id: 'n_media_msg', type: 'message', props: { text: 'Фото:' } },
    { id: 'n_photo', type: 'photo', props: { url: 'https://picsum.photos/480/320' } },
  ]),
  handlerColumn(7, [
    { id: 'n_cb_media', type: 'callback', props: { label: '🖼 Медиа' } },
    { id: 'n_cb_media_msg', type: 'message', props: { text: 'Команда /media' } },
    { id: 'n_cb_media_goto', type: 'goto', props: { target: 'main' } },
  ]),
]);
