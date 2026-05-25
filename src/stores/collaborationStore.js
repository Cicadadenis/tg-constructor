import { createImmerStore } from './createStore.js';
import { createSelectors } from './createSelectors.js';

/**
 * Collaboration slice — presence, locks, remote cursors (extensible).
 */
export const useCollaborationStore = createImmerStore((set) => ({
  enabled: false,
  roomId: null,
  peers: [],
  localPresence: { status: 'idle', cursor: null },
  pendingRemoteOps: [],
  optimisticQueue: [],

  patch: (partial) => set((s) => {
    Object.assign(s, partial);
  }),

  setRoom: (roomId) => set((s) => {
    s.roomId = roomId ?? null;
    s.enabled = Boolean(roomId);
  }),

  setPeers: (peers) => set((s) => {
    s.peers = Array.isArray(peers) ? peers : [];
  }),

  enqueueOptimistic: (op) => set((s) => {
    s.optimisticQueue.push({
      id: op.id || `opt_${Date.now()}`,
      ts: Date.now(),
      op,
      status: 'pending',
    });
    if (s.optimisticQueue.length > 100) {
      s.optimisticQueue.splice(0, s.optimisticQueue.length - 100);
    }
  }),

  resolveOptimistic: (id, status = 'acked') => set((s) => {
    const item = s.optimisticQueue.find((q) => q.id === id);
    if (item) item.status = status;
  }),
}), 'collaboration');

export const collaborationSelectors = createSelectors(useCollaborationStore);
