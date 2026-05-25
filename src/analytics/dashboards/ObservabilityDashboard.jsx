import React, { useState } from 'react';
import { buildTimeline, highlightNodesFromTrace } from '../../constructor/traceViewer.js';

export default function ObservabilityDashboard({
  snapshot,
  traceId,
  onFetchTrace,
  onHighlightNodes,
  nodeLabel,
  labels = {},
}) {
  const [traceEvents, setTraceEvents] = useState([]);
  const [replayIdx, setReplayIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadTrace = async () => {
    if (!traceId || !onFetchTrace) return;
    setLoading(true);
    try {
      const payload = await onFetchTrace(traceId);
      const events = payload?.trace ?? payload?.events ?? [];
      setTraceEvents(Array.isArray(events) ? events : []);
      setReplayIdx(Math.max(0, events.length - 1));
    } finally {
      setLoading(false);
    }
  };

  const sliced = traceEvents.slice(0, replayIdx + 1);
  const timeline = buildTimeline(sliced);
  const highlights = highlightNodesFromTrace(sliced);

  return (
    <div className="analytics-dash analytics-dash--obs">
      <section className="analytics-panel">
        <h3 className="analytics-panel__title">{labels.failedNodes || 'Failed steps'}</h3>
        {(snapshot?.failedNodes || []).length === 0 ? (
          <p className="analytics-empty">{labels.noErrors || 'No step errors yet'}</p>
        ) : (
          <ul className="analytics-log-list">
            {(snapshot?.failedNodes || []).map((f, i) => (
              <li key={`${f.ts}-${i}`}>
                <time>{new Date(f.ts).toLocaleTimeString()}</time>
                <code>{nodeLabel?.(f.nodeId) || f.nodeId}</code>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="analytics-panel">
        <h3 className="analytics-panel__title">{labels.runtimeLogs || 'Runtime logs'}</h3>
        <ul className="analytics-log-list analytics-log-list--mono">
          {(snapshot?.runtimeLogs || []).map((l, i) => (
            <li key={`${l.ts}-${i}`} className={`level-${l.level}`}>
              <time>{new Date(l.ts).toLocaleTimeString()}</time>
              {l.nodeId && <code>{l.nodeId}</code>}
              <span>{l.message}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="analytics-panel analytics-panel--wide">
        <div className="analytics-panel__head-row">
          <h3 className="analytics-panel__title">{labels.traceReplay || 'Execution trace replay'}</h3>
          <button type="button" className="analytics-btn" disabled={!traceId || loading} onClick={loadTrace}>
            {loading ? '…' : (labels.loadTrace || 'Load trace')}
          </button>
        </div>
        {traceId && <p className="analytics-panel__hint">trace: {traceId}</p>}
        {traceEvents.length > 0 && (
          <>
            <input
              type="range"
              min={0}
              max={Math.max(0, traceEvents.length - 1)}
              value={replayIdx}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setReplayIdx(idx);
                const hl = highlightNodesFromTrace(traceEvents.slice(0, idx + 1));
                onHighlightNodes?.(hl.active);
              }}
              className="analytics-replay-slider"
            />
            <ul className="analytics-timeline">
              {timeline.slice(-20).map((row) => (
                <li key={row.seq}>
                  <span className="analytics-timeline__kind">{row.kind}</span>
                  {row.nodeId && <code>{nodeLabel?.(row.nodeId) || row.nodeId}</code>}
                </li>
              ))}
            </ul>
            <p className="analytics-panel__hint">
              Active: {highlights.active.join(', ') || '—'}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
