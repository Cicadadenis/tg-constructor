/**
 * Graph state — GraphEditorStore class lives outside Immer drafts.
 * Subscribers use revision + shallow selectors to avoid full App rerenders.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createGraphEditorStore } from '../constructor/graph_document/graph_editor_store.js';

/** @type {import('../constructor/graph_document/graph_editor_store.js').GraphEditorStore | null} */
let editorInstance = null;

/** @type {{ revision: number, projection: object } | null} */
let projectionCache = null;

function getEditor() {
  if (!editorInstance) {
    editorInstance = createGraphEditorStore({});
  }
  return editorInstance;
}

function readRevision(editor) {
  return editor.getGraphDocument()?.metadata?.revision ?? 0;
}

function readHistory(editor) {
  const h = editor.getHistoryState?.() ?? { canUndo: false, canRedo: false, cursor: 0, length: 0 };
  return h;
}

function invalidateProjection() {
  projectionCache = null;
}

function getProjection(editor, revision) {
  if (projectionCache && projectionCache.revision === revision) {
    return projectionCache.projection;
  }
  const projection = editor.getCanvasProjection();
  projectionCache = { revision, projection };
  return projection;
}

export const useGraphStore = create(
  subscribeWithSelector((set, get) => ({
    revision: 0,
    historyCursor: 0,
    historyLength: 0,
    canUndo: false,
    canRedo: false,
    nodeCount: 0,
    initialized: false,

    init: (seed = {}) => {
      editorInstance = createGraphEditorStore(seed);
      invalidateProjection();
      const editor = editorInstance;
      const hist = readHistory(editor);
      const rev = readRevision(editor);
      set({
        initialized: true,
        revision: rev,
        historyCursor: hist.cursor,
        historyLength: hist.length,
        canUndo: hist.canUndo,
        canRedo: hist.canRedo,
        nodeCount: Object.keys(editor.getGraphDocument().nodes || {}).length,
      });
    },

    _bump: () => {
      const editor = getEditor();
      const hist = readHistory(editor);
      const rev = readRevision(editor);
      invalidateProjection();
      set({
        revision: rev,
        historyCursor: hist.cursor,
        historyLength: hist.length,
        canUndo: hist.canUndo,
        canRedo: hist.canRedo,
        nodeCount: Object.keys(editor.getGraphDocument().nodes || {}).length,
      });
      return rev;
    },

    dispatch: (operationOrType, payload, meta) => {
      const editor = getEditor();
      const result = editor.dispatch(operationOrType, payload, meta);
      if (result.ok) get()._bump();
      return result;
    },

    /** Batch multiple dispatches → single revision bump (fewer React rerenders). */
    dispatchBatch: (operations = []) => {
      const editor = getEditor();
      let last = { ok: true, document: editor.getGraphDocument(), error: null };
      for (const item of operations) {
        const type = item?.type ?? item?.op;
        if (!type) continue;
        last = editor.dispatch(type, item.payload, item.meta);
        if (!last.ok) break;
      }
      if (operations.length && last.ok) get()._bump();
      return last;
    },

    undo: () => {
      const editor = getEditor();
      const result = editor.undo();
      get()._bump();
      return result;
    },

    redo: () => {
      const editor = getEditor();
      const result = editor.redo();
      get()._bump();
      return result;
    },

    setViewport: (viewport) => {
      const editor = getEditor();
      const revBefore = readRevision(editor);
      const result = editor.setViewport(viewport);
      if (result.ok && readRevision(editor) !== revBefore) get()._bump();
      return result;
    },

    resetGraphDocument: (seedDocument = {}) => {
      const editor = getEditor();
      const result = editor.resetHistory(seedDocument);
      get()._bump();
      return result;
    },

    getEditor: () => getEditor(),

    getGraphDocument: () => getEditor().getGraphDocument(),

    getCanvasProjection: () => {
      const editor = getEditor();
      const rev = readRevision(editor);
      return getProjection(editor, rev);
    },

    getHistoryState: () => readHistory(getEditor()),

    getHistoryEntries: () => getEditor().getHistoryEntries(),

    jumpToHistoryCursor: (target) => {
      const editor = getEditor();
      const result = editor.jumpToHistoryCursor(target);
      if (result.ok) get()._bump();
      return result;
    },

    getGraphApi: () => {
      const store = get();
      return {
        getGraphDocument: () => getEditor().getGraphDocument(),
        getCanvasProjection: () => store.getCanvasProjection(),
        dispatch: (...args) => store.dispatch(...args),
        undo: () => store.undo(),
        redo: () => store.redo(),
        setViewport: (...args) => store.setViewport(...args),
        resetGraphDocument: (...args) => store.resetGraphDocument(...args),
        dispatchBatch: (...args) => store.dispatchBatch(...args),
        canUndo: () => readHistory(getEditor()).canUndo,
        canRedo: () => readHistory(getEditor()).canRedo,
        getHistoryState: () => readHistory(getEditor()),
        getHistoryEntries: () => getEditor().getHistoryEntries(),
        jumpToHistoryCursor: (target) => store.jumpToHistoryCursor(target),
        get historyRevision() {
          return readHistory(getEditor()).cursor;
        },
      };
    },
  })),
);

export const selectGraphRevision = (s) => s.revision;
export const selectGraphHistory = (s) => ({
  canUndo: s.canUndo,
  canRedo: s.canRedo,
  cursor: s.historyCursor,
  length: s.historyLength,
});
export const selectNodeCount = (s) => s.nodeCount;

/** Reset editor singleton (tests). */
export function resetGraphStoreForTests(seed = {}) {
  editorInstance = null;
  projectionCache = null;
  useGraphStore.getState().init(seed);
}
