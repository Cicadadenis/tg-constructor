/**
 * Palette helpers — block drag-and-drop from sidebar to ReactFlow canvas.
 * Resolves palette entries to graph AddNode operations.
 * No stack-based snap logic.
 */

export {
  buildGraphUiPalette,
  compilePaletteAction,
  getPaletteEntry,
  assertPaletteIntegrity,
} from '../../constructor/graph_document/graph_ui_palette.js';

export {
  normalizeInboundEvent,
  resolveEventToPaletteEntry,
} from '../../constructor/graph_document/palette_event_resolver.js';
