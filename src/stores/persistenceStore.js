import { createImmerStore } from './createStore.js';
import { createSelectors } from './createSelectors.js';

/**
 * Autosave + cloud persistence + optimistic update queue status.
 */
export const usePersistenceStore = createImmerStore((set) => ({
  canvasStorageKey: '',
  lastSavedRevision: -1,
  isLoading: false,
  isSaving: false,
  saveError: null,
  pendingCloudSave: false,
  optimisticPatches: [],
  lastPersistedAt: null,

  setCanvasKey: (key) => set((s) => {
    s.canvasStorageKey = key ?? '';
  }),

  beginLoad: () => set((s) => {
    s.isLoading = true;
    s.saveError = null;
  }),

  endLoad: (revision) => set((s) => {
    s.isLoading = false;
    s.lastSavedRevision = revision ?? s.lastSavedRevision;
  }),

  beginSave: () => set((s) => {
    s.isSaving = true;
    s.saveError = null;
  }),

  endSave: (revision) => set((s) => {
    s.isSaving = false;
    s.lastSavedRevision = revision ?? s.lastSavedRevision;
    s.lastPersistedAt = Date.now();
    s.pendingCloudSave = false;
  }),

  setSaveError: (error) => set((s) => {
    s.isSaving = false;
    s.saveError = error ? String(error) : null;
  }),

  enqueueOptimisticPatch: (patch) => set((s) => {
    s.optimisticPatches.push({
      id: patch.id || `patch_${Date.now()}`,
      ts: Date.now(),
      patch,
    });
    if (s.optimisticPatches.length > 50) {
      s.optimisticPatches.splice(0, s.optimisticPatches.length - 50);
    }
    s.pendingCloudSave = true;
  }),

  clearOptimistic: () => set((s) => {
    s.optimisticPatches = [];
    s.pendingCloudSave = false;
  }),
}), 'persistence');

export const persistenceSelectors = createSelectors(usePersistenceStore);
