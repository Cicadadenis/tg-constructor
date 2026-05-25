/**
 * Incremental compilation cache — revision-keyed snapshots, idle scheduling.
 */

const CACHE_MAX = 12;
/** @type {Map<number, { snap: object, ts: number }>} */
const cache = new Map();
let idleId = 0;
/** @type {Map<number, { resolve: Function, reject: Function }>} */
const pending = new Map();

/**
 * @param {object} document
 */
export function documentRevisionKey(document) {
  return Number(document?.metadata?.revision ?? 0);
}

/**
 * @param {object} document
 * @param {() => object} buildSnapshot
 */
export function getIncrementalCompileSnapshot(document, buildSnapshot) {
  const key = documentRevisionKey(document);
  const hit = cache.get(key);
  if (hit) return hit.snap;

  const t0 = performance.now();
  const snap = buildSnapshot();
  const ms = performance.now() - t0;

  cache.set(key, { snap, ts: Date.now() });
  if (cache.size > CACHE_MAX) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]?.[0];
    if (oldest != null) cache.delete(oldest);
  }

  snap._compileMs = Math.round(ms);
  snap._compileRevision = key;
  return snap;
}

/**
 * Schedule compile on idle thread (main thread, non-blocking).
 * @param {object} document
 * @param {() => object} buildSnapshot
 * @returns {Promise<object>}
 */
export function scheduleIncrementalCompile(document, buildSnapshot) {
  const key = documentRevisionKey(document);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit.snap);

  return new Promise((resolve, reject) => {
    const enqueue = (cb) => {
      if (pending.has(key)) {
        pending.get(key).callbacks.push(cb);
        return;
      }
      pending.set(key, { callbacks: [cb] });
      const run = () => {
        try {
          const snap = getIncrementalCompileSnapshot(document, buildSnapshot);
          const entry = pending.get(key);
          for (const c of entry?.callbacks || []) c.resolve(snap);
        } catch (err) {
          const entry = pending.get(key);
          for (const c of entry?.callbacks || []) c.reject(err);
        } finally {
          pending.delete(key);
        }
      };
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 1500 });
      } else {
        setTimeout(run, 0);
      }
    };
    enqueue({ resolve, reject });
  });
}

export function invalidateCompileCache(revision) {
  if (revision == null) {
    cache.clear();
    return;
  }
  cache.delete(Number(revision));
}
