/**
 * Node-type capability contracts — triggers, actions, async, flow outputs.
 * UI attachment features (buttons/inline/media) remain on BlockDefinition.capabilities (string[]).
 * @typedef {{ triggers?: string[], actions?: string[], async: boolean, outputs: string[] }} BlockCapabilities
 */

export const BLOCK_CAPABILITIES_VERSION = '1.0';

const FLOW = Object.freeze(['flow']);
const NONE = Object.freeze([]);
const BRANCH = Object.freeze(['true', 'false']);
const LOOP = Object.freeze(['body', 'done']);

/**
 * @param {readonly string[]} outputs
 * @param {Omit<Partial<BlockCapabilities>, 'outputs' | 'async'> & { async?: boolean }} [partial]
 * @returns {BlockCapabilities}
 */
function cap(outputs, partial = {}) {
  return Object.freeze({
    async: partial.async ?? false,
    outputs: Object.freeze([...outputs]),
    ...(partial.triggers?.length
      ? { triggers: Object.freeze([...partial.triggers]) }
      : {}),
    ...(partial.actions?.length
      ? { actions: Object.freeze([...partial.actions]) }
      : {}),
  });
}

/** @type {Readonly<Record<string, BlockCapabilities>>} */
export const blockCapabilitiesByType = Object.freeze({
  version: cap(NONE, { actions: ['declare_version'] }),
  bot: cap(NONE, { actions: ['declare_bot'] }),
  commands: cap(NONE, { actions: ['declare_commands'] }),
  global: cap(NONE, { actions: ['declare_global'] }),

  start: cap(FLOW, { triggers: ['telegram.command.start'], actions: ['route'] }),
  command: cap(FLOW, { triggers: ['telegram.command'], actions: ['route'] }),
  callback: cap(FLOW, { triggers: ['telegram.callback_query'], actions: ['route'] }),
  on_text: cap(FLOW, { triggers: ['telegram.message.text'], actions: ['route'] }),
  on_photo: cap(FLOW, { triggers: ['telegram.message.photo'], actions: ['route'] }),
  photo_received: cap(FLOW, { triggers: ['telegram.message.photo'], actions: ['route'] }),
  on_voice: cap(FLOW, { triggers: ['telegram.message.voice'], actions: ['route'] }),
  voice_received: cap(FLOW, { triggers: ['telegram.message.voice'], actions: ['route'] }),
  on_document: cap(FLOW, { triggers: ['telegram.message.document'], actions: ['route'] }),
  document_received: cap(FLOW, { triggers: ['telegram.message.document'], actions: ['route'] }),
  on_sticker: cap(FLOW, { triggers: ['telegram.message.sticker'], actions: ['route'] }),
  sticker_received: cap(FLOW, { triggers: ['telegram.message.sticker'], actions: ['route'] }),
  on_location: cap(FLOW, { triggers: ['telegram.message.location'], actions: ['route'] }),
  location_received: cap(FLOW, { triggers: ['telegram.message.location'], actions: ['route'] }),
  on_contact: cap(FLOW, { triggers: ['telegram.message.contact'], actions: ['route'] }),
  contact_received: cap(FLOW, { triggers: ['telegram.message.contact'], actions: ['route'] }),

  message: cap(FLOW, { actions: ['send_message'] }),
  reply: cap(FLOW, { actions: ['send_message'] }),
  caption: cap(FLOW, { actions: ['send_message'] }),
  buttons: cap(FLOW, { actions: ['attach_reply_keyboard'] }),
  inline: cap(FLOW, { actions: ['attach_inline_keyboard'] }),
  inline_keyboard: cap(NONE, { actions: ['attach_inline_keyboard'] }),
  reply_keyboard: cap(NONE, { actions: ['attach_reply_keyboard'] }),

  condition: cap(BRANCH, { actions: ['branch'] }),
  condition_not: cap(BRANCH, { actions: ['branch'] }),
  else: cap(FLOW, { actions: ['branch_fallback'] }),
  ask: cap(FLOW, { actions: ['prompt', 'store_input'], async: true }),
  remember: cap(FLOW, { actions: ['store_session'] }),
  set_variable: cap(FLOW, { actions: ['ctx_set_var'] }),
  get_variable: cap(FLOW, { actions: ['ctx_get_var'] }),
  get: cap(FLOW, { actions: ['load_storage'], async: true }),
  save: cap(FLOW, { actions: ['save_storage'], async: true }),

  goto: cap(NONE, { actions: ['jump'] }),
  loop: cap(LOOP, { actions: ['loop'] }),
  foreach: cap(LOOP, { actions: ['foreach', 'inline_from_list'], async: true }),

  delay: cap(FLOW, { actions: ['sleep'], async: true }),
  pause: cap(FLOW, { actions: ['sleep'], async: true }),
  typing: cap(FLOW, { actions: ['chat_action'], async: true }),
  stop: cap(NONE, { actions: ['halt'] }),
  log: cap(FLOW, { actions: ['log'] }),

  media: cap(FLOW, { actions: ['send_media'] }),
  photo: cap(FLOW, { actions: ['send_photo'] }),
  photo_var: cap(FLOW, { actions: ['send_photo'] }),
  video: cap(FLOW, { actions: ['send_video'] }),
  audio: cap(FLOW, { actions: ['send_audio'] }),
  document: cap(FLOW, { actions: ['send_document'] }),
  document_var: cap(FLOW, { actions: ['send_document'] }),
  send_file: cap(FLOW, { actions: ['send_document'] }),
  sticker: cap(FLOW, { actions: ['send_sticker'] }),
  contact: cap(FLOW, { actions: ['send_contact'] }),
  location: cap(FLOW, { actions: ['send_location'] }),
  poll: cap(FLOW, { actions: ['send_poll'] }),

  set_global: cap(FLOW, { actions: ['set_global'] }),

  'fsm.state': cap(FLOW, { actions: ['fsm_state'] }),
  'fsm.input': cap(FLOW, { actions: ['fsm_input'], async: true }),
  'fsm.transition': cap(FLOW, { actions: ['fsm_transition'] }),
  fsm: cap(FLOW, { actions: ['fsm_state'] }),

  'db.get': cap(FLOW, { actions: ['db_read'], async: true }),
  'db.set': cap(FLOW, { actions: ['db_write'], async: true }),
  'db.query': cap(FLOW, { actions: ['db_query'], async: true }),
  'db.insert': cap(FLOW, { actions: ['db_insert'], async: true }),
  'db.update': cap(FLOW, { actions: ['db_update'], async: true }),

  require_role: cap(FLOW, { actions: ['require_role'], async: true }),
});

/** @type {BlockCapabilities} */
const FALLBACK_CAPABILITIES = Object.freeze({
  async: false,
  outputs: FLOW,
  actions: Object.freeze(['noop']),
});

/** @param {string} blockType */
export function getBlockCapabilities(blockType) {
  const t = String(blockType || '').trim();
  return blockCapabilitiesByType[t] ?? FALLBACK_CAPABILITIES;
}

/**
 * Strict capability lookup — no silent fallback (registry enforcement).
 * @param {string} blockType
 * @param {{ nodeId?: string }} [context]
 */
export function getBlockCapabilitiesStrict(blockType, context = {}) {
  const t = String(blockType || '').trim();
  if (!t) {
    throw new Error(
      context.nodeId
        ? `blockCapabilities: node "${context.nodeId}" missing block type`
        : 'blockCapabilities: block type is required',
    );
  }
  const caps = blockCapabilitiesByType[t];
  if (!caps) {
    throw new Error(
      context.nodeId
        ? `blockCapabilities: no capability map for node "${context.nodeId}" type "${t}"`
        : `blockCapabilities: no capability map for block type "${t}"`,
    );
  }
  return caps;
}

/** @param {string} blockType */
export function hasBlockCapabilities(blockType) {
  return Boolean(blockCapabilitiesByType[String(blockType || '').trim()]);
}

/** @param {string} blockType @param {string | null | undefined} sourcePortId */
export function isAllowedSourcePort(blockType, sourcePortId) {
  const caps = getBlockCapabilities(blockType);
  if (caps.outputs.length === 0) return false;
  const port = String(sourcePortId || 'flow').trim() || 'flow';
  return caps.outputs.includes(port);
}

/**
 * Map capability contract + port → execution edge trigger.
 * @param {string} blockType
 * @param {string | null | undefined} [sourcePortId]
 */
export function executionTriggerForSource(blockType, sourcePortId) {
  const t = String(blockType || '').trim();
  const port = String(sourcePortId || 'flow').trim() || 'flow';

  if (port === 'true' || port === 'false') return 'next';

  const caps = blockCapabilitiesByType[t];
  if (!caps) {
    if (t.startsWith('fsm.') || t === 'fsm') return 'state';
    if (t === 'callback') return 'callback';
    return 'next';
  }

  const triggers = caps.triggers || [];
  const triggerStr = triggers.join(' ');

  if (
    t.startsWith('fsm.')
    || t === 'fsm'
    || triggerStr.includes('fsm')
  ) {
    return 'state';
  }

  if (t === 'callback' || triggerStr.includes('callback_query')) {
    return 'callback';
  }

  return 'next';
}

/** @param {string} blockType */
export function assertBlockCapabilitiesRegistered(blockType) {
  const t = String(blockType || '').trim();
  if (!t) throw new Error('blockCapabilities: block type is required');
  if (!blockCapabilitiesByType[t]) {
    throw new Error(`blockCapabilities: no capability map for block type "${t}"`);
  }
}

/** @template T @param {T & { type: string }} definition */
export function attachCapabilitiesToDefinition(definition) {
  const nodeCapabilities = getBlockCapabilities(definition.type);
  return Object.freeze({
    ...definition,
    nodeCapabilities,
  });
}
