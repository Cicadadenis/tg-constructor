/**
 * In-memory analytics store with rolling aggregation (dev + single-tenant SaaS).
 */

import { AnalyticsEventTypes } from './analyticsEventTypes.js';

const MAX_EVENTS = 20_000;
const MAX_LOGS = 5_000;
const MAX_TRACES = 500;

function now() {
  return Date.now();
}

function bucketKey(ts, windowMs) {
  return Math.floor(ts / windowMs) * windowMs;
}

/**
 * @typedef {object} AnalyticsEvent
 * @property {string} id
 * @property {string} type
 * @property {number} ts
 * @property {string} [flowId]
 * @property {string} [botId]
 * @property {string} [sessionId]
 * @property {string} [subscriberId]
 * @property {string} [nodeId]
 * @property {string} [edgeId]
 * @property {string} [executionId]
 * @property {string} [traceId]
 * @property {Record<string, unknown>} [properties]
 */

export class InMemoryAnalyticsStore {
  constructor() {
    /** @type {AnalyticsEvent[]} */
    this.events = [];
    /** @type {Map<string, { lastSeen: number, sessionId: string, flowId?: string }>} */
    this.activeUsers = new Map();
    /** @type {Map<string, { startedAt: number, flowId?: string, subscriberId?: string, nodeId?: string }>} */
    this.liveSessions = new Map();
    /** @type {Map<string, { enters: number, exits: number, errors: number, clicks: number, avgMs: number, _durTotal: number, _durCount: number }>} */
    this.nodeStats = new Map();
    /** @type {Map<string, { sent: number, opened: number }>} */
    this.messageStats = new Map();
    /** @type {Map<string, number>} */
    this.clickStats = new Map();
    /** @type {Map<string, { count: number, lastAt: number }>} */
    this.conversionGoals = new Map();
    /** @type {Map<string, number>} */
    this.edgeTraversals = new Map();
    /** @type {Map<string, number>} */
    this.nodeVisits = new Map();
    /** @type {string[][]} */
    this.userPaths = [];
    /** @type {object[]} */
    this.runtimeLogs = [];
    /** @type {object[]} */
    this.failedNodes = [];
    /** @type {Map<string, object>} */
    this.traces = new Map();
    this.executionStats = {
      started: 0,
      completed: 0,
      failed: 0,
      suspended: 0,
      totalDurationMs: 0,
      durationCount: 0,
    };
    this._listeners = new Set();
    this._flowNodeIndex = new Map();
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify(patch) {
    for (const fn of this._listeners) {
      try { fn(patch); } catch { /* ignore */ }
    }
  }

  /**
   * @param {AnalyticsEvent} event
   */
  ingest(event) {
    const e = {
      ...event,
      id: event.id || `ae_${event.ts}_${Math.random().toString(36).slice(2, 9)}`,
      ts: event.ts || now(),
      properties: event.properties ? { ...event.properties } : {},
    };

    this.events.push(e);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }

    this._applyEvent(e);
    this._notify({ type: 'ingest', event: e });
    if (this._onPersist) {
      try { this._onPersist(e); } catch { /* ignore */ }
    }
    return e;
  }

  /** @param {(event: AnalyticsEvent) => void} fn */
  setPersistHook(fn) {
    this._onPersist = fn;
  }

  registerFlowGraph(flowId, nodeIds = []) {
    if (!flowId) return;
    this._flowNodeIndex.set(flowId, [...new Set(nodeIds.filter(Boolean))]);
  }

  _applyEvent(e) {
    const subKey = e.subscriberId || e.sessionId || e.properties?.userId;
    const flowId = e.flowId || e.properties?.flowId;

    if (subKey) {
      this.activeUsers.set(subKey, {
        lastSeen: e.ts,
        sessionId: e.sessionId || subKey,
        flowId,
      });
    }

    if (e.sessionId) {
      const sess = this.liveSessions.get(e.sessionId) || { startedAt: e.ts };
      sess.lastAt = e.ts;
      sess.flowId = flowId || sess.flowId;
      sess.subscriberId = e.subscriberId || sess.subscriberId;
      sess.nodeId = e.nodeId || sess.nodeId;
      this.liveSessions.set(e.sessionId, sess);
    }

    switch (e.type) {
      case AnalyticsEventTypes.SESSION_START:
        if (e.sessionId) {
          this.liveSessions.set(e.sessionId, {
            startedAt: e.ts,
            flowId,
            subscriberId: e.subscriberId,
            nodeId: e.nodeId,
          });
        }
        break;
      case AnalyticsEventTypes.SESSION_END:
        if (e.sessionId) this.liveSessions.delete(e.sessionId);
        break;
      case AnalyticsEventTypes.FLOW_STARTED:
        this.executionStats.started += 1;
        break;
      case AnalyticsEventTypes.FLOW_COMPLETED:
        this.executionStats.completed += 1;
        if (e.properties?.durationMs) {
          this.executionStats.totalDurationMs += Number(e.properties.durationMs);
          this.executionStats.durationCount += 1;
        }
        break;
      case AnalyticsEventTypes.FLOW_FAILED:
        this.executionStats.failed += 1;
        break;
      case AnalyticsEventTypes.FLOW_SUSPENDED:
        this.executionStats.suspended += 1;
        break;
      case AnalyticsEventTypes.NODE_ENTER:
        this._bumpNode(e.nodeId, 'enters');
        this._bumpVisit(e.nodeId);
        if (e.properties?.fromNodeId) {
          const edgeKey = `${e.properties.fromNodeId}→${e.nodeId}`;
          this.edgeTraversals.set(edgeKey, (this.edgeTraversals.get(edgeKey) || 0) + 1);
        }
        if (e.sessionId && e.nodeId) {
          this._appendPathStep(e.sessionId, e.nodeId);
        }
        break;
      case AnalyticsEventTypes.NODE_EXIT:
        this._bumpNode(e.nodeId, 'exits');
        if (e.properties?.durationMs) {
          this._addNodeDuration(e.nodeId, Number(e.properties.durationMs));
        }
        break;
      case AnalyticsEventTypes.NODE_ERROR:
        this._bumpNode(e.nodeId, 'errors');
        this.failedNodes.push({
          ts: e.ts,
          nodeId: e.nodeId,
          flowId,
          executionId: e.executionId,
          message: String(e.properties?.error || e.properties?.message || 'error'),
        });
        if (this.failedNodes.length > MAX_LOGS) {
          this.failedNodes.splice(0, this.failedNodes.length - MAX_LOGS);
        }
        break;
      case AnalyticsEventTypes.MESSAGE_SENT:
        this._bumpMessage(e.nodeId || 'global', 'sent');
        break;
      case AnalyticsEventTypes.MESSAGE_OPENED:
        this._bumpMessage(e.nodeId || 'global', 'opened');
        break;
      case AnalyticsEventTypes.BUTTON_CLICK:
      case AnalyticsEventTypes.INLINE_CLICK:
      case AnalyticsEventTypes.REPLY_CLICK:
        this._bumpClick(e.properties?.callbackData || e.properties?.label || e.nodeId || 'unknown');
        if (e.nodeId) this._bumpNode(e.nodeId, 'clicks');
        break;
      case AnalyticsEventTypes.CONVERSION_GOAL:
        this.conversionGoals.set(String(e.properties?.goal || 'goal'), {
          count: (this.conversionGoals.get(String(e.properties?.goal || 'goal'))?.count || 0) + 1,
          lastAt: e.ts,
        });
        break;
      case AnalyticsEventTypes.RUNTIME_LOG:
        this.runtimeLogs.push({
          ts: e.ts,
          level: e.properties?.level || 'info',
          message: String(e.properties?.message || ''),
          nodeId: e.nodeId,
          executionId: e.executionId,
        });
        if (this.runtimeLogs.length > MAX_LOGS) {
          this.runtimeLogs.splice(0, this.runtimeLogs.length - MAX_LOGS);
        }
        break;
      case AnalyticsEventTypes.EXECUTION_TRACE:
        if (e.traceId) {
          this.traces.set(e.traceId, {
            traceId: e.traceId,
            ts: e.ts,
            flowId,
            executionId: e.executionId,
            events: e.properties?.events || [],
            export: e.properties?.export || null,
          });
          if (this.traces.size > MAX_TRACES) {
            const first = this.traces.keys().next().value;
            if (first) this.traces.delete(first);
          }
        }
        break;
      default:
        break;
    }
  }

  _bumpNode(nodeId, field) {
    if (!nodeId) return;
    const cur = this.nodeStats.get(nodeId) || {
      enters: 0, exits: 0, errors: 0, clicks: 0, avgMs: 0, _durTotal: 0, _durCount: 0,
    };
    cur[field] = (cur[field] || 0) + 1;
    this.nodeStats.set(nodeId, cur);
  }

  _addNodeDuration(nodeId, ms) {
    if (!nodeId || !Number.isFinite(ms)) return;
    const cur = this.nodeStats.get(nodeId) || {
      enters: 0, exits: 0, errors: 0, clicks: 0, avgMs: 0, _durTotal: 0, _durCount: 0,
    };
    cur._durTotal += ms;
    cur._durCount += 1;
    cur.avgMs = Math.round(cur._durTotal / cur._durCount);
    this.nodeStats.set(nodeId, cur);
  }

  _bumpMessage(nodeId, field) {
    const cur = this.messageStats.get(nodeId) || { sent: 0, opened: 0 };
    cur[field] += 1;
    this.messageStats.set(nodeId, cur);
  }

  _bumpClick(key) {
    this.clickStats.set(key, (this.clickStats.get(key) || 0) + 1);
  }

  _bumpVisit(nodeId) {
    if (!nodeId) return;
    this.nodeVisits.set(nodeId, (this.nodeVisits.get(nodeId) || 0) + 1);
  }

  /** @type {Map<string, string[]>} */
  _sessionPaths = new Map();

  _appendPathStep(sessionId, nodeId) {
    const path = this._sessionPaths.get(sessionId) || [];
    if (path[path.length - 1] !== nodeId) {
      path.push(nodeId);
      this._sessionPaths.set(sessionId, path);
      if (path.length >= 2) {
        this.userPaths.push([...path]);
        if (this.userPaths.length > 2000) {
          this.userPaths.splice(0, 500);
        }
      }
    }
  }

  /**
   * @param {string | null} [flowId]
   * @param {{ botId?: string, since?: number, until?: number }} [opts]
   */
  getSnapshot(flowId = null, opts = {}) {
    const { botId, since, until } = opts;
    const inWindow = (e) => {
      if (botId && e.botId && e.botId !== botId) return false;
      if (since && e.ts < since) return false;
      if (until && e.ts > until) return false;
      if (flowId && e.flowId && e.flowId !== flowId) return false;
      return true;
    };

    const pruneActive = (ms = 5 * 60_000) => {
      const cutoff = now() - ms;
      for (const [k, v] of this.activeUsers) {
        if (v.lastSeen < cutoff) this.activeUsers.delete(k);
      }
    };
    pruneActive();

    const nodeStats = {};
    for (const [id, s] of this.nodeStats) {
      if (!id) continue;
      nodeStats[id] = { ...s };
      delete nodeStats[id]._durTotal;
      delete nodeStats[id]._durCount;
      const visits = this.nodeVisits.get(id) || 0;
      const exits = s.exits || 0;
      nodeStats[id].visits = visits;
      nodeStats[id].dropOffRate = visits > 0 ? Math.round((1 - exits / Math.max(s.enters, 1)) * 100) : 0;
    }

    const heatmap = this.buildHeatmap(flowId);
    const funnel = this.buildFunnel(flowId);
    const topPaths = this.buildTopPaths(15);
    const openRate = this.buildOpenRate();
    const flowPerformance = this.buildFlowPerformance();
    const edgeTraversals = this.buildEdgeTraversals(flowId, 20);
    const eventBuckets = this.buildEventBuckets(12, 30_000);

    return {
      ts: now(),
      flowId,
      activeUsers: this.activeUsers.size,
      liveSessions: this.liveSessions.size,
      executionStats: { ...this.executionStats },
      flowPerformance,
      nodeStats,
      heatmap,
      funnel,
      topPaths,
      openRate,
      edgeTraversals,
      eventBuckets,
      clickStats: Object.fromEntries(
        [...this.clickStats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
      ),
      conversionGoals: Object.fromEntries(this.conversionGoals),
      failedNodes: this.failedNodes.slice(-50).reverse(),
      runtimeLogs: this.runtimeLogs.slice(-80).reverse(),
      recentEvents: this.events
        .filter(inWindow)
        .slice(-40)
        .reverse(),
      traces: [...this.traces.entries()]
        .map(([, t]) => t)
        .filter((t) => !flowId || t.flowId === flowId)
        .slice(-20)
        .reverse(),
    };
  }

  buildHeatmap(flowId) {
    const nodes = flowId ? (this._flowNodeIndex.get(flowId) || []) : [...this.nodeVisits.keys()];
    const max = Math.max(1, ...nodes.map((id) => this.nodeVisits.get(id) || 0));
    return nodes.map((nodeId) => {
      const visits = this.nodeVisits.get(nodeId) || 0;
      const stats = this.nodeStats.get(nodeId) || {};
      return {
        nodeId,
        visits,
        errors: stats.errors || 0,
        intensity: visits / max,
      };
    }).sort((a, b) => b.visits - a.visits);
  }

  buildFunnel(flowId) {
    const nodeOrder = flowId ? (this._flowNodeIndex.get(flowId) || []) : [...this.nodeStats.keys()];
    if (!nodeOrder.length) return [];

    const firstEnters = nodeOrder.map((id) => this.nodeStats.get(id)?.enters || 0);
    const baseline = Math.max(1, firstEnters[0] || firstEnters.reduce((a, b) => a + b, 0));

    return nodeOrder.slice(0, 12).map((nodeId, i) => {
      const enters = this.nodeStats.get(nodeId)?.enters || 0;
      return {
        step: i + 1,
        nodeId,
        count: enters,
        rate: Math.round((enters / baseline) * 100),
      };
    });
  }

  buildTopPaths(limit = 15) {
    const counts = new Map();
    for (const path of this.userPaths) {
      const key = path.join(' → ');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path, count]) => ({ path, count }));
  }

  buildOpenRate() {
    let sent = 0;
    let opened = 0;
    for (const m of this.messageStats.values()) {
      sent += m.sent;
      opened += m.opened;
    }
    return {
      sent,
      opened,
      rate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    };
  }

  buildFlowPerformance() {
    const { started, completed, failed, suspended, totalDurationMs, durationCount } =
      this.executionStats;
    const completionRate = started > 0 ? Math.round((completed / started) * 100) : 0;
    const failureRate = started > 0 ? Math.round((failed / started) * 100) : 0;
    const avgDurationMs = durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0;
    const goals = [...this.conversionGoals.values()];
    const totalConversions = goals.reduce((a, g) => a + (g.count || 0), 0);
    return {
      started,
      completed,
      failed,
      suspended,
      completionRate,
      failureRate,
      avgDurationMs,
      totalConversions,
      throughputPerMin: this.buildThroughputPerMin(),
    };
  }

  buildThroughputPerMin(windowMs = 60_000) {
    const cutoff = now() - windowMs;
    const count = this.events.filter((e) => e.ts >= cutoff).length;
    return Math.round((count / windowMs) * 60_000 * 10) / 10;
  }

  buildEventBuckets(buckets = 12, windowMs = 30_000) {
    const out = Array.from({ length: buckets }, () => 0);
    const end = now();
    for (const e of this.events) {
      const age = end - e.ts;
      if (age < 0 || age > buckets * windowMs) continue;
      const idx = buckets - 1 - Math.min(buckets - 1, Math.floor(age / windowMs));
      out[idx] += 1;
    }
    return out;
  }

  buildEdgeTraversals(flowId, limit = 20) {
    const entries = [...this.edgeTraversals.entries()]
      .filter(([key]) => !flowId || key.includes(flowId) || true)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    return entries.map(([edge, count]) => {
      const [from, to] = String(edge).split('→').map((s) => s.trim());
      return { from, to, edge, count };
    });
  }

  getTrace(traceId) {
    return this.traces.get(traceId) || null;
  }
}

let defaultStore = null;

export function getDefaultAnalyticsStore() {
  if (!defaultStore) defaultStore = new InMemoryAnalyticsStore();
  return defaultStore;
}

export function resetDefaultAnalyticsStore() {
  defaultStore = new InMemoryAnalyticsStore();
  return defaultStore;
}
