/**
 * Node palette metadata — aiogram 3 block catalog for graph UI.
 * Used with GRAPH_UI_OPERATION_METADATA to build palette-core entries.
 */

import { AIOGRAM3_RUNTIME } from '../../../core/aiogram3Runtime.js';
import { getPaletteBlockTypes } from '../../../core/blockRegistry.js';

function freezeNodeMeta(rows) {
  return Object.freeze(
    Object.fromEntries(
      rows.map((row) => [
        row.type,
        Object.freeze({
          runtime: row.runtime || AIOGRAM3_RUNTIME,
          label: Object.freeze({ ru: row.label, en: row.label, uk: row.label }),
          icon: row.icon || '•',
          color: row.color || '#94a3b8',
          category: row.groupId || 'main',
          categoryLabel: row.group || 'Основные',
          canBeRoot: row.canBeRoot ?? true,
          canStack: row.canStack ?? true,
          defaultNodeType: row.type,
        }),
      ]),
    ),
  );
}

/** @type {Readonly<Record<string, object>>} */
export const GRAPH_UI_NODE_METADATA = freezeNodeMeta(getPaletteBlockTypes());

/**
 * @param {string} nodeType
 */
export function getGraphUiNodeMetadata(nodeType) {
  return GRAPH_UI_NODE_METADATA[String(nodeType || '').trim()] || null;
}

/**
 * Rows for palette node entries (localized label applied in graph_ui_palette).
 */
export function listGraphUiNodeCatalogRows() {
  return getPaletteBlockTypes();
}
