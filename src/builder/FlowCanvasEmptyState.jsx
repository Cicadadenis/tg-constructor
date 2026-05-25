import React, { useMemo } from 'react';
import { getEmptyCanvasCopy, getFlowStarterTemplates } from './flowTemplates.js';
import './flow-canvas-empty.css';

/**
 * Empty flow canvas — starter templates with one-click instantiation.
 * @param {object} props
 * @param {boolean} props.show
 * @param {string} [props.lang]
 * @param {boolean} [props.canUseAiGenerator]
 * @param {(templateId: string) => void} props.onApplyTemplate
 * @param {() => void} [props.onOpenAi]
 * @param {() => void} [props.onStartTour]
 * @param {boolean} [props.busy]
 */
export default function FlowCanvasEmptyState({
  show = false,
  lang = 'ru',
  canUseAiGenerator = true,
  onApplyTemplate,
  onOpenAi,
  onStartTour,
  busy = false,
}) {
  const copy = useMemo(() => getEmptyCanvasCopy(lang), [lang]);
  const templates = useMemo(() => getFlowStarterTemplates(lang), [lang]);

  if (!show) return null;

  return (
    <div className="flow-canvas-empty" data-testid="flow-canvas-empty-state">
      <div className="flow-canvas-empty__card editor-empty-card">
        <h2 className="flow-canvas-empty__title">{copy.title}</h2>
        <p className="flow-canvas-empty__subtitle">{copy.subtitle}</p>

        <div className="flow-canvas-empty__grid" role="list">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="flow-canvas-empty__template"
              role="listitem"
              disabled={busy}
              data-template-id={tpl.id}
              onClick={() => onApplyTemplate?.(tpl.id)}
            >
              <div className="flow-canvas-empty__template-head">
                <span className="flow-canvas-empty__template-icon" aria-hidden>{tpl.icon}</span>
                <span className="flow-canvas-empty__template-name">{tpl.name}</span>
              </div>
              <p className="flow-canvas-empty__template-desc">{tpl.description}</p>
              <span className="flow-canvas-empty__template-cta">{copy.useTemplate} →</span>
            </button>
          ))}
        </div>

        <div className="flow-canvas-empty__footer">
          {onOpenAi && (
            <button
              type="button"
              className={`ds-btn ${canUseAiGenerator ? 'ds-btn--primary' : 'ds-btn--secondary'} ds-btn--sm`}
              onClick={onOpenAi}
              disabled={busy}
            >
              {canUseAiGenerator ? `✨ ${copy.createWithAi}` : `🔒 ${copy.createWithAi}`}
            </button>
          )}
          {onStartTour && (
            <button
              type="button"
              className="ds-btn ds-btn--ghost ds-btn--sm"
              onClick={onStartTour}
              disabled={busy}
            >
              {copy.tour}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
