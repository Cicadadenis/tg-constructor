/**
 * Graph editor hook — backed by Zustand graphStore (fine-grained subscriptions).
 */

import { useEffect, useRef } from 'react';
import { useGraphStore } from '../../stores/graphStore.js';
import { useGraphApi, useGraphRevision } from '../../stores/hooks/useGraphSelectors.js';

/**
 * @param {object} [options]
 * @param {object} [options.seed] — initial GraphDocument seed
 */
export function useGraphEditor(options = {}) {
  const initialized = useGraphStore((s) => s.initialized);
  const seedRef = useRef(options.seed);

  useEffect(() => {
    if (!initialized) {
      useGraphStore.getState().init(seedRef.current || {});
    }
  }, [initialized]);

  useGraphRevision();
  const api = useGraphApi();
  return api;
}

/** @deprecated use useGraphEditor */
export const useGraphEditorStore = useGraphEditor;
