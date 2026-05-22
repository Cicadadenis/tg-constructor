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
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  const store = storeRef.current;

  const getGraphDocument = useCallback(() => store.getGraphDocument(), [revision]);
  const getCanvasProjection = useCallback(() => store.getCanvasProjection(), [revision]);

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

  // Stable object identity — App effects must not re-run on every graph revision.
  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = {
      getGraphDocument,
      getCanvasProjection,
      dispatch,
      undo,
      redo,
      setViewport,
      resetGraphDocument,
    };
  } else {
    apiRef.current.getGraphDocument = getGraphDocument;
    apiRef.current.getCanvasProjection = getCanvasProjection;
    apiRef.current.dispatch = dispatch;
    apiRef.current.undo = undo;
    apiRef.current.redo = redo;
    apiRef.current.setViewport = setViewport;
    apiRef.current.resetGraphDocument = resetGraphDocument;
  }
  return apiRef.current;
}

/** @deprecated use useGraphEditor */
export const useGraphEditorStore = useGraphEditor;
