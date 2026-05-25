import { createImmerStore } from './createStore.js';
import { createSelectors } from './createSelectors.js';

export const usePreviewStore = createImmerStore((set) => ({
  previewPanelOpen: false,
  previewPanelPos: null,
  isSandboxRunning: false,
  isServerRunning: false,
  isStartingSandbox: false,
  isStartingServer: false,
  startBotError: null,
  isStoppingSandbox: false,
  isStoppingServer: false,
  stopBotError: null,
  sandboxSecondsLeft: null,
  botDebugMode: 'sandbox',
  debugTraceId: null,

  patch: (partial) => set((s) => {
    Object.assign(s, partial);
  }),

  setPreviewPanelOpen: (open) => set((s) => {
    s.previewPanelOpen = Boolean(open);
  }),

  setPreviewPanelPos: (pos) => set((s) => {
    s.previewPanelPos = pos ?? null;
  }),
}), 'preview');

export const previewSelectors = createSelectors(usePreviewStore);
