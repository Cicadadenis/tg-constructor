/**
 * GraphEditorStore — single mutation entry for constructor UI (operation-driven).
 */

import { createGraphDocument } from './graph_document.js';
import {
  applyOperation as applyToHistory,
  createGraphHistory,
  describeHistoryStream,
  exportOperationStream,
  jumpToHistoryCursor,
  redoOperation,
  rollbackOperation,
} from './graph_history.js';
import { createOperation } from './graph_operations.js';
import { markCanvasProjection } from './graph_mutation_guard.js';
import { projectGraphDocumentToCanvas } from './graph_projection.js';
import { validateGraphDocument } from './graph_validator.js';

export class GraphEditorStore {
  constructor(seed = {}) {
    this._history = createGraphHistory(seed);
  }

  get document() {
    return this._history.document;
  }

  getGraphDocument() {
    return this.document;
  }

  get history() {
    return this._history;
  }

  get operationStream() {
    return exportOperationStream(this._history);
  }

  dispatch(operationOrType, payload, meta) {
    const op = typeof operationOrType === 'string'
      ? createOperation(operationOrType, payload, meta)
      : operationOrType;
    this._history = applyToHistory(this._history, op);
    return {
      ok: !this._history.lastError,
      document: this._history.document,
      error: this._history.lastError,
    };
  }

  undo() {
    this._history = rollbackOperation(this._history);
    return { ok: !this._history.lastError, document: this._history.document, error: this._history.lastError };
  }

  redo() {
    this._history = redoOperation(this._history);
    return { ok: !this._history.lastError, document: this._history.document, error: this._history.lastError };
  }

  canUndo() {
    return Number(this._history?.cursor ?? 0) > 0;
  }

  canRedo() {
    const cursor = Number(this._history?.cursor ?? 0);
    const len = this._history?.stream?.length ?? 0;
    return cursor < len;
  }

  getHistoryState() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      cursor: Number(this._history?.cursor ?? 0),
      length: this._history?.stream?.length ?? 0,
    };
  }

  getHistoryEntries() {
    return describeHistoryStream(this._history);
  }

  jumpToHistoryCursor(targetCursor) {
    const result = jumpToHistoryCursor(this._history, targetCursor);
    this._history = result.history;
    return {
      ok: result.ok,
      document: this._history.document,
      error: result.error,
    };
  }

  getCanvasProjection() {
    return markCanvasProjection(projectGraphDocumentToCanvas(this.document));
  }

  setViewport(viewport) {
    return this.dispatch('UpdateViewport', viewport);
  }

  validate(options) {
    return validateGraphDocument(this.document, options);
  }

  /** Replace document + clear undo/redo stream (corruption recovery / hard reset). */
  resetHistory(seedDocument = {}) {
    this._history = createGraphHistory(seedDocument);
    return { ok: true, document: this.document, error: null };
  }
}

export function createGraphEditorStore(seed) {
  return new GraphEditorStore(seed);
}
