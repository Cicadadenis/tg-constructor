import { createImmerStore } from './createStore.js';
import { createSelectors } from './createSelectors.js';
import { normalizeFlowLayoutMode } from '../builder/flowLayout/flowLayoutModes.js';

function readLayoutMode() {
  if (typeof window === 'undefined') return 'AUTO';
  try {
    return normalizeFlowLayoutMode(localStorage.getItem('cicada-flow-layout-mode'));
  } catch {
    return 'AUTO';
  }
}

export const useFlowStore = createImmerStore((set) => ({
  projectName: '',
  activeProjectId: null,
  serverRunProjectId: null,
  flowLayoutMode: readLayoutMode(),
  userProjects: [],
  projectsLoading: false,

  patch: (partial) => set((s) => {
    Object.assign(s, partial);
  }),

  setFlowLayoutMode: (mode) => {
    const normalized = normalizeFlowLayoutMode(mode);
    set((s) => {
      s.flowLayoutMode = normalized;
    });
    try {
      localStorage.setItem('cicada-flow-layout-mode', normalized);
    } catch { /* ignore */ }
    return normalized;
  },

  setActiveProject: (id, name) => set((s) => {
    s.activeProjectId = id ?? null;
    if (name !== undefined) s.projectName = name ?? '';
  }),
}), 'flow');

export const flowSelectors = createSelectors(useFlowStore);

export const selectAnalyticsFlowId = (s) => s.activeProjectId || 'draft-flow';
