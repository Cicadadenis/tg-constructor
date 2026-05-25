/**
 * Bridge execution trace + scheduler events → analytics pipeline.
 */

import { AnalyticsEventTypes } from './analyticsEventTypes.js';
import { trackAnalyticsEvent } from './analyticsPipeline.js';

function highlightNodesFromTrace(events) {
  const visited = new Set();
  for (const e of events || []) {
    if (e?.node_id) visited.add(e.node_id);
  }
  return { visited: [...visited] };
}

/**
 * @param {object} opts
 * @param {string} [opts.flowId]
 * @param {string} [opts.botId]
 * @param {string} [opts.sessionId]
 * @param {string} [opts.subscriberId]
 * @param {string} [opts.executionId]
 * @param {import('./inMemoryAnalyticsStore.js').InMemoryAnalyticsStore} [opts.store]
 */
export function createRuntimeAnalyticsHooks(opts = {}) {
  const { flowId, botId, sessionId, subscriberId, store } = opts;
  let lastNodeId = null;
  let flowStarted = false;

  const base = () => ({
    flowId,
    botId,
    sessionId,
    subscriberId,
    executionId: opts.executionId,
  });

  return {
    onFlowStart(executionId) {
      if (flowStarted) return;
      flowStarted = true;
      trackAnalyticsEvent({
        ...base(),
        type: AnalyticsEventTypes.FLOW_STARTED,
        executionId,
      }, store);
    },

    onFlowComplete(executionId, durationMs) {
      trackAnalyticsEvent({
        ...base(),
        type: AnalyticsEventTypes.FLOW_COMPLETED,
        executionId,
        properties: { durationMs },
      }, store);
    },

    onFlowFailed(executionId, error) {
      trackAnalyticsEvent({
        ...base(),
        type: AnalyticsEventTypes.FLOW_FAILED,
        executionId,
        properties: { error: String(error || '') },
      }, store);
    },

    onNodeEnter(nodeId, fromNodeId) {
      trackAnalyticsEvent({
        ...base(),
        type: AnalyticsEventTypes.NODE_ENTER,
        nodeId,
        properties: fromNodeId ? { fromNodeId } : {},
      }, store);
      lastNodeId = nodeId;
    },

    onNodeExit(nodeId, durationMs) {
      trackAnalyticsEvent({
        ...base(),
        type: AnalyticsEventTypes.NODE_EXIT,
        nodeId,
        properties: { durationMs },
      }, store);
    },

    onNodeError(nodeId, error) {
      trackAnalyticsEvent({
        ...base(),
        type: AnalyticsEventTypes.NODE_ERROR,
        nodeId,
        properties: { error: String(error || '') },
      }, store);
    },

    onEmitEvent(effect) {
      const payload = effect?.payload || effect || {};
      const eventName = payload.event || payload.name || 'analytics.event';
      trackAnalyticsEvent({
        ...base(),
        type: AnalyticsEventTypes.ANALYTICS_EVENT,
        nodeId: payload.nodeId || lastNodeId,
        properties: { event: eventName, ...payload },
      }, store);
      if (String(eventName).includes('goal') || payload.goal) {
        trackAnalyticsEvent({
          ...base(),
          type: AnalyticsEventTypes.CONVERSION_GOAL,
          properties: { goal: payload.goal || eventName },
        }, store);
      }
    },

    onTrace(traceId, tracePayload) {
      const events = tracePayload?.trace ?? tracePayload?.events ?? [];
      trackAnalyticsEvent({
        ...base(),
        type: AnalyticsEventTypes.EXECUTION_TRACE,
        traceId,
        properties: {
          events: Array.isArray(events) ? events.slice(0, 200) : [],
          export: tracePayload?.trace_export ?? null,
        },
      }, store);

      const hl = highlightNodesFromTrace(events);
      for (const nodeId of hl.visited) {
        trackAnalyticsEvent({
          ...base(),
          type: AnalyticsEventTypes.NODE_ENTER,
          nodeId,
          properties: { source: 'trace_replay' },
        }, store);
      }
    },

    onRuntimeLog(level, message, nodeId) {
      trackAnalyticsEvent({
        ...base(),
        type: AnalyticsEventTypes.RUNTIME_LOG,
        nodeId,
        properties: { level, message },
      }, store);
    },
  };
}

/**
 * Merge analytics hooks into ExecutionScheduler options (onTraceEvent / onEmitEvent).
 * @param {object} schedulerOptions
 * @param {object} ctx — flowId, botId, sessionId, subscriberId, executionId, store
 * @returns {object}
 */
export function withSchedulerAnalytics(schedulerOptions = {}, ctx = {}) {
  const hooks = createRuntimeAnalyticsHooks(ctx);
  const prevTrace = schedulerOptions.onTraceEvent;
  const prevEmit = schedulerOptions.onEmitEvent;
  let flowStarted = false;

  return {
    ...schedulerOptions,
    enableTrace: schedulerOptions.enableTrace !== false,
    onTraceEvent: (event) => {
      if (!flowStarted) {
        flowStarted = true;
        hooks.onFlowStart(event.executionId || ctx.executionId);
      }
      const nodeId = event?.nodeId;
      if (event?.type === 'nodeStart' && nodeId) {
        hooks.onNodeEnter(nodeId);
      } else if (event?.type === 'nodeComplete' && nodeId) {
        hooks.onNodeExit(nodeId, event.durationMs);
      } else if (event?.type === 'nodeError' && nodeId) {
        hooks.onNodeError(nodeId, event.outputs?.error ?? 'error');
      }
      prevTrace?.(event);
    },
    onEmitEvent: async (effect) => {
      hooks.onEmitEvent(effect);
      await prevEmit?.(effect);
    },
  };
}

/**
 * Record flow completion + trace after scheduler.start().
 * @param {object} run — SchedulerRunResult
 * @param {object} ctx
 */
export function finalizeSchedulerAnalytics(run, ctx = {}) {
  if (!run) return;
  const hooks = createRuntimeAnalyticsHooks(ctx);
  if (run.status === 'completed') {
    hooks.onFlowComplete(run.executionId);
  } else if (run.status === 'failed') {
    hooks.onFlowFailed(run.executionId, 'execution failed');
  }
  if (run.trace?.traceId) {
    hooks.onTrace(run.trace.traceId, {
      trace: run.trace.events,
      trace_export: run.trace,
    });
  }
}

/**
 * Preview/simulator step → analytics.
 */
export function trackPreviewStep({
  flowId,
  botId,
  sessionId,
  subscriberId,
  activeNodeIds = [],
  inbound,
  outbound = [],
  traceId,
  store,
}) {
  trackAnalyticsEvent({
    type: AnalyticsEventTypes.USER_ACTIVE,
    flowId,
    botId,
    sessionId,
    subscriberId,
  }, store);

  for (const o of outbound) {
    const t = o?.type;
    if (t === 'send_message' || t === 'inline_keyboard' || t === 'reply_keyboard') {
      trackAnalyticsEvent({
        type: AnalyticsEventTypes.MESSAGE_SENT,
        flowId,
        botId,
        sessionId,
        nodeId: activeNodeIds[activeNodeIds.length - 1],
        properties: { effectType: t },
      }, store);
    }
  }

  if (inbound) {
    trackAnalyticsEvent({
      type: AnalyticsEventTypes.MESSAGE_OPENED,
      flowId,
      botId,
      sessionId,
      properties: { inbound: String(inbound) },
    }, store);
  }

  for (const nodeId of activeNodeIds) {
    trackAnalyticsEvent({
      type: AnalyticsEventTypes.NODE_ENTER,
      flowId,
      botId,
      sessionId,
      nodeId,
      traceId,
    }, store);
  }
}

/**
 * Track bot preview API response on server.
 * @param {object} params
 */
export function trackPreviewResponseAnalytics({
  sessionId,
  subscriberId,
  botId,
  flowId,
  text,
  callbackData,
  outbound = [],
  traceId,
  traceEvents = [],
  store,
}) {
  if (sessionId) {
    trackAnalyticsEvent({
      type: AnalyticsEventTypes.USER_ACTIVE,
      flowId,
      botId,
      sessionId,
      subscriberId,
    }, store);
  }

  if (text || callbackData) {
    trackAnalyticsEvent({
      type: AnalyticsEventTypes.MESSAGE_OPENED,
      flowId,
      botId,
      sessionId,
      subscriberId,
      properties: {
        inbound: callbackData ? `callback:${callbackData}` : String(text || ''),
      },
    }, store);
  }

  if (callbackData) {
    trackButtonClick({
      flowId,
      botId,
      sessionId,
      callbackData,
      label: callbackData,
      kind: 'inline',
      store,
    });
  }

  for (const o of outbound) {
    const t = o?.type;
    if (t === 'send_message' || t === 'inline_keyboard' || t === 'reply_keyboard') {
      trackAnalyticsEvent({
        type: AnalyticsEventTypes.MESSAGE_SENT,
        flowId,
        botId,
        sessionId,
        properties: { effectType: t },
      }, store);
    }
  }

  if (traceId) {
    trackAnalyticsEvent({
      type: AnalyticsEventTypes.EXECUTION_TRACE,
      flowId,
      botId,
      sessionId,
      traceId,
      properties: { events: traceEvents.slice(0, 200) },
    }, store);
  }
}

export function trackButtonClick({
  flowId,
  botId,
  sessionId,
  callbackData,
  label,
  kind = 'inline',
  nodeId,
  store,
}) {
  const type = kind === 'reply'
    ? AnalyticsEventTypes.REPLY_CLICK
    : AnalyticsEventTypes.INLINE_CLICK;
  trackAnalyticsEvent({
    type,
    flowId,
    botId,
    sessionId,
    nodeId,
    properties: { callbackData, label },
  }, store);
  trackAnalyticsEvent({
    type: AnalyticsEventTypes.BUTTON_CLICK,
    flowId,
    botId,
    sessionId,
    nodeId,
    properties: { callbackData, label },
  }, store);
}
