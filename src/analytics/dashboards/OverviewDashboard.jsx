import React, { useMemo } from 'react';
import MetricCard from '../components/MetricCard.jsx';
import SparklineChart from '../components/SparklineChart.jsx';
import BarChart from '../components/BarChart.jsx';

export default function OverviewDashboard({ snapshot }) {
  const exec = snapshot?.executionStats || {};
  const avgMs = exec.durationCount > 0
    ? Math.round(exec.totalDurationMs / exec.durationCount)
    : 0;

  const sparkData = useMemo(() => {
    const events = snapshot?.recentEvents || [];
    const buckets = [];
    for (let i = 0; i < 12; i += 1) buckets.push(0);
    const now = Date.now();
    for (const e of events) {
      const age = now - e.ts;
      const idx = Math.min(11, Math.floor(age / 30_000));
      buckets[11 - idx] += 1;
    }
    return buckets;
  }, [snapshot?.recentEvents]);

  const topClicks = useMemo(() => {
    const cs = snapshot?.clickStats || {};
    return Object.entries(cs).map(([label, value]) => ({ label, value }));
  }, [snapshot?.clickStats]);

  return (
    <div className="analytics-dash">
      <div className="analytics-dash__metrics">
        <MetricCard label="Active users" value={snapshot?.activeUsers ?? 0} accent="green" />
        <MetricCard label="Live sessions" value={snapshot?.liveSessions ?? 0} accent="violet" />
        <MetricCard label="Automations" value={exec.started ?? 0} sub={`✓ ${exec.completed ?? 0} · ✕ ${exec.failed ?? 0}`} />
        <MetricCard label="Open rate" value={`${snapshot?.openRate?.rate ?? 0}%`} sub={`${snapshot?.openRate?.opened ?? 0} / ${snapshot?.openRate?.sent ?? 0}`} accent="amber" />
      </div>
      <div className="analytics-dash__grid">
        <section className="analytics-panel">
          <h3 className="analytics-panel__title">Activity (30s buckets)</h3>
          <SparklineChart data={sparkData} />
          <p className="analytics-panel__hint">Avg automation time {avgMs} ms · paused {exec.suspended ?? 0}</p>
        </section>
        <section className="analytics-panel">
          <h3 className="analytics-panel__title">Top clicks</h3>
          <BarChart items={topClicks} />
        </section>
      </div>
    </div>
  );
}
