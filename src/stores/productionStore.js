import { createImmerStore } from './createStore.js';

export const useProductionStore = createImmerStore((set) => ({
  hubOpen: false,
  hubTab: 'overview',
  versionTick: 0,

  openHub: (tab = 'overview') => set((s) => {
    s.hubOpen = true;
    s.hubTab = tab;
  }),

  closeHub: () => set((s) => {
    s.hubOpen = false;
  }),

  setHubTab: (tab) => set((s) => {
    s.hubTab = tab;
  }),

  bumpVersions: () => set((s) => {
    s.versionTick += 1;
  }),
}), 'production');
