/**
 * useCanvasAutosave — single source of truth for canvas localStorage persistence.
 *
 * Replaces the in-App `skipNextCanvasSave` ref pattern, which only guarded the
 * autosave effect once and missed several load entrypoints (cloud project
 * load, file import, manual hydration). The race manifested as:
 *
 *   1. user clicks an example → loadExampleGraph dispatches operations
 *   2. graph revision bumps → autosave useEffect fires
 *   3. autosave persists the half-loaded document over the user's previous
 *      canvas before all example operations land.
 *
 * The fix is structural:
 *   - any load path opens an `isExampleLoading` window via `beginLoad()`
 *   - the autosave effect short-circuits while the window is open
 *   - the window closes after a single requestAnimationFrame tick, AFTER
 *     React has flushed the post-load render. The closing tick also
 *     advances the "last saved revision" cursor so we never persist a
 *     revision that pre-dates the load.
 *
 * Public API is intentionally narrow:
 *   const { beginLoad, isLoading } = useCanvasAutosave(graph, key, { graphRevision });
 *
 * The hook owns no graph state; it only reads `graph.getCanvasProjection()`
 * indirectly through `saveCanvasForKey`.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  loadCanvasForKey,
  saveCanvasForKey,
} from '../autosave/canvasStorage.js';
import { loadPersistedCanvasBlob } from '../../constructor/graph_document/persist_bridge.js';
import { hydrateGraphFromBlob } from '../hydration/graphHydration.js';
import { clearGraph } from '../../constructor/graph_document/graph_ui_orchestrator.js';

/**
 * @param {object} graph — graph editor API from useGraphEditor()
 * @param {string} canvasStorageKey
 * @param {{ graphRevision: number, onAfterHydrate?: (result) => void }} opts
 * @returns {{ beginLoad: () => () => void, isLoading: () => boolean }}
 */
export function useCanvasAutosave(graph, canvasStorageKey, opts) {
  const { graphRevision, onAfterHydrate } = opts || {};

  // True while a load (example, cloud, file, key change) is in flight.
  // Persisted across re-renders; never touched by render bodies.
  const isExampleLoadingRef = useRef(false);

  // Last revision we have already persisted. Saves are skipped when the
  // current revision equals this cursor — this matters because a load
  // bumps the revision once for migrate, and we want that one bump to
  // be considered "already saved" since the source IS the user-visible
  // canvas after load.
  const lastSavedRevisionRef = useRef(-1);

  /**
   * Open a load window. Caller MUST invoke the returned `done()` after
   * dispatching the load operations. `done()` schedules a microtask that
   * closes the window on the next animation frame so the autosave effect
   * — which fires synchronously after dispatch — sees the flag still
   * raised and skips this tick.
   */
  const beginLoad = useCallback(() => {
    isExampleLoadingRef.current = true;
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      // Defer close past the post-dispatch effect tick.
      const finish = () => {
        isExampleLoadingRef.current = false;
        // Pin the saved-cursor to whatever revision the load produced,
        // so the very next save effect (triggered by this same tick) is
        // a no-op, while subsequent user edits still autosave.
        lastSavedRevisionRef.current = graph.getGraphDocument().metadata.revision;
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(finish);
      } else {
        // SSR / test fallback.
        Promise.resolve().then(finish);
      }
    };
  }, [graph]);

  // Initial hydrate when the storage key changes (new user / logout swap).
  useEffect(() => {
    const done = beginLoad();
    try {
      const raw = loadCanvasForKey(canvasStorageKey);
      if (raw) {
        try {
          const loaded = loadPersistedCanvasBlob(raw);
          const result = hydrateGraphFromBlob(graph, loaded);
          onAfterHydrate?.(result, loaded);
        } catch (err) {
          // Corrupt blob: clear so the user gets a fresh empty canvas
          // rather than a stuck-broken state.
          clearGraph(graph);
          graph.setViewport({ x: 0, y: 0, zoom: 1 });
          onAfterHydrate?.({ ok: false, error: err?.message || 'corrupt blob' });
        }
      } else {
        clearGraph(graph);
        graph.setViewport({ x: 0, y: 0, zoom: 1 });
        onAfterHydrate?.({ ok: true, fresh: true });
      }
    } finally {
      done();
    }
    // graph and onAfterHydrate are stable refs from useGraphEditor / parent
    // useCallback. We re-run only on key change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasStorageKey]);

  // Autosave on revision change, gated by the load window.
  useEffect(() => {
    if (isExampleLoadingRef.current) return;
    if (graphRevision === lastSavedRevisionRef.current) return;
    saveCanvasForKey(canvasStorageKey, graph);
    lastSavedRevisionRef.current = graphRevision;
  }, [canvasStorageKey, graphRevision, graph]);

  const isLoading = useCallback(() => isExampleLoadingRef.current, []);

  return { beginLoad, isLoading };
}
