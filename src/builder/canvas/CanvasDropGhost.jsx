import React from 'react';
import { NODE_CARD_WIDTH } from '../nodeCard/nodeCardLayout.js';

/**
 * Palette drag ghost preview on canvas.
 */
export default function CanvasDropGhost({ position, label = '', icon = '◆' }) {
  if (!position) return null;

  return (
    <div
      className="canvas-drop-ghost nodrag nopan"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: NODE_CARD_WIDTH,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 12,
      }}
      aria-hidden
    >
      <div className="canvas-drop-ghost__card">
        <span className="canvas-drop-ghost__icon">{icon}</span>
        <span className="canvas-drop-ghost__label">{label}</span>
      </div>
    </div>
  );
}
