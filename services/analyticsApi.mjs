/**
 * HTTP API for analytics snapshots + SSE realtime stream.
 */

import {
  getDefaultAnalyticsStore,
  getAnalyticsSnapshot,
  trackAnalyticsEvent,
  registerFlowForAnalytics,
  resetDefaultAnalyticsStore,
} from '../core/analytics/index.js';
import {
  bootstrapAnalyticsLayer,
} from '../core/analytics/server.js';
import { getDefaultAnalyticsPersistence } from '../core/analytics/analyticsPersistence.js';

const sseClients = new Set();

function broadcastSnapshot() {
  const snap = getAnalyticsSnapshot();
  const data = `data: ${JSON.stringify(snap)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

let wired = false;

export function wireAnalyticsBroadcast(store = getDefaultAnalyticsStore()) {
  if (wired) return;
  wired = true;
  store.subscribe(() => broadcastSnapshot());
}

function parseSnapshotQuery(req) {
  const flowId = req.query?.flowId ? String(req.query.flowId) : null;
  const botId = req.query?.botId ? String(req.query.botId) : undefined;
  const since = req.query?.since ? Number(req.query.since) : undefined;
  const until = req.query?.until ? Number(req.query.until) : undefined;
  const opts = {};
  if (botId) opts.botId = botId;
  if (Number.isFinite(since)) opts.since = since;
  if (Number.isFinite(until)) opts.until = until;
  return { flowId, opts };
}

export function mountAnalyticsRoutes(app, { requireUserAuth } = {}) {
  const auth = requireUserAuth || ((_req, _res, next) => next());

  const store = getDefaultAnalyticsStore();
  bootstrapAnalyticsLayer(store).catch(() => {});
  wireAnalyticsBroadcast(store);

  app.get('/api/analytics/snapshot', auth, (req, res) => {
    const { flowId, opts } = parseSnapshotQuery(req);
    res.json({ ok: true, snapshot: getAnalyticsSnapshot(flowId, opts, store) });
  });

  app.get('/api/analytics/trace/:traceId', auth, (req, res) => {
    const trace = store.getTrace(String(req.params.traceId || ''));
    if (!trace) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, trace });
  });

  app.post('/api/analytics/track', auth, (req, res) => {
    const body = req.body || {};
    if (!body.type) {
      return res.status(400).json({ ok: false, error: 'type required' });
    }
    const event = trackAnalyticsEvent(body, store);
    res.json({ ok: true, event });
  });

  app.post('/api/analytics/register-flow', auth, (req, res) => {
    const { flowId, nodeIds } = req.body || {};
    if (!flowId || !Array.isArray(nodeIds)) {
      return res.status(400).json({ ok: false, error: 'flowId and nodeIds[] required' });
    }
    registerFlowForAnalytics(String(flowId), nodeIds.map(String), store);
    res.json({ ok: true });
  });

  app.get('/api/analytics/stream', auth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const { flowId, opts } = parseSnapshotQuery(req);
    res.write(`data: ${JSON.stringify(getAnalyticsSnapshot(flowId, opts, store))}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  app.post('/api/analytics/reset', auth, (_req, res) => {
    resetDefaultAnalyticsStore();
    getDefaultAnalyticsPersistence().clear();
    wireAnalyticsBroadcast(getDefaultAnalyticsStore());
    res.json({ ok: true });
  });
}
