import { useCallback, useEffect, useState } from 'react';
import {
  getSnapshot,
  subscribe,
  registerFlow,
  trackEvent,
  resetAnalytics,
  connectAnalyticsStream,
} from './client.js';

/**
 * @param {object} [opts]
 * @param {string} [opts.flowId]
 * @param {string} [opts.botId]
 * @param {string[]} [opts.nodeIds]
 * @param {boolean} [opts.realtime=true]
 */
export function useAnalytics({ flowId = null, botId = null, nodeIds = [], realtime = true } = {}) {
  const snapOpts = botId ? { botId } : {};
  const [snapshot, setSnapshot] = useState(() => getSnapshot(flowId, snapOpts));

  useEffect(() => {
    if (flowId && nodeIds?.length) {
      registerFlow(flowId, nodeIds);
    }
  }, [flowId, nodeIds.join('|')]);

  useEffect(() => {
    const refresh = () => setSnapshot(getSnapshot(flowId, snapOpts));
    const unsubLocal = subscribe(() => refresh());
    let stopStream = null;
    if (realtime) {
      const q = new URLSearchParams();
      if (flowId) q.set('flowId', flowId);
      if (botId) q.set('botId', botId);
      const query = q.toString() ? `?${q}` : '';
      stopStream = connectAnalyticsStream(query, setSnapshot);
    }
    const poll = setInterval(refresh, realtime ? 4000 : 3000);
    refresh();
    return () => {
      unsubLocal?.();
      stopStream?.();
      clearInterval(poll);
    };
  }, [flowId, botId, realtime]);

  const track = useCallback((input) => {
    trackEvent({ ...input, flowId: input.flowId || flowId });
    setSnapshot(getSnapshot(flowId));
  }, [flowId, botId]);

  const reset = useCallback(() => {
    resetAnalytics();
    setSnapshot(getSnapshot(flowId, snapOpts));
  }, [flowId, botId]);

  return {
    snapshot,
    track,
    reset,
    refresh: () => setSnapshot(getSnapshot(flowId, snapOpts)),
  };
}
