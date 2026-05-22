/**
 * Lightweight graph integrity telemetry (console + optional hook).
 */

const listeners = new Set();

export function subscribeGraphTelemetry(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * @param {string} event
 * @param {object} [payload]
 */
export function logGraphTelemetry(event, payload = {}) {
  const entry = Object.freeze({
    event,
    payload,
    at: new Date().toISOString(),
  });
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[graph-telemetry]', event, payload);
  }
  for (const fn of listeners) {
    try { fn(entry); } catch { /* ignore */ }
  }
  return entry;
}
