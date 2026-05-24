/** @category basic_handlers — Welcome Flow starter template */
import { handlerColumn, mergeColumns } from './helpers.js';

export const welcome = mergeColumns(0, [
  handlerColumn(1, [
    { id: 'n_start', type: 'start' },
    { id: 'n_welcome', type: 'message', props: { text: '👋 Welcome! Glad you are here.' } },
    { id: 'n_intro', type: 'message', props: { text: 'Tap a button below or send any message to continue.' } },
    { id: 'n_kb', type: 'buttons', props: { rows: 'Get started, Help' } },
  ]),
  handlerColumn(2, [
    { id: 'n_cb_start', type: 'callback', props: { label: 'Get started' } },
    { id: 'n_start_msg', type: 'message', props: { text: '✨ You are all set — edit this flow to match your bot.' } },
    { id: 'n_start_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(3, [
    { id: 'n_cb_help', type: 'callback', props: { label: 'Help' } },
    { id: 'n_help_msg', type: 'message', props: { text: '📖 Send /help anytime or reply with a question.' } },
    { id: 'n_help_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(4, [
    { id: 'n_else', type: 'on_text' },
    { id: 'n_echo', type: 'message', props: { text: 'You wrote: {текст}' } },
  ]),
]);
