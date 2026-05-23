/** @category keyboards */
import { handlerColumn, mergeColumns } from './helpers.js';

export const keyboards = mergeColumns(0, [
  handlerColumn(1, [
    { id: 'n_start', type: 'start' },
    { id: 'n_intro', type: 'message', props: { text: 'Reply-клавиатура на этом сообщении:' } },
    { id: 'n_reply_kb', type: 'buttons', props: { rows: 'Да, Нет' } },
  ]),
  handlerColumn(2, [
    { id: 'n_cmd', type: 'command', props: { cmd: 'inline' } },
    { id: 'n_inline', type: 'inline', props: { buttons: 'Подробнее → more_info\nЗакрыть → close_panel' } },
    { id: 'n_inline_msg', type: 'message', props: { text: 'Inline привязан к сообщению (AST bind).' } },
  ]),
  handlerColumn(3, [
    { id: 'n_cb_more', type: 'callback', props: { callbackPrefix: 'more_' } },
    { id: 'n_more_msg', type: 'message', props: { text: 'Подробнее (callback_query prefix more_)' } },
    { id: 'n_more_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(4, [
    { id: 'n_cb_close', type: 'callback', props: { callbackPrefix: 'close_' } },
    { id: 'n_close_msg', type: 'message', props: { text: 'Панель закрыта.' } },
    { id: 'n_close_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(5, [
    { id: 'n_cb_ok', type: 'callback', props: { label: 'OK' } },
    { id: 'n_ok_msg', type: 'message', props: { text: 'Reply OK → F.text handler' } },
    { id: 'n_ok_kb', type: 'buttons', props: { rows: 'OK' } },
    { id: 'n_ok_goto', type: 'goto', props: { target: 'main' } },
  ]),
]);
