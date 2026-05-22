/** @category basic_handlers */
import { handlerColumn, mergeColumns } from './helpers.js';

export const echo = mergeColumns(0, [
  handlerColumn(1, [
    { id: 'n_start', type: 'start' },
    { id: 'n_msg1', type: 'message', props: { text: '👋 Привет, {пользователь.имя}!' } },
    { id: 'n_msg2', type: 'message', props: { text: 'Напишите текст — я повторю.' } },
    { id: 'n_kb', type: 'buttons', props: { rows: 'Привет, Пока, Инфо' } },
  ]),
  handlerColumn(2, [
    { id: 'n_help', type: 'command', props: { cmd: 'help' } },
    { id: 'n_help_msg', type: 'message', props: { text: '📖 Отправьте сообщение — бот повторит.' } },
  ]),
  handlerColumn(3, [
    { id: 'n_cb_hi', type: 'callback', props: { label: 'Привет' } },
    { id: 'n_hi_msg', type: 'message', props: { text: 'Привет-привет! 👋' } },
    { id: 'n_hi_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(4, [
    { id: 'n_cb_bye', type: 'callback', props: { label: 'Пока' } },
    { id: 'n_bye_msg', type: 'message', props: { text: 'До свидания! 👋' } },
    { id: 'n_bye_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(5, [
    { id: 'n_cb_info', type: 'callback', props: { label: 'Инфо' } },
    { id: 'n_info_msg', type: 'message', props: { text: 'ID: {пользователь.id}' } },
    { id: 'n_info_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(6, [
    { id: 'n_else', type: 'on_text' },
    { id: 'n_echo', type: 'message', props: { text: '🔊 Вы сказали: {текст}' } },
  ]),
]);
