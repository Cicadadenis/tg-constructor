/**
 * Aiogram 3 palette — strict execution-flow ordering.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPaletteBlockTypes } from '../blockRegistry.js';
import {
  AIOGRAM3_PALETTE_BLOCK_TYPES_ORDERED,
  compareAiogram3PaletteEntries,
} from '../aiogram3PaletteOrder.js';
import {
  buildGraphUiPalette,
  assertPaletteFlowOrder,
  groupPaletteForSidebar,
} from '../../src/constructor/graph_document/graph_ui_palette.js';
import { paletteSidebarSectionOrder } from '../../src/constructor/graph_document/palette_core.js';

test('catalog matches canonical flow order', () => {
  const types = getPaletteBlockTypes().map((r) => r.type);
  assert.deepEqual(types, [...AIOGRAM3_PALETTE_BLOCK_TYPES_ORDERED]);
});

test('entrypoints before output in palette nodes', () => {
  const palette = buildGraphUiPalette('ru');
  assertPaletteFlowOrder(palette);
  const nodes = palette.filter((e) => e.type === 'node');
  const startIdx = nodes.findIndex((e) => e.id === 'node:start');
  const msgIdx = nodes.findIndex((e) => e.id === 'node:message');
  assert.ok(startIdx >= 0 && msgIdx >= 0);
  assert.ok(startIdx < msgIdx);
});

test('sidebar sections follow pipeline A→G then tools', () => {
  const order = paletteSidebarSectionOrder();
  assert.deepEqual(order.slice(0, 7), [
    'system_root',
    'core_framework',
    'entry_points',
    'control_flow',
    'fsm',
    'output',
    'media_output',
  ]);
  assert.ok(order.includes('graph'));
});

test('grouped sidebar preserves flow order within section', () => {
  const palette = buildGraphUiPalette('ru');
  const { groups } = groupPaletteForSidebar(palette, paletteSidebarSectionOrder());
  const entry = groups.entry_points || [];
  assert.ok(entry.length >= 10);
  for (let i = 1; i < entry.length; i += 1) {
    assert.ok(compareAiogram3PaletteEntries(entry[i - 1], entry[i]) <= 0);
  }
});

test('on_text appears in entry_points after callback', () => {
  const palette = buildGraphUiPalette('ru');
  const nodes = palette.filter((e) => e.type === 'node').map((e) => e.defaultNodeType);
  const cb = nodes.indexOf('callback');
  const text = nodes.indexOf('on_text');
  assert.ok(cb >= 0 && text > cb);
});
