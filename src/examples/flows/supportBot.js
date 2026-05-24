/** @category basic_handlers — Support Bot starter template */
import { handlerColumn, mergeColumns } from './helpers.js';

export const supportBot = mergeColumns(0, [
  handlerColumn(1, [
    { id: 'n_start', type: 'start' },
    { id: 'n_welcome', type: 'message', props: { text: '🎧 Support — how can we help you today?' } },
    { id: 'n_kb', type: 'buttons', props: { rows: 'Order issue, Technical help, Talk to agent' } },
  ]),
  handlerColumn(2, [
    { id: 'n_cb_order', type: 'callback', props: { label: 'Order issue' } },
    { id: 'n_order_msg', type: 'message', props: { text: '📦 Describe your order number and issue.' } },
    { id: 'n_order_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(3, [
    { id: 'n_cb_tech', type: 'callback', props: { label: 'Technical help' } },
    { id: 'n_tech_msg', type: 'message', props: { text: '🛠 Tell us what is not working — screenshots help.' } },
    { id: 'n_tech_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(4, [
    { id: 'n_cb_agent', type: 'callback', props: { label: 'Talk to agent' } },
    { id: 'n_agent_msg', type: 'message', props: { text: '👤 An agent will join within 24 hours.' } },
    { id: 'n_agent_goto', type: 'goto', props: { target: 'main' } },
  ]),
  handlerColumn(5, [
    { id: 'n_else', type: 'on_text' },
    { id: 'n_ticket', type: 'message', props: { text: '📝 Ticket logged. Reference: {пользователь.id}' } },
  ]),
]);
