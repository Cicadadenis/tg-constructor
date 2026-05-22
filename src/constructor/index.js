/**
 * Graph Execution IDE — UI-only constructor layer.
 *
 * Builder does NOT execute code. Builder does NOT know NativeOps.
 */

export { ConstructorMode, MODE_LABELS } from './modes.js';
export { GraphIRAdapter, createEmptyGraphIR } from './graphIrAdapter.js';
export { EngineClient, defaultEngineClient } from './engineClient.js';
export {
  parseLevel0Trace,
  buildTimeline,
  highlightNodesFromTrace,
  extractSuspendResume,
  attachPerformanceOverlay,
  replayIndexFromEvents,
} from './traceViewer.js';
export { runDebugExecution } from './previewBridge.js';
export { buildPreviewCodegenSnapshot } from './previewCodegenBridge.js';
export { checkUiImport, assertUiImportAllowed, findForbiddenImportsInSource } from './uiLayerGuard.js';
export {
  createGraphDocument,
  createGraphEditorStore,
  GraphEditorStore,
  createOperation,
  applyOperation,
  applyHistoryOperation,
  applyOperationWithRestores,
  rollbackOperation,
  redoOperation,
  replayOperations,
  exportGraphDocument,
  importGraphDocument,
  migrateSchema,
  validateGraphDocument,
  GraphDocumentValidator,
  projectGraphDocumentToCanvas,
  canvasEventToOperation,
  assertNoDirectGraphMutation,
  assertNoCanvasOwnedGraphState,
  stacksToGraphDocument,
  graphDocumentToStacks,
  graphDocumentToGraphIR,
  useGraphEditor,
  useGraphEditorStore,
  loadPersistedCanvasBlob,
  persistCanvasBlob,
  migrateGraphDocument,
  mergeOperationStreams,
  repairCallbackHandlersInStacks,
} from './graph_document/index.js';
