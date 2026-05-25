import React from 'react';
import { Panel } from '@xyflow/react';
import { motion } from 'framer-motion';
import { MC_SPRING } from '../motion/index.js';
import { MotionPressable } from '../motion/MotionPressable.jsx';
import { useCanvasStateStore } from './stores/canvasStateStore.js';
import '../layout/canvas-first/canvas-first.css';

/**
 * ManyChat/Figma-style floating canvas controls — zoom, fit, grid, minimap, quick add.
 */
export default function CanvasFloatingControls({
  lang = 'ru',
  onQuickAddMessage,
  onQuickAddCondition,
  onQuickAddStart,
}) {
  const showMinimap = useCanvasStateStore((s) => s.showMinimap);
  const showGrid = useCanvasStateStore((s) => s.showGrid);
  const zoomPercent = useCanvasStateStore((s) => s.zoomPercent);
  const viewportActions = useCanvasStateStore((s) => s.viewportActions);
  const toggleMinimap = useCanvasStateStore((s) => s.toggleMinimap);
  const toggleGrid = useCanvasStateStore((s) => s.toggleGrid);

  const t = lang === 'en'
    ? {
      zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit view',
      grid: 'Grid', minimap: 'Minimap',
      message: 'Reply', condition: 'Condition', start: 'Start',
    }
    : lang === 'uk'
      ? {
        zoomIn: 'Збільшити', zoomOut: 'Зменшити', fit: 'Вмістити',
        grid: 'Сітка', minimap: 'Мінімапа',
        message: 'Відповідь', condition: 'Умова', start: 'Старт',
      }
      : {
        zoomIn: 'Увеличить', zoomOut: 'Уменьшить', fit: 'Вписать',
        grid: 'Сетка', minimap: 'Миникарта',
        message: 'Ответ', condition: 'Условие', start: 'Старт',
      };

  return (
    <Panel position="top-left" className="cf-floating-controls-panel">
      <motion.div
        className="cf-floating-controls"
        role="toolbar"
        aria-label={lang === 'en' ? 'Canvas tools' : 'Инструменты холста'}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={MC_SPRING.toolbar}
      >
        <div className="cf-floating-controls__row">
          <MotionPressable
            className="cf-floating-controls__btn"
            title={t.zoomOut}
            aria-label={t.zoomOut}
            onClick={() => viewportActions?.zoomOut?.()}
          >
            −
          </MotionPressable>
          <span className="cf-floating-controls__zoom">{zoomPercent}%</span>
          <MotionPressable
            className="cf-floating-controls__btn"
            title={t.zoomIn}
            aria-label={t.zoomIn}
            onClick={() => viewportActions?.zoomIn?.()}
          >
            +
          </MotionPressable>
          <span className="cf-floating-controls__sep" aria-hidden />
          <MotionPressable
            className="cf-floating-controls__btn"
            title={t.fit}
            aria-label={t.fit}
            onClick={() => viewportActions?.fit?.()}
          >
            ⊡
          </MotionPressable>
          <MotionPressable
            className={`cf-floating-controls__btn${showGrid ? ' cf-floating-controls__btn--active' : ''}`}
            title={t.grid}
            aria-label={t.grid}
            onClick={toggleGrid}
          >
            ▦
          </MotionPressable>
          <MotionPressable
            className={`cf-floating-controls__btn${showMinimap ? ' cf-floating-controls__btn--active' : ''}`}
            title={t.minimap}
            aria-label={t.minimap}
            onClick={toggleMinimap}
          >
            ◫
          </MotionPressable>
        </div>
        <div className="cf-quick-add">
          {onQuickAddStart && (
            <button type="button" className="cf-quick-add__chip" onClick={onQuickAddStart}>
              + {t.start}
            </button>
          )}
          {onQuickAddMessage && (
            <button type="button" className="cf-quick-add__chip" onClick={onQuickAddMessage}>
              + {t.message}
            </button>
          )}
          {onQuickAddCondition && (
            <button type="button" className="cf-quick-add__chip" onClick={onQuickAddCondition}>
              + {t.condition}
            </button>
          )}
        </div>
      </motion.div>
    </Panel>
  );
}
