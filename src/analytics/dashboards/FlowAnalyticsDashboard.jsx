import React, { useMemo } from 'react';
import BarChart from '../components/BarChart.jsx';

export default function FlowAnalyticsDashboard({ snapshot, nodeLabel }) {
  const dropOffs = useMemo(() => {
    const stats = snapshot?.nodeStats || {};
    return Object.entries(stats)
      .map(([nodeId, s]) => ({
        label: nodeLabel?.(nodeId) || nodeId,
        value: s.dropOffRate ?? 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [snapshot?.nodeStats, nodeLabel]);

  const paths = snapshot?.topPaths || [];

  return (
    <div className="analytics-dash">
      <section className="analytics-panel">
        <h3 className="analytics-panel__title">Drop-off by node (%)</h3>
        <BarChart items={dropOffs} />
      </section>
      <section className="analytics-panel">
        <h3 className="analytics-panel__title">User paths</h3>
        {paths.length === 0 ? (
          <p className="analytics-empty">Пути пользователей появятся после сессий в симуляторе</p>
        ) : (
          <ol className="analytics-path-list">
            {paths.map((p) => (
              <li key={p.path}>
                <span className="analytics-path-list__path">{p.path}</span>
                <span className="analytics-path-list__count">{p.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
