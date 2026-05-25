import React, { useMemo } from 'react';
import { getProductUiLabels } from '../../copy/productCopy.js';
import BarChart from '../components/BarChart.jsx';
import HeatmapGrid from '../components/HeatmapGrid.jsx';

export default function NodeAnalyticsDashboard({ snapshot, nodeLabel, onNodeClick, lang = 'ru' }) {
  const p = getProductUiLabels(lang);
  const nodePerf = useMemo(() => {
    const stats = snapshot?.nodeStats || {};
    return Object.entries(stats)
      .map(([nodeId, s]) => ({
        label: nodeLabel?.(nodeId) || nodeId,
        value: s.avgMs || 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [snapshot?.nodeStats, nodeLabel]);

  const nodeVolume = useMemo(() => {
    const stats = snapshot?.nodeStats || {};
    return Object.entries(stats)
      .map(([nodeId, s]) => ({
        label: nodeLabel?.(nodeId) || nodeId,
        value: s.enters || 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [snapshot?.nodeStats, nodeLabel]);

  return (
    <div className="analytics-dash">
      <section className="analytics-panel analytics-panel--wide">
        <h3 className="analytics-panel__title">{p.nodeHeatmap}</h3>
        <HeatmapGrid
          cells={snapshot?.heatmap || []}
          nodeLabel={nodeLabel}
          onNodeClick={onNodeClick}
        />
      </section>
      <div className="analytics-dash__grid">
        <section className="analytics-panel">
          <h3 className="analytics-panel__title">{p.stepVolume}</h3>
          <BarChart items={nodeVolume} />
        </section>
        <section className="analytics-panel">
          <h3 className="analytics-panel__title">{p.slowestSteps}</h3>
          <BarChart items={nodePerf} />
        </section>
      </div>
    </div>
  );
}
