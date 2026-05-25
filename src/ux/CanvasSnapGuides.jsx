import React from 'react';
import { useStore } from '@xyflow/react';

/**
 * Alignment guides while dragging nodes (Figma-style).
 * @param {{ guides: Array<{ orientation: 'h' | 'v', position: number }> }} props
 */
export default function CanvasSnapGuides({ guides = [] }) {
  const transform = useStore((s) => s.transform);
  if (!guides.length) return null;

  const [tx, ty, zoom] = transform;

  return (
    <svg
      className="canvas-snap-guides"
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      {guides.map((g, i) => {
        if (g.orientation === 'v') {
          const x = g.position * zoom + tx;
          return (
            <line
              key={`v-${i}-${g.position}`}
              x1={x}
              y1={-9999}
              x2={x}
              y2={99999}
              className="canvas-snap-guides__line"
            />
          );
        }
        const y = g.position * zoom + ty;
        return (
          <line
            key={`h-${i}-${g.position}`}
            x1={-9999}
            y1={y}
            x2={99999}
            y2={y}
            className="canvas-snap-guides__line"
          />
        );
      })}
    </svg>
  );
}

/**
 * @param {object} dragged - { x, y, width?, height? }
 * @param {Array<{ position: { x: number, y: number }, width?: number, height?: number }>} others
 * @param {number} [threshold=8]
 */
export function computeSnapGuides(dragged, others, threshold = 8) {
  const guides = [];
  const dw = dragged.width ?? 200;
  const dh = dragged.height ?? 80;
  const dcx = dragged.x + dw / 2;
  const dcy = dragged.y + dh / 2;

  for (const n of others) {
    const w = n.width ?? 200;
    const h = n.height ?? 80;
    const ox = n.position.x;
    const oy = n.position.y;
    const ocx = ox + w / 2;
    const ocy = oy + h / 2;

    if (Math.abs(dragged.x - ox) <= threshold) guides.push({ orientation: 'v', position: ox });
    if (Math.abs(dcx - ocx) <= threshold) guides.push({ orientation: 'v', position: ocx - dw / 2 });
    if (Math.abs(dragged.x + dw - (ox + w)) <= threshold) {
      guides.push({ orientation: 'v', position: ox + w - dw });
    }
    if (Math.abs(dragged.y - oy) <= threshold) guides.push({ orientation: 'h', position: oy });
    if (Math.abs(dcy - ocy) <= threshold) guides.push({ orientation: 'h', position: ocy - dh / 2 });
    if (Math.abs(dragged.y + dh - (oy + h)) <= threshold) {
      guides.push({ orientation: 'h', position: oy + h - dh });
    }
  }

  const seen = new Set();
  return guides.filter((g) => {
    const key = `${g.orientation}:${g.position}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
