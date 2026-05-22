/**
 * Graph UI palette — PaletteEntryV2 contract & Sidebar integrity.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRAPH_OPERATION_TYPES } from '../../src/constructor/graph_document/graph_schema.js';
import {
  GRAPH_UI_OPERATION_METADATA,
  compileAddNewStack,
} from '../../src/constructor/graph_document/graph_ui_compositions.js';
import { getPaletteBlockTypes } from '../../core/blockRegistry.js';
import { localizeBlockTypes } from '../../src/builderI18n.js';
import {
  PALETTE_SIDEBAR_CATEGORY_ORDER,
  paletteSidebarSectionOrder,
} from '../../src/constructor/graph_document/palette_core.js';
import { AIOGRAM3_RUNTIME } from '../../core/aiogram3Runtime.js';
import {
  buildGraphUiPalette,
  compilePaletteAction,
  getPaletteEntry,
  groupPaletteForSidebar,
  assertPaletteContract,
  assertPaletteIntegrity,
  normalizePaletteCategory,
  PALETTE_CATEGORY_FALLBACK,
} from '../../src/constructor/graph_document/graph_ui_palette.js';
import { createGraphEditorStore } from '../../src/constructor/graph_document/graph_editor_store.js';
import { applyComposition } from '../../src/constructor/graph_document/graph_operation_client.js';
import { findForbiddenImportsInSource } from '../../src/constructor/uiLayerGuard.js';

const root = path.join(fileURLToPath(new URL('../..', import.meta.url)));

for (const op of GRAPH_OPERATION_TYPES) {
  const meta = GRAPH_UI_OPERATION_METADATA[op];
  assert.ok(meta, `missing GRAPH_UI_OPERATION_METADATA for ${op}`);
  assert.equal(meta.runtime, AIOGRAM3_RUNTIME, `${op} runtime`);
}

const catalog = getPaletteBlockTypes();
assert.equal(
  new Set(PALETTE_SIDEBAR_CATEGORY_ORDER).size,
  PALETTE_SIDEBAR_CATEGORY_ORDER.length,
  'PALETTE_SIDEBAR_CATEGORY_ORDER must not contain duplicate section ids',
);

const localized = localizeBlockTypes(getPaletteBlockTypes(), 'ru');
const palette = buildGraphUiPalette('ru', { blockTypes: localized });

assertPaletteContract(palette);
const integrity = assertPaletteIntegrity(palette);
assert.equal(integrity.ok, true, `palette integrity warnings: ${integrity.warnings.join('; ')}`);
assert.ok(integrity.operations >= 4);
assert.ok(integrity.nodes >= catalog.length * 0.9);

const operationEntries = palette.filter((e) => e.type === 'operation');
const nodeEntries = palette.filter((e) => e.type === 'node');
assert.ok(operationEntries.length >= 4);
assert.ok(nodeEntries.length >= catalog.length * 0.9);

for (const entry of palette) {
  assert.ok(entry.category, `missing category: ${entry.id}`);
  assert.ok(entry.type === 'operation' || entry.type === 'node', entry.id);
  assert.ok(entry.paletteKind === 'tool' || entry.paletteKind === 'node', entry.id);
  assert.ok(entry.meta?.icon, `missing meta.icon: ${entry.id}`);
  assert.equal(entry.runtime, AIOGRAM3_RUNTIME, `runtime ${entry.id}`);
}

for (const entry of operationEntries) {
  assert.equal(entry.paletteKind, 'tool');
  assert.ok(entry.operationType);
}

const startNode = nodeEntries.find((e) => e.id === 'node:start');
assert.ok(startNode);
assert.equal(startNode.paletteKind, 'node');
assert.equal(startNode.operationType, 'AddNode');
assert.equal(startNode.interaction, 'drag');
assert.equal(normalizePaletteCategory('Настройки'), 'system_root');
assert.equal(normalizePaletteCategory('Точки входа'), 'entry_points');

const sidebarSectionOrder = paletteSidebarSectionOrder();
const { groups, sectionOrder } = groupPaletteForSidebar(palette, sidebarSectionOrder);
const visible = sectionOrder.reduce((n, g) => n + (groups[g]?.length || 0), 0);
assert.equal(visible, palette.length, 'Sidebar must render every palette entry');

const messageEntry = getPaletteEntry('node:message', { blockTypes: localized });
const block = {
  id: 'n_test_palette',
  type: 'message',
  props: { text: 'hi' },
  uiAttachments: {},
};
const compiled = compilePaletteAction(messageEntry, { x: 40, y: 50, block });
assert.equal(compiled.ok, true);
assert.equal(compiled.operations[0].type, 'AddNode');

const direct = compileAddNewStack(40, 50, block);
assert.deepEqual(
  compiled.operations.map((o) => ({ type: o.type, payload: { ...o.payload } })),
  direct.operations.map((o) => ({ type: o.type, payload: { ...o.payload } })),
);

const store = createGraphEditorStore();
const graph = { dispatch: (...a) => store.dispatch(...a) };
assert.equal(applyComposition(graph, compiled).ok, true);

const emptyNodes = buildGraphUiPalette('ru', { blockTypes: [] });
assert.ok(emptyNodes.filter((e) => e.type === 'node').length >= catalog.length * 0.9);

const sidebarSrc = fs.readFileSync(
  path.join(root, 'src/builder/BuilderComponents.jsx'),
  'utf8',
);
const sidebarStart = sidebarSrc.indexOf('function Sidebar');
const sidebarChunk = sidebarSrc.slice(sidebarStart, sidebarStart + 3200);
const sidebarHits = findForbiddenImportsInSource(sidebarChunk, {
  filePath: 'src/builder/BuilderComponents.jsx Sidebar',
});
assert.equal(sidebarHits.length, 0, `Sidebar legacy palette: ${JSON.stringify(sidebarHits)}`);
assert.ok(!sidebarChunk.includes('buildGraphUiPalette'), 'Sidebar must use ctx.graphPalette only');

assert.ok(!palette.some((e) => e.operationType === 'MoveNode' && e.type === 'operation'));

console.log('test_ui_palette_consistency.js: ok');
