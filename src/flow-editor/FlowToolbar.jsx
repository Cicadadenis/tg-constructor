import React from 'react';
import { motion } from 'framer-motion';
import { useCanvasStateStore } from './stores/canvasStateStore.js';

/**
 * ManyChat-style floating canvas toolbar — bottom center.
 */
export default function FlowToolbar({
  lang = 'ru',
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  layoutMode,
  onLayoutModeChange,
  onRelayout,
  onFocusMode,
  focusMode = false,
  onToggleHistory,
}) {
  const showMinimap = useCanvasStateStore((s) => s.showMinimap);
  const showGrid = useCanvasStateStore((s) => s.showGrid);
  const zoomPercent = useCanvasStateStore((s) => s.zoomPercent);
  const viewportActions = useCanvasStateStore((s) => s.viewportActions);
  const toggleMinimap = useCanvasStateStore((s) => s.toggleMinimap);
  const toggleGrid = useCanvasStateStore((s) => s.toggleGrid);

  const t = lang === 'en'
    ? {
      undo: 'Undo', redo: 'Redo', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
      fit: 'Fit', minimap: 'Minimap', grid: 'Grid', focus: 'Focus',
      layout: 'Layout', relayout: 'Re-layout', history: 'History',
    }
    : lang === 'uk'
      ? {
        undo: 'Скасувати', redo: 'Повторити', zoomIn: 'Збільшити', zoomOut: 'Зменшити',
        fit: 'Вмістити', minimap: 'Мінімапа', grid: 'Сітка', focus: 'Фокус',
        layout: 'Макет', relayout: 'Перелayout', history: 'Історія',
      }
      : {
        undo: 'Отменить', redo: 'Повторить', zoomIn: 'Увеличить', zoomOut: 'Уменьшить',
        fit: 'Вписать', minimap: 'Миникарта', grid: 'Сетка', focus: 'Фокус',
        layout: 'Схема', relayout: 'Перестроить', history: 'История',
      };

  const Btn = ({ children, onClick, disabled, active, title }) => (
    <button
      type="button"
      className={`fe-toolbar__btn${active ? ' fe-toolbar__btn--active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );

  return (
    <motion.div
      className="fe-toolbar"
      role="toolbar"
      aria-label={lang === 'en' ? 'Flow canvas' : 'Холст сценария'}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      <div className="fe-toolbar__group">
        <Btn title={t.undo} onClick={onUndo} disabled={!canUndo}>↶</Btn>
        <Btn title={t.redo} onClick={onRedo} disabled={!canRedo}>↷</Btn>
        {onToggleHistory && (
          <Btn title={t.history} onClick={onToggleHistory}>⏱</Btn>
        )}
      </div>

      <span className="fe-toolbar__sep" aria-hidden />

      <div className="fe-toolbar__group">
        <Btn title={t.zoomOut} onClick={() => viewportActions?.zoomOut?.()}>−</Btn>
        <span className="fe-toolbar__zoom">{zoomPercent}%</span>
        <Btn title={t.zoomIn} onClick={() => viewportActions?.zoomIn?.()}>+</Btn>
        <Btn title={t.fit} onClick={() => viewportActions?.fit?.()}>◎</Btn>
      </div>

      <span className="fe-toolbar__sep" aria-hidden />

      <div className="fe-toolbar__group">
        <Btn title={t.minimap} onClick={toggleMinimap} active={showMinimap}>▣</Btn>
        <Btn title={t.grid} onClick={toggleGrid} active={showGrid}>#</Btn>
        <Btn title={t.focus} onClick={onFocusMode} active={focusMode}>◻</Btn>
      </div>

      {onLayoutModeChange && (
        <>
          <span className="fe-toolbar__sep" aria-hidden />
          <div className="fe-toolbar__group fe-toolbar__group--layout">
            <select
              className="fe-toolbar__select"
              value={layoutMode || 'auto'}
              onChange={(e) => onLayoutModeChange(e.target.value)}
              aria-label={t.layout}
            >
              <option value="auto">Auto</option>
              <option value="compact">Compact</option>
              <option value="wide">Wide</option>
            </select>
            {onRelayout && (
              <Btn title={t.relayout} onClick={onRelayout}>⟲</Btn>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
