/**
 * Coalesce multiple state updates into a single animation frame.
 */

const queues = new Map();

const scheduleFrame = typeof requestAnimationFrame === 'function'
  ? (fn) => requestAnimationFrame(fn)
  : (fn) => setTimeout(fn, 0);

/**
 * @param {string} key
 * @param {() => void} fn
 */
export function scheduleBatched(key, fn) {
  let q = queues.get(key);
  if (!q) {
    q = { fns: [], scheduled: false };
    queues.set(key, q);
  }
  q.fns.push(fn);
  if (q.scheduled) return;
  q.scheduled = true;
  scheduleFrame(() => {
    const batch = q.fns.splice(0);
    q.scheduled = false;
    for (const run of batch) {
      try { run(); } catch (err) {
        console.warn('[batchedUpdates]', key, err);
      }
    }
  });
}

/**
 * @param {string} key
 * @param {() => void} fn
 */
export function scheduleIdleBatched(key, fn) {
  const run = () => scheduleBatched(key, fn);
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 120 });
  } else {
    setTimeout(run, 0);
  }
}

export function flushBatched(key) {
  const q = queues.get(key);
  if (!q?.fns.length) return;
  const batch = q.fns.splice(0);
  q.scheduled = false;
  for (const run of batch) {
    try { run(); } catch { /* ignore */ }
  }
}
