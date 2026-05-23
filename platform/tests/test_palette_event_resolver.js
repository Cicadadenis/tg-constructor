/**
 * Palette event resolver — voice/sticker/command → PaletteEntryV2.
 */
import assert from 'node:assert/strict';
import { localizeBlockTypes } from '../../src/builderI18n.js';
import { getPaletteBlockTypes } from '../../core/blockRegistry.js';
import { applyComposition } from '../../src/constructor/graph_document/graph_operation_client.js';
import { createGraphEditorStore } from '../../src/constructor/graph_document/graph_editor_store.js';
import { compilePaletteAction } from '../../src/constructor/graph_document/graph_ui_palette.js';
import { buildGraphUiPalette } from '../../src/constructor/graph_document/graph_ui_palette.js';
import {
  buildTelegramUpdateFromInboundEvent,
  matchLegacyEventStringRule,
  normalizeInboundEvent,
  resolveEventToPaletteEntry,
  resolveStickerActionEntry,
} from '../../src/constructor/graph_document/palette_event_resolver.js';

const localized = localizeBlockTypes(getPaletteBlockTypes(), 'ru');
const palette = buildGraphUiPalette('ru', { blockTypes: localized });

const voiceEntry = resolveEventToPaletteEntry({ kind: 'voice' }, palette);
assert.ok(voiceEntry);
assert.equal(voiceEntry.id, 'node:on_voice');
assert.equal(voiceEntry.type, 'node');
assert.equal(voiceEntry.paletteKind, 'node');

const stickerEntry = resolveEventToPaletteEntry(
  { kind: 'sticker', stickerId: 'CAAC_test' },
  palette,
);
assert.equal(stickerEntry.id, 'node:on_sticker');

const cmdEntry = resolveEventToPaletteEntry(
  { kind: 'command', command: '/help', text: '/help' },
  palette,
);
assert.equal(cmdEntry.id, 'node:command');
assert.equal(cmdEntry.meta?.eventProps?.cmd, 'help');

const tgVoice = buildTelegramUpdateFromInboundEvent({ kind: 'voice' });
assert.ok(tgVoice.message?.voice?.file_id);

const legacy = matchLegacyEventStringRule('удалить "мой_ключ"');
assert.ok(legacy);
assert.equal(legacy.paletteId, 'node:db_delete');
assert.equal(legacy.props.key, 'мой_ключ');

const legacyEntry = resolveEventToPaletteEntry('удалить "мой_ключ"', palette);
assert.equal(legacyEntry.id, 'node:db_delete');

const stickerAction = resolveStickerActionEntry('CAACAgIAAxk', palette);
assert.equal(stickerAction.id, 'node:sticker');
assert.equal(stickerAction.meta?.eventProps?.file_id, 'CAACAgIAAxk');

const textNorm = normalizeInboundEvent({ message: { text: '/start', chat: { id: 1 }, from: { id: 1 } } });
assert.equal(textNorm.kind, 'start');

const store = createGraphEditorStore();
const graph = { dispatch: (...a) => store.dispatch(...a) };
const messageEntry = resolveEventToPaletteEntry({ kind: 'text', text: 'hi' }, palette);
const block = {
  id: 'n_evt_test',
  type: 'message',
  props: { text: 'test' },
  uiAttachments: {},
};
const compiled = compilePaletteAction(messageEntry, { x: 10, y: 20, block });
assert.equal(compiled.ok, true);
assert.equal(applyComposition(graph, compiled).ok, true);

console.log('test_palette_event_resolver.js: ok');
