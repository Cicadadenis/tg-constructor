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
  const title = lang === 'en'
    ? 'Create your first bot'
    : lang === 'uk'
      ? 'Створіть першого бота'
      : 'Создайте первого бота';
  const subtitle = lang === 'en'
    ? 'Add your first block or generate a flow with AI'
    : lang === 'uk'
      ? 'Додайте перший блок або згенеруйте сценарій через AI'
      : 'Добавьте первый блок или сгенерируйте сценарий с ИИ';
  const addBlockLabel = lang === 'en' ? 'Add block' : lang === 'uk' ? 'Додати блок' : 'Добавить блок';
  const aiLabel = lang === 'en' ? 'Create with AI' : lang === 'uk' ? 'Створити через AI' : 'Создать с ИИ';

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
        <div className="flow-canvas-empty__hero">
          <div className="flow-canvas-empty__orb" aria-hidden />
          <div className="flow-canvas-empty__hero-icon" aria-hidden>◈</div>
          <h2 className="flow-canvas-empty__title">{title}</h2>
          <p className="flow-canvas-empty__subtitle">{subtitle}</p>
          <div className="flow-canvas-empty__cta">
            <button
              type="button"
              className="flow-canvas-empty__cta-btn flow-canvas-empty__cta-btn--primary"
              disabled={busy}
              onClick={() => window.dispatchEvent(new Event('cicada:open-command-palette'))}
            >
              {addBlockLabel}
            </button>
            {onOpenAi && (
              <button
                type="button"
                className={`flow-canvas-empty__cta-btn flow-canvas-empty__cta-btn--ai${canUseAiGenerator ? '' : ' is-locked'}`}
                onClick={onOpenAi}
                disabled={busy}
              >
                {canUseAiGenerator ? `✨ ${aiLabel}` : `🔒 ${aiLabel}`}
              </button>
            )}
          </div>
        </div>

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
