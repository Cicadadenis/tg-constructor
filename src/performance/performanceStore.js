import { createImmerStore } from '../stores/createStore.js';

export const usePerformanceStore = createImmerStore((set) => ({
  overlayOpen: typeof window !== 'undefined'
    && (import.meta.env?.DEV || window.__CICADA_PERF__ === true),
  fps: 60,
  zoom: 1,
  zoomTier: 'full',
  nodeCount: 0,
  edgeCount: 0,
  onlyVisible: false,
  isDragging: false,
  isPanning: false,
  compileCacheHits: 0,
  lastLayoutMs: 0,

  patch: (partial) => set((s) => {
    Object.assign(s, partial);
  }),

  toggleOverlay: () => set((s) => {
    s.overlayOpen = !s.overlayOpen;
  }),
}), 'performance');
