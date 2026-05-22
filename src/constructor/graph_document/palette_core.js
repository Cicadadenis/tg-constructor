/**
 * Palette-core — canonical PaletteEntryV2 contract and sidebar taxonomy.
 * Single source of truth for categories and entry shape (not builderI18n / BLOCK_TYPES).
 */

import { AIOGRAM3_RUNTIME } from '../../../core/aiogram3Runtime.js';

/** @typedef {'operation' | 'node'} PaletteEntryType */
/** @typedef {'tool' | 'node'} PaletteKind */
/** @typedef {'drag' | 'click' | 'drag-drop'} PaletteInteraction */

/**
 * @typedef {object} PaletteEntryV2
 * @property {string} id
 * @property {PaletteEntryType} type
 * @property {string} operationType
 * @property {string} label
 * @property {string} category
 * @property {string} [compileFn]
 * @property {string} [alternateCompileFn]
 * @property {string} [defaultNodeType]
 * @property {PaletteKind} paletteKind
 * @property {PaletteInteraction} interaction
 * @property {object} [meta]
 * @property {object} [_debug]
 */

export const PALETTE_CATEGORY_FALLBACK = 'main';

export const PALETTE_MAIN_EXTRA_SECTION = 'main_extra';

/** Graph tool sections (operations). */
export const PALETTE_TOOLS_CATEGORIES = Object.freeze([
  'graph',
  'relations',
  'data',
]);

/** Aiogram 3 execution-flow node sections (A–G). */
export const PALETTE_NODE_CATEGORIES = Object.freeze([
  'system_root',
  'core_framework',
  'entry_points',
  'control_flow',
  'fsm',
  'output',
  'media_output',
]);

export const PALETTE_SIDEBAR_CATEGORY_ORDER = Object.freeze([
  ...PALETTE_NODE_CATEGORIES,
  ...PALETTE_TOOLS_CATEGORIES,
]);

export const PALETTE_SIDEBAR_CATEGORY_IDS = Object.freeze([...PALETTE_SIDEBAR_CATEGORY_ORDER]);

/** @deprecated use PALETTE_SIDEBAR_CATEGORY_ORDER */
export const GRAPH_PALETTE_CATEGORY_ORDER = PALETTE_SIDEBAR_CATEGORY_ORDER;

/** Sidebar sections: pipeline nodes first, then graph tools. */
export function paletteSidebarSectionOrder() {
  return [...PALETTE_SIDEBAR_CATEGORY_ORDER];
}

const DRAGGABLE_INTERACTIONS = new Set(['drag', 'drag-drop']);

/** @param {string} [interaction] */
export function isPaletteInteractionDraggable(interaction) {
  return DRAGGABLE_INTERACTIONS.has(interaction);
}

/** @param {PaletteEntryV2 | object} entry */
export function isPaletteEntryDraggable(entry) {
  return isPaletteInteractionDraggable(entry?.interaction);
}

/** @param {PaletteEntryV2 | object} entry */
export function getPaletteEntryDisplay(entry) {
  const meta = entry?.meta || {};
  return {
    icon: meta.icon || entry?.icon || '•',
    color: meta.color || entry?.color || '#94a3b8',
    categoryLabel: meta.categoryLabel || entry?.categoryLabel || entry?.category || '',
  };
}

/**
 * @param {object} fields
 * @returns {PaletteEntryV2}
 */
export function createPaletteEntryV2(fields) {
  const type = fields.type === 'operation' ? 'operation' : 'node';
  const paletteKind = fields.paletteKind ?? (type === 'operation' ? 'tool' : 'node');
  const interaction = normalizePaletteInteraction(fields.interaction, type);

  /** @type {PaletteEntryV2} */
  const entry = {
    id: String(fields.id || '').trim(),
    type,
    runtime: String(fields.runtime || AIOGRAM3_RUNTIME).trim(),
    operationType: String(fields.operationType || '').trim(),
    label: String(fields.label ?? fields.id ?? '').trim(),
    category: String(fields.category || PALETTE_CATEGORY_FALLBACK).trim(),
    paletteKind,
    interaction,
  };

  if (fields.compileFn) entry.compileFn = fields.compileFn;
  if (fields.alternateCompileFn) entry.alternateCompileFn = fields.alternateCompileFn;
  if (fields.defaultNodeType) entry.defaultNodeType = fields.defaultNodeType;
  if (fields.meta) entry.meta = { ...fields.meta };
  if (fields._paletteRawCategory != null) entry._paletteRawCategory = fields._paletteRawCategory;
  if (fields._debug) entry._debug = { ...fields._debug };
  if (fields.categoryOrder != null) entry.categoryOrder = fields.categoryOrder;
  if (fields.priority != null) entry.priority = fields.priority;
  if (fields.flowRole != null) entry.flowRole = fields.flowRole;
  if (fields.flowIndex != null) entry.flowIndex = fields.flowIndex;

  return entry;
}

/** @param {string} [interaction] @param {PaletteEntryType} type */
function normalizePaletteInteraction(interaction, type) {
  const raw = String(interaction || '').trim();
  if (raw === 'drag-drop') return 'drag';
  if (raw === 'drag' || raw === 'click') return raw;
  if (type === 'node') return 'drag';
  return 'click';
}

/**
 * @param {PaletteEntryV2 | object} entry
 * @returns {string[]}
 */
export function validatePaletteEntryV2(entry) {
  const errors = [];
  if (!entry?.id) errors.push('missing id');
  if (entry.type !== 'operation' && entry.type !== 'node') {
    errors.push(`invalid type: ${entry?.type}`);
  }
  if (entry.paletteKind !== 'tool' && entry.paletteKind !== 'node') {
    errors.push(`invalid paletteKind: ${entry?.paletteKind}`);
  }
  if (!entry.category) errors.push('missing category');
  if (!entry.operationType) errors.push('missing operationType');
  if (!entry.label) errors.push('missing label');
  if (entry.type === 'node' && !entry.defaultNodeType) {
    errors.push('node entry missing defaultNodeType');
  }
  if (entry.type === 'node' && entry.operationType !== 'AddNode') {
    errors.push(`node entry must use AddNode, got ${entry.operationType}`);
  }
  if (entry.type === 'node' && !String(entry.id).startsWith('node:')) {
    errors.push(`node id must be node:<type>: ${entry.id}`);
  }
  return errors;
}
