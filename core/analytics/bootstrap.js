/**
 * Server-side analytics bootstrap — persistence, subscriber bridge, SSE broadcast.
 */

import { getDefaultAnalyticsStore } from './inMemoryAnalyticsStore.js';
import { getDefaultAnalyticsPersistence } from './analyticsPersistence.js';
import { wireSubscriberAnalyticsBridgeSync } from './subscriberAnalyticsBridge.js';

let bootstrapped = false;

/**
 * @param {import('./inMemoryAnalyticsStore.js').InMemoryAnalyticsStore} [store]
 * @param {object} [opts]
 * @param {object} [opts.subscriberEventBus]
 */
export async function bootstrapAnalyticsLayer(store = getDefaultAnalyticsStore(), opts = {}) {
  if (bootstrapped) return { store, hydrated: 0 };
  bootstrapped = true;

  const persistence = getDefaultAnalyticsPersistence();
  store.setPersistHook((event) => persistence.append(event));
  const hydrated = persistence.hydrate(store);

  let bus = opts.subscriberEventBus;
  if (!bus) {
    try {
      const mod = await import('../subscriber/index.ts');
      bus = mod.getDefaultSubscriberEventBus?.();
    } catch { /* subscriber optional */ }
  }
  wireSubscriberAnalyticsBridgeSync(store, bus);

  return { store, hydrated, persistence };
}

export function resetAnalyticsBootstrapForTests() {
  bootstrapped = false;
}
