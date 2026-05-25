import React from 'react';

/**
 * @param {{ step: number, nodeId: string, count: number, rate: number }[]} steps
 */
export default function FunnelChart({ steps = [], nodeLabel }) {
  if (!steps.length) {
    return <p className="analytics-empty">Нет данных воронки — запустите симулятор или бота</p>;
  }

  return (
    <div className="analytics-funnel">
      {steps.map((s) => (
        <div key={`${s.step}-${s.nodeId}`} className="analytics-funnel__step">
          <div className="analytics-funnel__meta">
            <span className="analytics-funnel__step-num">#{s.step}</span>
            <span className="analytics-funnel__node" title={s.nodeId}>
              {nodeLabel?.(s.nodeId) || s.nodeId}
            </span>
          </div>
          <div className="analytics-funnel__bar-wrap">
            <div
              className="analytics-funnel__bar"
              style={{ width: `${Math.max(8, s.rate)}%` }}
            />
          </div>
          <div className="analytics-funnel__stats">
            <span>{s.count}</span>
            <span className="analytics-funnel__rate">{s.rate}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
