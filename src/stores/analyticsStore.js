import { createImmerStore } from './createStore.js';
import { createSelectors } from './createSelectors.js';

export const useAnalyticsStore = createImmerStore((set) => ({
  panelOpen: false,
  panelPos: null,
  snapshotCache: null,
  snapshotTs: 0,
  streamConnected: false,

  setPanelOpen: (open) => set((s) => {
    s.panelOpen = Boolean(open);
  }),

  setPanelPos: (pos) => set((s) => {
    s.panelPos = pos ?? null;
  }),

  setSnapshot: (snapshot) => set((s) => {
    s.snapshotCache = snapshot ?? null;
    s.snapshotTs = Date.now();
  }),

  setStreamConnected: (connected) => set((s) => {
    s.streamConnected = Boolean(connected);
  }),
}), 'analytics');

export const analyticsSelectors = createSelectors(useAnalyticsStore);
