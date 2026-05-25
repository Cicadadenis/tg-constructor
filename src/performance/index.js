export { startFpsMonitor, stopFpsMonitor, subscribeFps, getCurrentFps } from './fpsMonitor.js';
export {
  recordCanvasRender,
  recordNodeSync,
  recordEdgeSync,
  recordSelectionUpdate,
  recordSkippedSync,
  getRenderDiagnostics,
  resetRenderDiagnostics,
} from './renderDiagnostics.js';
export { scheduleBatched, scheduleIdleBatched, flushBatched } from './batchedUpdates.js';
export { zoomToTier, tierAllowsMotion, tierAllowsRichPreview } from './zoomTier.js';
export {
  getIncrementalCompileSnapshot,
  scheduleIncrementalCompile,
  invalidateCompileCache,
  documentRevisionKey,
} from './incrementalCompile.js';
export { computeLayoutInWorker, shouldUseLayoutWorker, LAYOUT_WORKER_THRESHOLD } from './layoutWorkerClient.js';
export { usePerformanceStore } from './performanceStore.js';
export { useBatchedProjectionSync } from './useBatchedProjectionSync.js';
export { default as CanvasPerformanceOverlay } from './CanvasPerformanceOverlay.jsx';
