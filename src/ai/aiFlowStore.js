import { createImmerStore } from '../stores/createStore.js';

export const useAiFlowStore = createImmerStore((set) => ({
  studioOpen: false,
  copilotOpen: false,
  activeTab: 'generate',
  prompt: '',
  category: 'all',
  loading: false,
  loadingAction: null,
  error: null,
  plan: null,
  suggestions: [],
  hints: [],
  repair: null,
  branches: null,
  copywriting: null,
  diagnostics: [],

  patch: (partial) => set((s) => {
    Object.assign(s, partial);
  }),

  resetAssist: () => set((s) => {
    s.suggestions = [];
    s.hints = [];
    s.repair = null;
    s.branches = null;
    s.copywriting = null;
    s.diagnostics = [];
    s.error = null;
  }),

  openStudio: (tab = 'generate') => set((s) => {
    s.studioOpen = true;
    s.activeTab = tab;
  }),

  closeStudio: () => set((s) => {
    s.studioOpen = false;
    s.loading = false;
  }),
}), 'aiFlow');
