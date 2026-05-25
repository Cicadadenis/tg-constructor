import React, { useEffect } from 'react';
import { usePerformanceStore } from './performanceStore.js';
import { getRenderDiagnostics } from './renderDiagnostics.js';
import { subscribeFps, startFpsMonitor, stopFpsMonitor } from './fpsMonitor.js';
import './canvas-performance.css';

/**
 * FPS + render diagnostics HUD (dev / __CICADA_PERF__).
 */
export default function CanvasPerformanceOverlay() {
  const open = usePerformanceStore((s) => s.overlayOpen);
  const fps = usePerformanceStore((s) => s.fps);
  const zoom = usePerformanceStore((s) => s.zoom);
  const zoomTier = usePerformanceStore((s) => s.zoomTier);
  const nodeCount = usePerformanceStore((s) => s.nodeCount);
  const edgeCount = usePerformanceStore((s) => s.edgeCount);
  const onlyVisible = usePerformanceStore((s) => s.onlyVisible);
  const isDragging = usePerformanceStore((s) => s.isDragging);
  const lastLayoutMs = usePerformanceStore((s) => s.lastLayoutMs);
  const metrics = {
    fps,
    zoom,
    zoomTier,
    nodeCount,
    edgeCount,
    onlyVisible,
    isDragging,
    lastLayoutMs,
  };

  useEffect(() => {
    if (!open) {
      stopFpsMonitor();
      return undefined;
    }
    startFpsMonitor();
    return subscribeFps((fps) => {
      usePerformanceStore.getState().patch({ fps });
    });
  }, [open]);

  if (!open) return null;

  const diag = getRenderDiagnostics();

  return (
    <div className="canvas-perf" role="status" aria-live="polite">
      <div className="canvas-perf__head">
        <span>Performance</span>
        <button
          type="button"
          className="canvas-perf__close"
          onClick={() => usePerformanceStore.getState().toggleOverlay()}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <dl className="canvas-perf__grid">
        <dt>FPS</dt>
        <dd className={metrics.fps < 45 ? 'canvas-perf--warn' : ''}>{metrics.fps}</dd>
        <dt>Zoom</dt>
        <dd>{metrics.zoom.toFixed(2)} ({metrics.zoomTier})</dd>
        <dt>Nodes</dt>
        <dd>{metrics.nodeCount}</dd>
        <dt>Edges</dt>
        <dd>{metrics.edgeCount}</dd>
        <dt>Virtualized</dt>
        <dd>{metrics.onlyVisible ? 'yes' : 'no'}</dd>
        <dt>Canvas renders</dt>
        <dd>{diag.canvasRenders}</dd>
        <dt>Node syncs</dt>
        <dd>{diag.nodeSyncs} ({diag.avgSyncMs}ms avg)</dd>
        <dt>Selection fast</dt>
        <dd>{diag.selectionUpdates}</dd>
        <dt>Skipped syncs</dt>
        <dd>{diag.skippedSyncs}</dd>
        <dt>Layout</dt>
        <dd>{metrics.lastLayoutMs ? `${metrics.lastLayoutMs}ms` : '—'}</dd>
        <dt>Drag</dt>
        <dd>{metrics.isDragging ? 'active' : '—'}</dd>
      </dl>
    </div>
  );
}
