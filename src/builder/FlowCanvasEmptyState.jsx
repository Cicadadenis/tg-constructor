import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MC_SPRING, fadeUp, staggerContainer, staggerItem, interactiveMotion } from '../motion/index.js';
import { getEmptyCanvasCopy, getFlowStarterTemplates } from './flowTemplates.js';
import './flow-canvas-empty.css';

/**
 * Empty flow canvas — starter templates with one-click instantiation.
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
    <motion.div
      className="flow-canvas-empty"
      data-testid="flow-canvas-empty-state"
      initial={fadeUp.initial}
      animate={fadeUp.animate}
      transition={MC_SPRING.gentle}
    >
      <div className="flow-canvas-empty__card editor-empty-card">
        <h2 className="flow-canvas-empty__title">{copy.title}</h2>
        <p className="flow-canvas-empty__subtitle">{copy.subtitle}</p>

        <motion.div
          className="flow-canvas-empty__grid"
          role="list"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {templates.map((tpl) => (
            <motion.button
              key={tpl.id}
              type="button"
              className="flow-canvas-empty__template"
              role="listitem"
              disabled={busy}
              data-template-id={tpl.id}
              onClick={() => onApplyTemplate?.(tpl.id)}
              variants={staggerItem}
              {...interactiveMotion}
            >
              <div className="flow-canvas-empty__template-head">
                <span className="flow-canvas-empty__template-icon" aria-hidden>{tpl.icon}</span>
                <span className="flow-canvas-empty__template-name">{tpl.name}</span>
              </div>
              <p className="flow-canvas-empty__template-desc">{tpl.description}</p>
              <span className="flow-canvas-empty__template-cta">{copy.useTemplate} →</span>
            </motion.button>
          ))}
        </motion.div>

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
    </motion.div>
  );
}
