import { useEffect } from 'react';
import { useGraphStore } from '../stores/graphStore.js';
import { captureHistoryOnMutation, subscribePersistenceDirty } from '../stores/graphSubscriptions.js';

/**
 * Bootstraps graph store + time-travel capture. Mount once inside App.
 */
export function StoreProvider({ children, graphSeed }) {
  const initialized = useGraphStore((s) => s.initialized);

  useEffect(() => {
    if (!initialized) {
      useGraphStore.getState().init(graphSeed || {});
    }
  }, [initialized, graphSeed]);

  useEffect(() => {
    const unsubHistory = captureHistoryOnMutation();
    const unsubDirty = subscribePersistenceDirty();
    return () => {
      unsubHistory();
      unsubDirty();
    };
  }, []);

  return children;
}
