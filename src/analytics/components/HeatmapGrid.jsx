import React from 'react';

/**
 * @param {{ nodeId: string, visits: number, errors: number, intensity: number }[]} cells
 */
export default function HeatmapGrid({ cells = [], nodeLabel, onNodeClick }) {
  if (!cells.length) {
    return <p className="analytics-empty">Heatmap появится после прохождения flow</p>;
  }

  return (
    <div className="analytics-heatmap">
      {cells.map((c) => (
        <button
          key={c.nodeId}
          type="button"
          className="analytics-heatmap__cell"
          style={{
            '--heat': c.intensity,
            borderColor: c.errors > 0 ? 'rgba(248,113,113,0.55)' : undefined,
          }}
          title={`${c.nodeId}: ${c.visits} visits, ${c.errors} errors`}
          onClick={() => onNodeClick?.(c.nodeId)}
        >
          <span className="analytics-heatmap__id">
            {(nodeLabel?.(c.nodeId) || c.nodeId).slice(0, 12)}
          </span>
          <span className="analytics-heatmap__count">{c.visits}</span>
        </button>
      ))}
    </div>
  );
}
