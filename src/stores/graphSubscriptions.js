import { useGraphStore } from './graphStore.js';
import { useHistoryStore } from './historyStore.js';
import { usePersistenceStore } from './persistenceStore.js';

/**
 * Subscribe to graph revision bumps (autosave, time-travel capture).
 * @param {(revision: number) => void} listener
 * @returns {() => void}
 */
export function subscribeGraphRevision(listener) {
  return useGraphStore.subscribe(
    (s) => s.revision,
    (revision, prev) => {
      if (revision !== prev) listener(revision, prev);
    },
  );
}

let captureDebounce = null;

/**
 * Auto-capture history snapshots on graph mutations (time-travel debugging).
 */
export function captureHistoryOnMutation() {
  return subscribeGraphRevision((revision) => {
    const hist = useHistoryStore.getState();
    if (!hist.recording || hist.timeTravelEnabled) return;
    if (captureDebounce) clearTimeout(captureDebounce);
    captureDebounce = setTimeout(() => {
      captureDebounce = null;
      const last = hist.snapshots[hist.snapshots.length - 1];
      if (last?.revision === revision) return;
      hist.captureSnapshot();
    }, 400);
  });
}

/**
 * Mark persistence dirty when revision changes (used by autosave hook).
 */
export function subscribePersistenceDirty() {
  return subscribeGraphRevision((revision) => {
    const p = usePersistenceStore.getState();
    if (p.isLoading || p.isSaving) return;
    if (revision === p.lastSavedRevision) return;
    usePersistenceStore.setState((s) => {
      s.pendingCloudSave = true;
    });
  });
}
