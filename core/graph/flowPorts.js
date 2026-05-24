/**
 * Flow port metadata for aiogram 3 palette blocks (GraphDocument validation).
 */
import {
  AIOGRAM3_PALETTE_BLOCK_TYPES,
  AIOGRAM3_HIDDEN_BLOCK_TYPES,
} from '../aiogram3Runtime.js';

const FLOW = Object.freeze({ input: 'flow', output: 'flow' });
const ENTRY = Object.freeze({ input: null, output: 'flow' });
const SYSTEM = Object.freeze({ input: null, output: null });
const TERMINAL = Object.freeze({ input: 'flow', output: null });

const PORT_BY_TYPE = Object.freeze({
  cicada: FLOW,
  version: SYSTEM,
  bot: SYSTEM,
  commands: SYSTEM,
  global: SYSTEM,
  set_global: FLOW,
  start: ENTRY,
  command: ENTRY,
  callback: ENTRY,
  else: ENTRY,
  on_text: ENTRY,
  on_photo: ENTRY,
  on_voice: ENTRY,
  on_document: ENTRY,
  on_sticker: ENTRY,
  on_location: ENTRY,
  on_contact: ENTRY,
  message: FLOW,
  reply: FLOW,
  caption: FLOW,
  buttons: FLOW,
  inline: FLOW,
  inline_keyboard: Object.freeze({ input: 'keyboard', output: null }),
  reply_keyboard: Object.freeze({ input: 'keyboard', output: null }),
  ask: FLOW,
  remember: FLOW,
  set_variable: FLOW,
  get_variable: FLOW,
  get: FLOW,
  save: FLOW,
  condition: FLOW,
  condition_not: FLOW,
  loop: FLOW,
  foreach: FLOW,
  delay: FLOW,
  pause: FLOW,
  typing: FLOW,
  log: FLOW,
  goto: TERMINAL,
  stop: TERMINAL,
  photo: FLOW,
  video: FLOW,
  audio: FLOW,
  document: FLOW,
  sticker: FLOW,
  contact: FLOW,
  location: FLOW,
  poll: FLOW,
  send_file: FLOW,
  photo_var: FLOW,
  document_var: FLOW,
  media: FLOW,
  'fsm.state': FLOW,
  'fsm.input': FLOW,
  'fsm.transition': FLOW,
  fsm: FLOW,
  'db.get': FLOW,
  'db.set': FLOW,
  'db.query': FLOW,
  'db.insert': FLOW,
  'db.update': FLOW,
  require_role: FLOW,
});

function buildFlowPorts() {
  const out = { ...PORT_BY_TYPE };
  for (const t of [...AIOGRAM3_PALETTE_BLOCK_TYPES, ...AIOGRAM3_HIDDEN_BLOCK_TYPES]) {
    if (!out[t]) out[t] = FLOW;
  }
  return Object.freeze(out);
}

export const FLOW_PORTS = buildFlowPorts();
