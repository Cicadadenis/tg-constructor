import { createImmerStore } from './createStore.js';
import { createSelectors } from './createSelectors.js';
import { useGraphStore } from './graphStore.js';

const MAX_SNAPSHOTS = 48;

/**
 * Time-travel debugging — snapshots of graph revision + history cursor.
 */
export const useHistoryStore = createImmerStore((set, get) => ({
  snapshots: [],
  activeSnapshotId: null,
  timeTravelEnabled: false,
  recording: true,

  captureSnapshot: (label = '') => {
    const graph = useGraphStore.getState();
    const doc = graph.getGraphDocument();
    const hist = graph.getHistoryState();
    const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((s) => {
      s.snapshots.push({
        id,
        label: label || `rev ${doc.metadata.revision}`,
        ts: Date.now(),
        revision: doc.metadata.revision,
        historyCursor: hist.cursor,
        document: structuredClone(doc),
      });
      if (s.snapshots.length > MAX_SNAPSHOTS) {
        s.snapshots.splice(0, s.snapshots.length - MAX_SNAPSHOTS);
      }
      s.activeSnapshotId = id;
    });
    return id;
  },

  travelTo: (snapshotId) => {
    const snap = get().snapshots.find((x) => x.id === snapshotId);
    if (!snap?.document) return { ok: false, error: 'snapshot not found' };
    set((s) => {
      s.activeSnapshotId = snapshotId;
      s.timeTravelEnabled = true;
    });
    const result = useGraphStore.getState().resetGraphDocument(snap.document);
    return { ok: result.ok, snapshotId };
  },

  exitTimeTravel: () => set((s) => {
    s.timeTravelEnabled = false;
    s.activeSnapshotId = null;
  }),

  clearSnapshots: () => set((s) => {
    s.snapshots = [];
    s.activeSnapshotId = null;
    s.timeTravelEnabled = false;
  }),

  setRecording: (on) => set((s) => {
    s.recording = Boolean(on);
  }),
}), 'history');

export const historySelectors = createSelectors(useHistoryStore);
