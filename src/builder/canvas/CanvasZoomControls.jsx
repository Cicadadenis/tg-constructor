import React, { useCallback } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import './canvas-chrome.css';

const ZOOM_STEP = 0.15;

/**
 * @param {object} props
 * @param {string} [props.lang]
 */
export default function CanvasZoomControls({ lang = 'ru' }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const displayZoom = Math.round((zoom || 1) * 100);

  const zoomInClick = useCallback(() => {
    zoomIn({ duration: 180 });
  }, [zoomIn]);

  const zoomOutClick = useCallback(() => {
    zoomOut({ duration: 180 });
  }, [zoomOut]);

  const fitClick = useCallback(() => {
    fitView({ padding: 0.18, duration: 220, maxZoom: 1.25 });
  }, [fitView]);

  const labels = lang === 'en'
    ? { in: 'Zoom in', out: 'Zoom out', fit: 'Fit view' }
    : lang === 'uk'
      ? { in: 'Збільшити', out: 'Зменшити', fit: 'Вмістити' }
      : { in: 'Увеличить', out: 'Уменьшить', fit: 'Вместить' };

  return (
    <div className="canvas-zoom-controls" role="toolbar" aria-label={lang === 'en' ? 'Zoom' : 'Масштаб'}>
      <button
        type="button"
        className="canvas-zoom-controls__btn"
        onClick={zoomOutClick}
        title={labels.out}
        aria-label={labels.out}
      >
        −
      </button>
      <span className="canvas-zoom-controls__level" aria-live="polite">
        {displayZoom}%
      </span>
      <button
        type="button"
        className="canvas-zoom-controls__btn"
        onClick={zoomInClick}
        title={labels.in}
        aria-label={labels.in}
      >
        +
      </button>
      <button
        type="button"
        className="canvas-zoom-controls__btn canvas-zoom-controls__btn--fit"
        onClick={fitClick}
        title={labels.fit}
        aria-label={labels.fit}
      >
        ⊡
      </button>
    </div>
  );
}
