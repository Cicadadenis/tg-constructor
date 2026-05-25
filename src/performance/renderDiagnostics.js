/**
 * Lightweight render / commit diagnostics (production-safe, no React DevTools required).
 */

const MAX_SAMPLES = 32;

const state = {
  canvasRenders: 0,
  nodeSyncs: 0,
  edgeSyncs: 0,
  selectionUpdates: 0,
  skippedSyncs: 0,
  lastSyncMs: 0,
  samples: [],
};

export function recordCanvasRender() {
  state.canvasRenders += 1;
}

export function recordNodeSync(ms = 0) {
  state.nodeSyncs += 1;
  state.lastSyncMs = ms;
  pushSample('node', ms);
}

export function recordEdgeSync(ms = 0) {
  state.edgeSyncs += 1;
  pushSample('edge', ms);
}

export function recordSelectionUpdate() {
  state.selectionUpdates += 1;
}

export function recordSkippedSync() {
  state.skippedSyncs += 1;
}

function pushSample(kind, ms) {
  state.samples.push({ kind, ms, ts: Date.now() });
  if (state.samples.length > MAX_SAMPLES) {
    state.samples.splice(0, state.samples.length - MAX_SAMPLES);
  }
}

export function getRenderDiagnostics() {
  const avgSync = state.samples.length
    ? Math.round(state.samples.reduce((a, s) => a + s.ms, 0) / state.samples.length)
    : 0;
  return {
    ...state,
    avgSyncMs: avgSync,
  };
}

export function resetRenderDiagnostics() {
  state.canvasRenders = 0;
  state.nodeSyncs = 0;
  state.edgeSyncs = 0;
  state.selectionUpdates = 0;
  state.skippedSyncs = 0;
  state.lastSyncMs = 0;
  state.samples = [];
}
