import { createImmerStore } from '../../stores/createStore.js';
import { createSelectors } from '../../stores/createSelectors.js';

/**
 * Flow editor canvas UI state — viewport chrome, panels, tools.
 * Viewport actions are registered by GraphFlowInner (inside ReactFlowProvider).
 */
export const useCanvasStateStore = createImmerStore((set, get) => ({
  showMinimap: true,
  showGrid: true,
  edgeAnimations: true,
  zoomPercent: 100,
  isPanning: false,
  isConnecting: false,
  /** @type {{ fit?: () => void, zoomIn?: () => void, zoomOut?: () => void, reset?: () => void } | null} */
  viewportActions: null,

  setViewportActions: (actions) => set((s) => {
    s.viewportActions = actions;
  }),

  setZoomPercent: (pct) => set((s) => {
    s.zoomPercent = Math.round(pct);
  }),

  patch: (partial) => set((s) => {
    Object.assign(s, partial);
  }),

  toggleMinimap: () => set((s) => {
    s.showMinimap = !s.showMinimap;
  }),

  toggleGrid: () => set((s) => {
    s.showGrid = !s.showGrid;
  }),
}), 'flowCanvas');

export const canvasStateSelectors = createSelectors(useCanvasStateStore);
