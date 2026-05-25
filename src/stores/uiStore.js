import { createImmerStore } from './createStore.js';
import { createSelectors } from './createSelectors.js';

const initial = {
  appSection: 'flows',
  mobileZone: 'canvas',
  inspectorTab: 'content',
  listSearch: '',
  listFilter: 'all',
  isMobileView: typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 768px)').matches
    : false,
  mobileMoreOpen: false,
  showFilesMenu: false,
  tourActive: false,
  tourStep: 0,
  showInstructions: false,
  showExamples: false,
  showLibrary: false,
  showAIModal: false,
  aiPrompt: '',
  aiLoading: false,
  aiLoadingStep: 0,
  aiError: '',
  aiPartialResult: null,
  aiDiagnosticsOpen: false,
  landingInfoPage: null,
  proMonthlyUsd: null,
  showAuthModal: typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('login') === '1'
    : false,
  showProfileModal: false,
  profileInitialTab: 'profile',
  authTab: 'login',
  oauth2faPending: false,
  debugTraceOpen: false,
  debugCodegenSnapshot: null,
  debugCodegenSnapshot: null,
  botDebugOpen: false,
  graphDiagOpen: false,
  graphStrictMode: (() => {
    try {
      return localStorage.getItem('cicada_graph_strict') === '1';
    } catch {
      return false;
    }
  })(),
  toast: null,
  examplesMenuRect: null,
  filesMenuRect: null,
  fullValidationBusy: false,
  fullValidationResult: null,
  validationOverlayActive: false,
  repairBusy: false,
  lastRepairResult: null,
  publishBusy: false,
  /** Hide empty-canvas overlay after user starts dragging from palette */
  canvasOnboardingDismissed: false,
};

export const useUiStore = createImmerStore((set, get) => ({
  ...initial,

  patch: (partial) => set((s) => {
    Object.assign(s, partial);
  }),

  showToast: (message, type = 'info') => {
    if (!message) return;
    set((s) => {
      s.toast = { message, type, visible: true };
    });
  },

  hideToast: () => set((s) => {
    if (s.toast) s.toast.visible = false;
  }),

  setGraphStrictMode: (enabled) => {
    set((s) => {
      s.graphStrictMode = Boolean(enabled);
    });
    try {
      localStorage.setItem('cicada_graph_strict', enabled ? '1' : '0');
    } catch { /* ignore */ }
  },

  resetUi: () => set((s) => {
    Object.assign(s, { ...initial, toast: null });
  }),
}), 'ui');

export const uiSelectors = createSelectors(useUiStore);
