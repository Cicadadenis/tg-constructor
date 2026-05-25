import React from 'react';
import FunnelChart from '../components/FunnelChart.jsx';
import MetricCard from '../components/MetricCard.jsx';

export default function FunnelDashboard({ snapshot, nodeLabel }) {
  const goals = snapshot?.conversionGoals || {};
  const goalEntries = Object.entries(goals);

  return (
    <div className="analytics-dash">
      <div className="analytics-dash__metrics">
        {goalEntries.length === 0 ? (
          <MetricCard label="Conversions" value={0} sub="Добавьте goal / analytics блоки" />
        ) : (
          goalEntries.map(([goal, data]) => (
            <MetricCard key={goal} label={goal} value={data.count ?? 0} accent="green" />
          ))
        )}
      </div>
      <section className="analytics-panel analytics-panel--wide">
        <h3 className="analytics-panel__title">Conversion funnel</h3>
        <FunnelChart steps={snapshot?.funnel || []} nodeLabel={nodeLabel} />
      </section>
    </div>
  );
}
