import React from 'react';

export default function MetricCard({ label, value, sub, trend, accent = 'sky' }) {
  return (
    <div className={`analytics-metric analytics-metric--${accent}`}>
      <div className="analytics-metric__label">{label}</div>
      <div className="analytics-metric__value">{value}</div>
      {sub && <div className="analytics-metric__sub">{sub}</div>}
      {trend != null && (
        <div className={`analytics-metric__trend ${trend >= 0 ? 'is-up' : 'is-down'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}
