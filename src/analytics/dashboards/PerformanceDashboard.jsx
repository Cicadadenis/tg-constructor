import React, { useMemo } from 'react';
import MetricCard from '../components/MetricCard.jsx';
import SparklineChart from '../components/SparklineChart.jsx';
import BarChart from '../components/BarChart.jsx';

export default function PerformanceDashboard({ snapshot, labels = {} }) {
  const perf = snapshot?.flowPerformance || {};
  const exec = snapshot?.executionStats || {};

  const edgeItems = useMemo(() => {
    return (snapshot?.edgeTraversals || []).map((e) => ({
      label: `${e.from || '?'} → ${e.to || '?'}`,
      value: e.count,
    }));
  }, [snapshot?.edgeTraversals]);

  const buckets = snapshot?.eventBuckets || [];

  return (
    <div className="analytics-dash">
      <div className="analytics-dash__metrics">
        <MetricCard
          label={labels.throughput || 'Events / min'}
          value={perf.throughputPerMin ?? 0}
          sub={labels.throughputHint || 'Last 60s'}
        />
        <MetricCard
          label={labels.avgTime || 'Avg run time'}
          value={`${perf.avgDurationMs ?? 0} ms`}
          accent="sky"
        />
        <MetricCard
          label={labels.failRate || 'Failure rate'}
          value={`${perf.failureRate ?? 0}%`}
          sub={`${exec.failed ?? 0} failed`}
        />
        <MetricCard
          label={labels.suspended || 'Paused'}
          value={exec.suspended ?? 0}
        />
      </div>
      <div className="analytics-dash__grid">
        <section className="analytics-panel">
          <h3 className="analytics-panel__title">{labels.activity || 'Event throughput'}</h3>
          <SparklineChart data={buckets.length ? buckets : [0]} stroke="#6366f1" />
        </section>
        <section className="analytics-panel">
          <h3 className="analytics-panel__title">{labels.edgeFlow || 'Top transitions'}</h3>
          {edgeItems.length === 0 ? (
            <p className="analytics-empty">{labels.edgeEmpty || 'Transitions appear as users move through the flow'}</p>
          ) : (
            <BarChart items={edgeItems} />
          )}
        </section>
      </div>
    </div>
  );
}
