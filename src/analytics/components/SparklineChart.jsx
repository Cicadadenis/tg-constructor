import React, { useMemo } from 'react';

/**
 * @param {number[]} data
 * @param {number} [height=32]
 */
export default function SparklineChart({ data = [], height = 32, stroke = '#38bdf8' }) {
  const path = useMemo(() => {
    const pts = data.length ? data : [0];
    const w = 120;
    const max = Math.max(1, ...pts);
    const min = Math.min(...pts);
    const range = max - min || 1;
    const step = w / Math.max(1, pts.length - 1);
    return pts
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data, height]);

  return (
    <svg className="analytics-sparkline" viewBox={`0 0 120 ${height}`} width="100%" height={height} aria-hidden>
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
