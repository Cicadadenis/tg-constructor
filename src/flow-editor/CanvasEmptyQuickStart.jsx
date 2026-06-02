import React from 'react';
import { Panel } from '@xyflow/react';
import { motion, useReducedMotion } from 'framer-motion';
import { MC_SPRING } from '../motion/index.js';
import '../layout/canvas-first/canvas-first.css';

/**
 * Empty canvas overlay — quick add + starter actions (Framer Motion).
 */
export default function CanvasEmptyQuickStart({
  lang = 'ru',
  onQuickAddStart,
  onQuickAddMessage,
  onApplyTemplate,
  onOpenAi,
}) {
  const prefersReducedMotion = useReducedMotion();
  const eyebrow = lang === 'en'
    ? 'Flow Builder'
    : lang === 'uk'
      ? 'Конструктор сценарію'
      : 'Конструктор сценария';

  const title = lang === 'en'
    ? 'Build your flow visually'
    : lang === 'uk'
      ? 'Зберіть сценарій візуально'
      : 'Соберите сценарий на холсте';

  const sub = lang === 'en'
    ? 'Drag blocks from the left panel, connect steps, or start with a quick action.'
    : lang === 'uk'
      ? 'Перетягніть блоки зліва, з’єднайте кроки або почніть з швидкої дії.'
      : 'Перетащите блоки слева, соедините шаги или начните с быстрого действия.';

  const startLabel = lang === 'en' ? 'Add Start' : lang === 'uk' ? 'Додати Старт' : 'Добавить Старт';
  const msgLabel = lang === 'en' ? 'Add Reply' : lang === 'uk' ? 'Додати Відповідь' : 'Добавить Ответ';
  const tplLabel = lang === 'en' ? 'Use template' : lang === 'uk' ? 'Шаблон' : 'Шаблон';
  const aiLabel = lang === 'en' ? 'Create with AI' : lang === 'uk' ? 'Через AI' : 'Через AI';
  const hints = lang === 'en'
    ? ['Drag blocks', 'Connect steps', 'Launch fast']
    : lang === 'uk'
      ? ['Перетягуйте блоки', 'Зʼєднуйте кроки', 'Запускайте швидко']
      : ['Перетаскивайте блоки', 'Соединяйте шаги', 'Запускайте быстро'];

  return (
    <Panel position="top-center" className="cf-empty-quick-panel">
      <motion.div
        className="cf-empty-quick"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0 } : MC_SPRING.gentle}
      >
        <div className="cf-empty-quick__eyebrow">{eyebrow}</div>
        <h2 className="cf-empty-quick__title">{title}</h2>
        <p className="cf-empty-quick__sub">{sub}</p>
        <div className="cf-empty-quick__hints" aria-hidden>
          {hints.map((hint) => (
            <span key={hint} className="cf-empty-quick__hint">{hint}</span>
          ))}
        </div>
        <div className="cf-empty-quick__actions">
          {onQuickAddStart && (
            <button
              type="button"
              className="cf-empty-quick__btn cf-empty-quick__btn--primary"
              onClick={onQuickAddStart}
            >
              {startLabel}
            </button>
          )}
          {onQuickAddMessage && (
            <button
              type="button"
              className="cf-empty-quick__btn cf-empty-quick__btn--ghost"
              onClick={onQuickAddMessage}
            >
              {msgLabel}
            </button>
          )}
          {onApplyTemplate && (
            <button
              type="button"
              className="cf-empty-quick__btn cf-empty-quick__btn--ghost"
              onClick={() => onApplyTemplate?.('welcomeFlow')}
            >
              {tplLabel}
            </button>
          )}
          {onOpenAi && (
            <button
              type="button"
              className="cf-empty-quick__btn cf-empty-quick__btn--ghost"
              onClick={onOpenAi}
            >
              ✨ {aiLabel}
            </button>
          )}
        </div>
      </motion.div>
    </Panel>
  );
}
