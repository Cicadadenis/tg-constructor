/** @typedef {import('./visualNodeTypes.js').VisualNodeType} VisualNodeType */

/**
 * Maps internal runtime block types → marketer-facing visual node types.
 * Compiler / GraphDocument always use runtime `node.type` — this map is editor-only.
 * @type {Record<string, VisualNodeType>}
 */
export const RUNTIME_TO_VISUAL = Object.freeze({
  // Message
  message: 'message',
  reply: 'message',
  caption: 'message',
  buttons: 'message',
  inline: 'message',
  inline_keyboard: 'message',
  reply_keyboard: 'message',
  photo: 'message',
  video: 'message',
  audio: 'message',
  document: 'message',
  sticker: 'message',
  contact: 'message',
  location: 'message',
  poll: 'message',
  send_file: 'message',
  photo_var: 'message',
  document_var: 'message',
  media: 'message',

  // Input / triggers
  ask: 'input',
  on_text: 'input',
  on_photo: 'input',
  on_voice: 'input',
  on_document: 'input',
  on_sticker: 'input',
  on_location: 'input',
  on_contact: 'input',
  photo_received: 'input',
  voice_received: 'input',
  document_received: 'input',
  sticker_received: 'input',
  location_received: 'input',
  contact_received: 'input',
  'fsm.input': 'input',
  fsm_input: 'input',

  // Condition
  condition: 'condition',
  condition_not: 'condition',
  else: 'condition',

  // Delay
  delay: 'delay',
  typing: 'delay',
  pause: 'delay',

  // Action
  stop: 'action',
  log: 'action',
  goto: 'action',
  require_role: 'action',
  bot: 'action',
  version: 'action',
  commands: 'action',

  // API / AI
  classify: 'api_request',
  analytics: 'api_request',
  http: 'api_request',
  'db.query': 'api_request',

  // Tag
  set_global: 'tag',
  global: 'tag',

  // Variable / data
  set_variable: 'variable',
  get_variable: 'variable',
  get: 'variable',
  save: 'variable',
  remember: 'variable',
  'db.get': 'variable',
  'db.set': 'variable',
  'db.insert': 'variable',
  'db.update': 'variable',
  database: 'variable',

  // Goal / entry
  start: 'goal',
  command: 'goal',
  callback: 'goal',

  // Split (multi-output control)
  'fsm.transition': 'split',
  fsm_transition: 'split',

  // Sequence
  loop: 'sequence',
  foreach: 'sequence',
  'fsm.state': 'sequence',
  fsm_state: 'sequence',
});

const PREFIX_RULES = [
  { prefix: 'on_', visual: 'input' },
  { prefix: 'db.', visual: 'variable' },
];

/**
 * @param {string} runtimeType — GraphDocument node.type
 * @returns {VisualNodeType}
 */
export function resolveVisualType(runtimeType) {
  const t = String(runtimeType || '').trim();
  if (!t) return 'action';
  if (RUNTIME_TO_VISUAL[t]) return RUNTIME_TO_VISUAL[t];
  for (const { prefix, visual } of PREFIX_RULES) {
    if (t.startsWith(prefix)) return visual;
  }
  return 'action';
}

/**
 * @param {string} runtimeType
 * @returns {boolean} true if type exists in registry mapping (known runtime)
 */
export function hasRuntimeVisualMapping(runtimeType) {
  return Boolean(RUNTIME_TO_VISUAL[String(runtimeType || '').trim()]);
}
