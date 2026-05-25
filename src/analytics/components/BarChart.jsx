import React from 'react';

/**
 * @param {{ label: string, value: number }[]} items
 */
export default function BarChart({ items = [], maxBars = 10 }) {
  const slice = items.slice(0, maxBars);
  const max = Math.max(1, ...slice.map((i) => i.value));

  return (
    <div className="analytics-bars">
      {slice.map((item) => (
        <div key={item.label} className="analytics-bars__row">
          <span className="analytics-bars__label" title={item.label}>
            {item.label.length > 18 ? `${item.label.slice(0, 16)}…` : item.label}
          </span>
          <div className="analytics-bars__track">
            <div
              className="analytics-bars__fill"
              style={{ width: `${Math.round((item.value / max) * 100)}%` }}
            />
          </div>
          <span className="analytics-bars__val">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
