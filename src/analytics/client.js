/**

 * Browser analytics client — local store + optional server sync.

 */



import {

  getDefaultAnalyticsStore,

  trackAnalyticsEvent,

  registerFlowForAnalytics,

  getAnalyticsSnapshot,

  subscribeAnalytics,

  resetDefaultAnalyticsStore,

  trackSessionStart as trackSessionStartCore,

} from '../../core/analytics/index.js';

import { resolveApiUrl } from '../apiClient.js';



const store = getDefaultAnalyticsStore();

const SERVER_SYNC_STORAGE_KEY = 'cicada:analytics-server-sync';



/** After 404/502 on analytics API, skip further server sync (static-only deploy). */

let serverSyncDisabled = readPersistedServerSyncOff();



function readPersistedServerSyncOff() {

  if (import.meta.env.VITE_ANALYTICS_SERVER_SYNC === 'false') return true;

  try {

    return sessionStorage.getItem(SERVER_SYNC_STORAGE_KEY) === 'off';

  } catch {

    return false;

  }

}



function persistServerSyncOff() {

  serverSyncDisabled = true;

  try {

    sessionStorage.setItem(SERVER_SYNC_STORAGE_KEY, 'off');

  } catch { /* private mode */ }

}



function disableServerSyncOnMissingApi(err) {

  const msg = err?.message || String(err);

  if (

    msg.includes('404')

    || msg.includes('502')

    || msg.includes('503')

    || msg.includes('недоступен')

    || msg.includes('неверный ответ')

  ) {

    persistServerSyncOff();

  }

}



function disableServerSyncOnStatus(status) {

  if (status === 404 || status === 502 || status === 503) {

    persistServerSyncOff();

  }

}



let apiProbePromise = null;



/** One lightweight check: is Node API mounted (not static-only nginx)? */

async function probeAnalyticsBackend() {

  if (serverSyncDisabled) return false;

  if (apiProbePromise) return apiProbePromise;

  apiProbePromise = (async () => {

    try {

      const res = await fetch(resolveApiUrl('/api/health'), {

        method: 'GET',

        credentials: 'include',

      });

      if (res.status === 404 || res.status === 502 || res.status === 503) {

        persistServerSyncOff();

        return false;

      }

      return true;

    } catch {

      persistServerSyncOff();

      return false;

    }

  })();

  return apiProbePromise;

}



async function postAnalytics(path, body) {

  const tokenRes = await fetch(resolveApiUrl('/api/csrf-token'), { credentials: 'include' }).catch(() => null);

  let csrf = '';

  if (tokenRes?.ok) {

    try {

      const data = await tokenRes.json();

      csrf = data?.token || data?.csrfToken || '';

    } catch { /* ignore */ }

  }

  const res = await fetch(resolveApiUrl(path), {

    method: 'POST',

    credentials: 'include',

    headers: {

      'Content-Type': 'application/json',

      ...(csrf ? { 'x-csrf-token': csrf } : {}),

    },

    body: JSON.stringify(body),

  });

  if (!res.ok) {

    disableServerSyncOnStatus(res.status);

    const text = await res.text().catch(() => '');

    let msg = `Analytics ${res.status}`;

    try {

      const j = JSON.parse(text);

      msg = j.error || msg;

    } catch { /* non-json (nginx 404 page) */ }

    if (res.status === 404 || !res.headers.get('content-type')?.includes('application/json')) {

      disableServerSyncOnMissingApi(new Error('404'));

    }

    throw new Error(msg);

  }

  if (res.headers.get('content-type')?.includes('application/json')) {

    return res.json();

  }

  return null;

}



export function getAnalyticsClientStore() {

  return store;

}



export function trackEvent(input) {

  const event = trackAnalyticsEvent(input, store);

  void syncTrackToServer(input);

  return event;

}



export function trackSessionStart(opts) {

  const event = trackSessionStartCore(opts, store);

  void syncTrackToServer({

    type: 'session.start',

    flowId: opts.flowId,

    sessionId: opts.sessionId,

    subscriberId: opts.subscriberId,

  });

  return event;

}



async function syncTrackToServer(input) {

  if (serverSyncDisabled) return;

  if (!(await probeAnalyticsBackend())) return;

  try {

    await postAnalytics('/api/analytics/track', input);

  } catch (err) {

    disableServerSyncOnMissingApi(err);

  }

}



export function registerFlow(flowId, nodeIds) {

  registerFlowForAnalytics(flowId, nodeIds, store);

  if (serverSyncDisabled) return;

  void (async () => {

    if (!(await probeAnalyticsBackend())) return;

    try {

      await postAnalytics('/api/analytics/register-flow', { flowId, nodeIds });

    } catch (err) {

      disableServerSyncOnMissingApi(err);

    }

  })();

}



export function getSnapshot(flowId = null, opts = {}) {

  return getAnalyticsSnapshot(flowId, opts, store);

}



export function subscribe(fn) {

  return subscribeAnalytics(fn, store);

}



export function resetAnalytics() {

  resetDefaultAnalyticsStore();

  if (serverSyncDisabled) return;

  void (async () => {

    if (!(await probeAnalyticsBackend())) return;

    try {

      await postAnalytics('/api/analytics/reset', {});

    } catch (err) {

      disableServerSyncOnMissingApi(err);

    }

  })();

}



export function connectAnalyticsStream(queryOrFlowId, onSnapshot) {

  const query = typeof queryOrFlowId === 'string' && queryOrFlowId.startsWith('?')

    ? queryOrFlowId

    : queryOrFlowId

      ? `?flowId=${encodeURIComponent(queryOrFlowId)}`

      : '';



  const useLocalOnly = () => {

    const flowId = query.includes('flowId=')

      ? decodeURIComponent(query.split('flowId=')[1]?.split('&')[0] || '')

      : null;

    return subscribe((patch) => {

      if (patch?.type === 'ingest') onSnapshot?.(getSnapshot(flowId || null));

    });

  };



  if (serverSyncDisabled || typeof EventSource === 'undefined') {

    return useLocalOnly();

  }



  let es = null;
  let localUnsub = null;
  let stopped = false;

  void probeAnalyticsBackend().then((ok) => {
    if (stopped) return;
    if (!ok || serverSyncDisabled) {
      localUnsub = useLocalOnly();
      return;
    }
    es = new EventSource(`${resolveApiUrl(`/api/analytics/stream${query}`)}`, { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const snap = JSON.parse(ev.data);
        onSnapshot?.(snap);
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      es?.close();
      es = null;
      persistServerSyncOff();
      if (!stopped && !localUnsub) localUnsub = useLocalOnly();
    };
  });

  return () => {
    stopped = true;
    es?.close();
    localUnsub?.();
  };
}


