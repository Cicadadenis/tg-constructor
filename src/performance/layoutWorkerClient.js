/**
 * Client for flow layout web worker.
 */

const LAYOUT_WORKER_THRESHOLD = 36;
let worker = null;
let requestSeq = 0;
/** @type {Map<number, { resolve: Function, reject: Function }>} */
const inflight = new Map();

function getWorker() {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(
      new URL('../workers/flowLayout.worker.js', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (e) => {
      const { requestId, ok, positions, mode, error } = e.data || {};
      const pending = inflight.get(requestId);
      if (!pending) return;
      inflight.delete(requestId);
      if (ok) {
        pending.resolve({
          positions: new Map(positions),
          mode,
        });
      } else {
        pending.reject(new Error(error || 'layout worker failed'));
      }
    };
    worker.onerror = (err) => {
      for (const [, p] of inflight) p.reject(err);
      inflight.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

export function shouldUseLayoutWorker(nodeCount) {
  return nodeCount >= LAYOUT_WORKER_THRESHOLD && typeof Worker !== 'undefined';
}

/**
 * @param {object} document
 * @param {string} mode
 * @returns {Promise<{ positions: Map<string, { x: number, y: number }>, mode: string }>}
 */
export function computeLayoutInWorker(document, mode) {
  const w = getWorker();
  if (!w) {
    return Promise.reject(new Error('layout worker unavailable'));
  }
  const requestId = ++requestSeq;
  return new Promise((resolve, reject) => {
    inflight.set(requestId, { resolve, reject });
    w.postMessage({ requestId, document, mode });
  });
}

export { LAYOUT_WORKER_THRESHOLD };
