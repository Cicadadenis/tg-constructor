import assert from 'node:assert/strict';
import { getCompatibleBlockTypes, QUICK_ADD_FREQUENT_BLOCK_TYPES } from '../blockRegistry.js';
import { buildLocalizedBlockCatalog } from '../../src/constructor/block_catalog.js';
import { buildGraphUiPalette } from '../../src/constructor/graph_document/graph_ui_palette.js';
import { buildCatalogFromPalette } from '../../src/constructor/block_catalog.js';

const catalog = buildLocalizedBlockCatalog('ru');
const message = catalog.find((b) => b.type === 'message');
assert.equal(message?.groupId, 'output', 'localized catalog keeps flow section groupId');

const palette = buildGraphUiPalette('ru', { blockTypes: catalog });
const fromPalette = buildCatalogFromPalette(palette);
const startAllowed = getCompatibleBlockTypes('start');
const frequentForStart = QUICK_ADD_FREQUENT_BLOCK_TYPES.filter((t) => startAllowed.includes(t));
assert.ok(frequentForStart.includes('message'), 'start allows message in frequent list');
assert.ok(frequentForStart[0] === 'message', 'message is first frequent type for start');

const msgInPalette = fromPalette.find((b) => b.type === 'message');
assert.equal(msgInPalette?.groupId, 'output');

console.log('quick-add-frequent.test.mjs: ok');
