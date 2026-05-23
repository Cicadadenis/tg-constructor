/**
 * Aiogram 3 palette — runtime filter and registry alignment.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AIOGRAM3_RUNTIME,
  AIOGRAM3_PALETTE_BLOCK_TYPES,
  isAiogram3PaletteBlockType,
} from '../aiogram3Runtime.js';
import { getPaletteBlockTypes } from '../blockRegistry.js';
import { GRAPH_OPERATION_TYPES } from '../../src/constructor/graph_document/graph_schema.js';
import { GRAPH_UI_OPERATION_METADATA } from '../../src/constructor/graph_document/graph_ui_compositions.js';
import { buildGraphUiPalette } from '../../src/constructor/graph_document/graph_ui_palette.js';

test('GRAPH_UI_OPERATION_METADATA covers GRAPH_OPERATION_TYPES with aiogram3 runtime', () => {
  for (const op of GRAPH_OPERATION_TYPES) {
    const meta = GRAPH_UI_OPERATION_METADATA[op];
    assert.ok(meta, `missing metadata for ${op}`);
    assert.equal(meta.runtime, AIOGRAM3_RUNTIME, `${op} runtime`);
  }
});

test('palette block types are aiogram3-only', () => {
  const rows = getPaletteBlockTypes();
  assert.ok(rows.length >= AIOGRAM3_PALETTE_BLOCK_TYPES.length * 0.9);
  for (const row of rows) {
    assert.equal(row.runtime, AIOGRAM3_RUNTIME, row.type);
    assert.ok(isAiogram3PaletteBlockType(row.type), row.type);
  }
});

test('buildGraphUiPalette has no non-aiogram3 node entries', () => {
  const palette = buildGraphUiPalette('ru');
  const nodes = palette.filter((e) => e.type === 'node');
  assert.ok(nodes.length >= 20);
  for (const entry of nodes) {
    const t = entry.defaultNodeType || entry.id.replace(/^node:/, '');
    assert.ok(isAiogram3PaletteBlockType(t), `palette node ${t}`);
    assert.equal(entry.runtime, AIOGRAM3_RUNTIME, entry.id);
  }
  const legacyIds = ['scenario', 'step', 'middleware', 'http', 'database', 'block', 'use'];
  for (const id of legacyIds) {
    assert.equal(
      palette.some((e) => e.id === `node:${id}`),
      false,
      `legacy block ${id} must not appear`,
    );
  }
});
