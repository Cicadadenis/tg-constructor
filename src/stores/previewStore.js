import { createImmerStore } from './createStore.js';
import { createSelectors } from './createSelectors.js';

function readSimulatorDocked() {
  try {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem('cicada_simulator_docked');
    return v !== '0';
  } catch {
    return true;
  }
}

export const usePreviewStore = createImmerStore((set) => ({
  previewPanelOpen: true,
  previewPanelPos: null,
  /** Desktop: embed simulator in right inspector instead of floating panel */
  simulatorDocked: readSimulatorDocked(),
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

  setSimulatorDocked: (docked) => set((s) => {
    s.simulatorDocked = Boolean(docked);
    try {
      localStorage.setItem('cicada_simulator_docked', docked ? '1' : '0');
    } catch { /* ignore */ }
  }),
}), 'preview');

export const previewSelectors = createSelectors(usePreviewStore);
