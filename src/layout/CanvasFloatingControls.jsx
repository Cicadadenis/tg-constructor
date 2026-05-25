import React from 'react';
import FlowHistoryToolbar from '../builder/flowLayout/FlowHistoryToolbar.jsx';
import FlowLayoutToolbar from '../builder/flowLayout/FlowLayoutToolbar.jsx';

/**
 * Sticky floating controls on canvas (undo/redo + layout) — not in top IDE bar.
 */
export default function CanvasFloatingControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  layoutMode,
  onLayoutModeChange,
  onRelayout,
  lang = 'ru',
  showLayout = true,
}) {
  return (
    <div className="mc-canvas-dock mc-canvas-dock--top" role="toolbar" aria-label={lang === 'en' ? 'Canvas tools' : 'Инструменты холста'}>
      <FlowHistoryToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        lang={lang}
      />
      {showLayout && (
        <FlowLayoutToolbar
          mode={layoutMode}
          onModeChange={onLayoutModeChange}
          onRelayout={onRelayout}
          lang={lang}
        />
      )}
    </div>
  );
}
