/**
 * Aiogram 3 — sole production runtime for graph palette and codegen.
 */

export const AIOGRAM3_RUNTIME = 'aiogram3';

import {
  AIOGRAM3_PALETTE_BLOCK_TYPES_ORDERED,
  getAiogram3BlockFlowMeta,
} from './aiogram3PaletteOrder.js';

/** Block types exposed in the constructor palette — strict execution-flow order. */
export const AIOGRAM3_PALETTE_BLOCK_TYPES = AIOGRAM3_PALETTE_BLOCK_TYPES_ORDERED;

export { getAiogram3BlockFlowMeta } from './aiogram3PaletteOrder.js';

const PALETTE_SET = new Set(AIOGRAM3_PALETTE_BLOCK_TYPES);

/** Hidden aliases still compiled to aiogram 3 (not in sidebar). */
export const AIOGRAM3_HIDDEN_BLOCK_TYPES = Object.freeze([
  'reply',
  'caption',
  'pause',
  'on_text',
  'photo_received',
  'voice_received',
  'document_received',
  'sticker_received',
  'location_received',
  'contact_received',
  'media',
]);

const ALL_AIOGRAM3_TYPES = new Set([
  ...AIOGRAM3_PALETTE_BLOCK_TYPES,
  ...AIOGRAM3_HIDDEN_BLOCK_TYPES,
]);

export function isAiogram3Runtime(runtime) {
  return String(runtime || '').trim() === AIOGRAM3_RUNTIME;
}

export function isAiogram3PaletteBlockType(type) {
  return Boolean(getAiogram3BlockFlowMeta(type));
}

export function isAiogram3BlockType(type) {
  return ALL_AIOGRAM3_TYPES.has(String(type || '').trim());
}
