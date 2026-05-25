/**
 * Lightweight JSONL persistence for analytics events (append-only, survives restart).
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PATH = path.join(process.cwd(), 'data', 'analytics-events.jsonl');
const MAX_LINES_ON_BOOT = 5000;

/**
 * @param {string} [filePath]
 */
export function createAnalyticsPersistence(filePath = DEFAULT_PATH) {
  const resolved = path.resolve(filePath);
  let enabled = true;

  function ensureDir() {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }

  function append(event) {
    if (!enabled) return;
    try {
      ensureDir();
      fs.appendFileSync(resolved, `${JSON.stringify(event)}\n`, 'utf8');
    } catch {
      enabled = false;
    }
  }

  /**
   * Hydrate in-memory store on server boot.
   * @param {import('./inMemoryAnalyticsStore.js').InMemoryAnalyticsStore} store
   */
  function hydrate(store) {
    if (!fs.existsSync(resolved)) return 0;
    let count = 0;
    try {
      const raw = fs.readFileSync(resolved, 'utf8');
      const lines = raw.trim().split('\n').filter(Boolean);
      const slice = lines.slice(-MAX_LINES_ON_BOOT);
      for (const line of slice) {
        try {
          const event = JSON.parse(line);
          store.ingest({ ...event, _replayed: true });
          count += 1;
        } catch { /* skip bad line */ }
      }
    } catch {
      return 0;
    }
    return count;
  }

  function clear() {
    try {
      if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    } catch { /* ignore */ }
  }

  return { append, hydrate, clear, path: resolved };
}

let defaultPersistence = null;

export function getDefaultAnalyticsPersistence() {
  if (!defaultPersistence) {
    defaultPersistence = createAnalyticsPersistence();
  }
  return defaultPersistence;
}
