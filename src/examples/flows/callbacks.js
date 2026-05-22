/** @category callbacks */
import { handlerColumn, mergeColumns } from './helpers.js';

export const callbacks = mergeColumns(0, [
  handlerColumn(1, [
    { id: 'n_start', type: 'start' },
    { id: 'n_inline', type: 'inline', props: { buttons: 'Запустить → run_demo\nОтмена → cancel_demo' } },
    { id: 'n_msg', type: 'message', props: { text: 'Inline + явные callback handlers:' } },
  ]),
  handlerColumn(2, [
    { id: 'n_cb_run', type: 'callback', props: { callbackPrefix: 'run_' } },
    { id: 'n_run_msg', type: 'message', props: { text: '▶️ run_* handler' } },
    { id: 'n_run_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(3, [
    { id: 'n_cb_cancel', type: 'callback', props: { callbackPrefix: 'cancel_' } },
    { id: 'n_cancel_msg', type: 'message', props: { text: '❌ cancel_* handler' } },
    { id: 'n_cancel_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(4, [
    { id: 'n_cb_ok', type: 'callback', props: { label: 'OK' } },
    { id: 'n_ok_msg', type: 'message', props: { text: 'Reply OK' } },
    { id: 'n_ok_kb', type: 'buttons', props: { rows: 'OK' } },
    { id: 'n_ok_goto', type: 'goto', props: { target: 'main' } },
  ]),
]);
