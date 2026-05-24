/**
 * React hook — GraphEditorStore with dispatch-only mutation contract.
 */

import { useCallback, useRef, useState } from 'react';
import { createGraphEditorStore } from './graph_editor_store.js';

/**
 * @param {object} [options]
 * @param {object} [options.seed] — initial GraphDocument seed
 */
export function useGraphEditor(options = {}) {
  const storeRef = useRef(null);
  if (!storeRef.current) {
    storeRef.current = createGraphEditorStore(options.seed);
  }

  const [, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  const store = storeRef.current;

  const dispatch = useCallback(
    (operationOrType, payload, meta) => {
      const result = store.dispatch(operationOrType, payload, meta);
      if (result.ok) refresh();
      return result;
    },
    [store, refresh],
  );

  const undo = useCallback(() => {
    const result = store.undo();
    refresh();
    return result;
  }, [store, refresh]);

  const redo = useCallback(() => {
    const result = store.redo();
    refresh();
    return result;
  }, [store, refresh]);

  const setViewport = useCallback(
    (viewport) => {
      const result = store.setViewport(viewport);
      if (result.ok) refresh();
      return result;
    },
    [store, refresh],
  );

  const resetGraphDocument = useCallback(
    (seedDocument = {}) => {
      const result = store.resetHistory(seedDocument);
      refresh();
      return result;
    },
    [store, refresh],
  );

  const actionsRef = useRef({
    dispatch,
    undo,
    redo,
    setViewport,
    resetGraphDocument,
  });
  actionsRef.current = {
    dispatch,
    undo,
    redo,
    setViewport,
    resetGraphDocument,
  };

  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = {
      getGraphDocument: () => storeRef.current.getGraphDocument(),
      getCanvasProjection: () => storeRef.current.getCanvasProjection(),
      dispatch: (...args) => actionsRef.current.dispatch(...args),
      undo: () => actionsRef.current.undo(),
      redo: () => actionsRef.current.redo(),
      setViewport: (...args) => actionsRef.current.setViewport(...args),
      resetGraphDocument: (...args) => actionsRef.current.resetGraphDocument(...args),
    };
  }

  return apiRef.current;
}

/** @deprecated use useGraphEditor */
export const useGraphEditorStore = useGraphEditor;
