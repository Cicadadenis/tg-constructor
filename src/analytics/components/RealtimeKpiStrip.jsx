import React from 'react';
import MetricCard from './MetricCard.jsx';

/**
 * Top KPI strip — ManyChat-style realtime headline metrics.
 */
export default function RealtimeKpiStrip({ snapshot, streamConnected, labels }) {
  const exec = snapshot?.executionStats || {};
  const perf = snapshot?.flowPerformance || {};
  const l = labels || {};

  return (
    <div className="analytics-kpi-strip">
      <div className="analytics-kpi-strip__status">
        <span className={`analytics-live-pill ${streamConnected ? 'is-on' : ''}`}>
          {streamConnected ? '● Live' : '○ Polling'}
        </span>
        <span className="analytics-kpi-strip__updated">
          {snapshot?.ts ? new Date(snapshot.ts).toLocaleTimeString() : '—'}
        </span>
      </div>
      <div className="analytics-dash__metrics analytics-dash__metrics--strip">
        <MetricCard
          label={l.activeUsers || 'Active users'}
          value={snapshot?.activeUsers ?? 0}
          accent="green"
        />
        <MetricCard
          label={l.liveSessions || 'Live sessions'}
          value={snapshot?.liveSessions ?? 0}
          accent="violet"
        />
        <MetricCard
          label={l.completion || 'Completion'}
          value={`${perf.completionRate ?? 0}%`}
          sub={`${perf.completed ?? 0} / ${perf.started ?? 0}`}
          accent="sky"
        />
        <MetricCard
          label={l.conversions || 'Conversions'}
          value={perf.totalConversions ?? 0}
          accent="amber"
        />
      </div>
    </div>
  );
}
