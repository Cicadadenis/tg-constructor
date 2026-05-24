import React from 'react';

/**
 * Full-height flow canvas host — internal scrolling only inside React Flow.
 * @param {{ children: React.ReactNode, canvasRef?: React.Ref }} props
 */
export default function CenterPanel({ children, canvasRef }) {
  return (
    <div className="app-zone app-zone--center" data-zone="center" data-tour="canvas-area">
      <div ref={canvasRef} className="app-canvas-host">
        {children}
      </div>
    </div>
  );
}
