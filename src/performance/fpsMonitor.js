/**
 * rAF-based FPS sampler for canvas performance overlay.
 */

const SAMPLE_MS = 500;

let rafId = 0;
let lastTs = 0;
let frames = 0;
let fps = 60;
let listeners = new Set();

function tick(ts) {
  frames += 1;
  if (!lastTs) lastTs = ts;
  const elapsed = ts - lastTs;
  if (elapsed >= SAMPLE_MS) {
    fps = Math.round((frames * 1000) / elapsed);
    frames = 0;
    lastTs = ts;
    for (const fn of listeners) {
      try { fn(fps); } catch { /* ignore */ }
    }
  }
  rafId = requestAnimationFrame(tick);
}

export function startFpsMonitor() {
  if (rafId) return;
  lastTs = 0;
  frames = 0;
  rafId = requestAnimationFrame(tick);
}

export function stopFpsMonitor() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

export function subscribeFps(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrentFps() {
  return fps;
}
