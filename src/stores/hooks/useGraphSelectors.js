import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useGraphStore, selectGraphRevision, selectGraphHistory } from '../graphStore.js';
import { useShallow } from 'zustand/react/shallow';

/**
 * Fine-grained graph revision subscription — avoids App-wide rerenders.
 */
export function useGraphRevision() {
  return useGraphStore(selectGraphRevision);
}

export function useGraphHistory() {
  return useGraphStore(useShallow(selectGraphHistory));
}

/**
 * Memoized canvas projection — only updates when revision changes.
 */
export function useCanvasProjection() {
  const revision = useGraphRevision();
  return useMemo(() => {
    void revision;
    return useGraphStore.getState().getCanvasProjection();
  }, [revision]);
}

/**
 * Stable graph API ref object (dispatch/undo/redo) — same contract as legacy useGraphEditor.
 */
export function useGraphApi() {
  const revision = useGraphRevision();
  const historyCursor = useGraphStore((s) => s.historyCursor);

  return useMemo(() => {
    void revision;
    void historyCursor;
    return useGraphStore.getState().getGraphApi();
  }, [revision, historyCursor]);
}

/**
 * Subscribe to graph store slice with useSyncExternalStore (SSR-safe noop).
 */
export function useGraphStoreSlice(selector) {
  const subscribe = useCallback(
    (onChange) => useGraphStore.subscribe(selector, onChange),
    [selector],
  );
  const getSnapshot = useCallback(
    () => selector(useGraphStore.getState()),
    [selector],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
