/**
 * Block catalog ↔ registry ↔ palette parity.
 */
import assert from 'node:assert/strict';
import { getPaletteBlockTypes } from '../../core/blockRegistry.js';
import {
  buildDefaultPropsMap,
  buildLocalizedBlockCatalog,
  buildCatalogFromPalette,
  resolveBuilderCatalog,
} from '../../src/constructor/block_catalog.js';
import { buildGraphUiPalette } from '../../src/constructor/graph_document/graph_ui_palette.js';

const registryCatalog = getPaletteBlockTypes();
const localized = buildLocalizedBlockCatalog('ru');
const defaults = buildDefaultPropsMap();
const palette = buildGraphUiPalette('ru', { blockTypes: localized });
const fromPalette = buildCatalogFromPalette(palette);
const resolved = resolveBuilderCatalog({ graphPalette: palette, lang: 'ru' });

assert.equal(localized.length, registryCatalog.length);
assert.equal(fromPalette.length, localized.length);

for (const row of registryCatalog) {
  assert.ok(defaults[row.type], `missing default props for ${row.type}`);
  const node = palette.find((e) => e.type === 'node' && e.defaultNodeType === row.type);
  assert.ok(node, `palette missing node entry for ${row.type}`);
}

for (const row of fromPalette) {
  const reg = registryCatalog.find((b) => b.type === row.type);
  assert.ok(reg, `catalog row without registry type: ${row.type}`);
  assert.equal(row.label, reg.label);
}

assert.equal(resolved.length, localized.length);
console.log('test_block_catalog: ok', {
  registry: registryCatalog.length,
  paletteNodes: fromPalette.length,
});
