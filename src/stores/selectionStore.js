import { createImmerStore } from './createStore.js';
import { createSelectors } from './createSelectors.js';

export const useSelectionStore = createImmerStore((set) => ({
  selectedBlockId: null,
  mobileAttentionBlockId: null,
  draggingPaletteEntry: null,
  repairHighlight: {
    nodeIds: [],
    edgeIds: [],
    until: 0,
    kind: null,
  },
  /** { nodeId: string, seq: number } — pan canvas to node after palette add */
  canvasFocusRequest: null,
  /** { seq: number } — open right inspector (even if hidden / focus mode) */
  inspectorRevealRequest: null,

  requestInspectorReveal: () => set((s) => {
    const prev = s.inspectorRevealRequest?.seq ?? 0;
    s.inspectorRevealRequest = { seq: prev + 1 };
  }),

  requestCanvasFocus: (nodeId) => set((s) => {
    if (!nodeId) return;
    const prev = s.canvasFocusRequest?.seq ?? 0;
    s.canvasFocusRequest = { nodeId: String(nodeId), seq: prev + 1 };
  }),

  clearCanvasFocus: () => set((s) => {
    s.canvasFocusRequest = null;
  }),

  selectNode: (nodeId) => set((s) => {
    s.selectedBlockId = nodeId ?? null;
  }),

  clearSelection: () => set((s) => {
    s.selectedBlockId = null;
    s.mobileAttentionBlockId = null;
  }),

  setDraggingPaletteEntry: (entry) => set((s) => {
    s.draggingPaletteEntry = entry ?? null;
  }),

  setMobileAttention: (nodeId) => set((s) => {
    s.mobileAttentionBlockId = nodeId ?? null;
  }),

  setRepairHighlight: (payload) => set((s) => {
    s.repairHighlight = {
      nodeIds: payload?.nodeIds || [],
      edgeIds: payload?.edgeIds || [],
      until: payload?.until ?? 0,
      kind: payload?.kind ?? null,
    };
  }),

  clearRepairHighlight: () => set((s) => {
    s.repairHighlight = { nodeIds: [], edgeIds: [], until: 0, kind: null };
  }),
}), 'selection');

export const selectionSelectors = createSelectors(useSelectionStore);

const INACTIVE_REPAIR_HIGHLIGHT = Object.freeze({
  nodeIds: [],
  edgeIds: [],
  kind: null,
  active: false,
});

export const selectActiveRepairHighlight = (s) => {
  const h = s.repairHighlight;
  if (!h?.until || h.until <= Date.now()) {
    return INACTIVE_REPAIR_HIGHLIGHT;
  }
  return {
    nodeIds: h.nodeIds,
    edgeIds: h.edgeIds,
    kind: h.kind,
    active: true,
  };
};
