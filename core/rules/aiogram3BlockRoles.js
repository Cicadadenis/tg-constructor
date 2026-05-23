/**
 * Aiogram 3 block roles — universal binding taxonomy for the rule engine.
 */

import { getAiogram3BlockFlowMeta } from '../aiogram3Runtime.js';
import { EVENT_HANDLER_TYPES } from '../codegen/constants.js';
import { getBlockDefinition } from '../blockRegistry.js';

/** Global execution pipeline (strict order). */
export const AIOGRAM3_PIPELINE_STAGES = Object.freeze([
  Object.freeze({ id: 'system', order: 0, label: 'SYSTEM' }),
  Object.freeze({ id: 'entry', order: 1, label: 'ENTRY' }),
  Object.freeze({ id: 'router', order: 2, label: 'ROUTER' }),
  Object.freeze({ id: 'handler', order: 3, label: 'HANDLER' }),
  Object.freeze({ id: 'security', order: 4, label: 'SECURITY' }),
  Object.freeze({ id: 'logic', order: 5, label: 'LOGIC' }),
  Object.freeze({ id: 'fsm', order: 6, label: 'FSM' }),
  Object.freeze({ id: 'output', order: 7, label: 'OUTPUT' }),
  Object.freeze({ id: 'media', order: 8, label: 'MEDIA' }),
  Object.freeze({ id: 'api', order: 9, label: 'API' }),
  Object.freeze({ id: 'data', order: 10, label: 'DATA' }),
  Object.freeze({ id: 'observability', order: 11, label: 'OBSERVABILITY' }),
]);

const STAGE_ORDER = Object.freeze(
  Object.fromEntries(AIOGRAM3_PIPELINE_STAGES.map((s) => [s.id, s.order])),
);

export const ROLE_SYSTEM = Object.freeze(new Set([
  'version', 'bot', 'global', 'commands',
]));

export const ROLE_ENTRY = Object.freeze(new Set([
  ...EVENT_HANDLER_TYPES,
  'else',
]));

export const ROLE_KEYBOARD = Object.freeze(new Set([
  'buttons',
  'inline',
  'inline_db',
  'inline_keyboard',
  'reply_keyboard',
]));

export const ROLE_OUTPUT = Object.freeze(new Set([
  'message', 'reply', 'caption', 'menu', 'notify', 'random',
]));

export const ROLE_MEDIA = Object.freeze(new Set([
  'photo', 'video', 'audio', 'document', 'sticker', 'contact', 'location', 'poll',
  'send_file', 'photo_var', 'document_var', 'media',
]));

export const ROLE_FSM = Object.freeze(new Set([
  'ask', 'remember', 'get', 'save', 'save_global', 'set_global', 'goto', 'stop',
]));

export const ROLE_CONTROL = Object.freeze(new Set([
  'condition', 'condition_not', 'else', 'loop', 'delay', 'typing',
]));

export const ROLE_OBSERVABILITY = Object.freeze(new Set(['log', 'analytics']));

export const ROLE_API = Object.freeze(new Set(['http']));

export const ROLE_DATA = Object.freeze(new Set([
  'database', 'db_delete', 'get_user', 'all_keys',
]));

export const ROLE_SECURITY = Object.freeze(new Set([
  'check_sub', 'member_role', 'role',
]));

/** Blocks that may follow output/media (keyboard bind, state, observability). */
export const ROLE_AFTER_OUTPUT = Object.freeze(new Set([
  ...ROLE_KEYBOARD,
  ...ROLE_OBSERVABILITY,
  ...ROLE_FSM,
  'remember', 'save', 'get', 'set_global',
  'delay', 'typing', 'stop', 'goto',
]));

/** Send methods that accept reply_markup in codegen. */
export const ROLE_OUTPUT_BIND_TARGET = Object.freeze(new Set([
  ...ROLE_OUTPUT,
  ...ROLE_MEDIA,
]));

const ROLE_BY_TYPE = Object.freeze({
  system: ROLE_SYSTEM,
  entry: ROLE_ENTRY,
  keyboard: ROLE_KEYBOARD,
  output: ROLE_OUTPUT,
  media: ROLE_MEDIA,
  fsm: ROLE_FSM,
  control: ROLE_CONTROL,
  observability: ROLE_OBSERVABILITY,
  api: ROLE_API,
  data: ROLE_DATA,
  security: ROLE_SECURITY,
});

export function getBlockRole(type) {
  const t = String(type || '').trim();
  for (const [role, set] of Object.entries(ROLE_BY_TYPE)) {
    if (set.has(t)) return role;
  }
  const flow = getAiogram3BlockFlowMeta(t);
  if (flow?.flowRole) return flow.flowRole === 'entrypoint' ? 'entry' : flow.flowRole;
  return null;
}

export function getPipelineStageOrder(type) {
  const role = getBlockRole(type);
  switch (role) {
    case 'system': return STAGE_ORDER.system;
    case 'entry': return STAGE_ORDER.entry;
    case 'keyboard': return STAGE_ORDER.output;
    case 'output': return STAGE_ORDER.output;
    case 'media': return STAGE_ORDER.media;
    case 'fsm': return STAGE_ORDER.fsm;
    case 'control': return STAGE_ORDER.logic;
    case 'security': return STAGE_ORDER.security;
    case 'api': return STAGE_ORDER.api;
    case 'data': return STAGE_ORDER.data;
    case 'observability': return STAGE_ORDER.observability;
    default: return 99;
  }
}

export function isKnownAiogram3BlockType(type) {
  const t = String(type || '').trim();
  if (!t) return false;
  if (getBlockRole(t)) return true;
  return Boolean(getBlockDefinition(t));
}

export function isHandlerRootType(type) {
  return ROLE_ENTRY.has(String(type || '').trim());
}

export function isSystemRootType(type) {
  return ROLE_SYSTEM.has(String(type || '').trim());
}
