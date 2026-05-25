import React from 'react';
import { motion } from 'framer-motion';

/**
 * Telegram-style live preview bubble for the selected step.
 */
export default function FlowInspectorPreview({
  title,
  body,
  categoryLabel,
  icon,
  validation,
  lang = 'ru',
  expanded = true,
  onToggle,
  children = null,
}) {
  const previewLabel = lang === 'en' ? 'Live preview' : lang === 'uk' ? 'Живий перегляд' : 'Живой превью';

  return (
    <div className={`fi-preview${expanded ? ' fi-preview--open' : ''}`}>
      <button
        type="button"
        className="fi-preview__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="fi-preview__toggle-label">{previewLabel}</span>
        <span className="fi-preview__toggle-icon" aria-hidden>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <motion.div
          className="fi-preview__card"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="fi-preview__chat">
            <div className="fi-preview__avatar" aria-hidden>{icon || '💬'}</div>
            <div className="fi-preview__bubble">
              {categoryLabel && (
                <span className="fi-preview__category">{categoryLabel}</span>
              )}
              {title && <strong className="fi-preview__title">{title}</strong>}
              <p className="fi-preview__body">{body || (lang === 'en' ? 'No content yet' : 'Контент не задан')}</p>
            </div>
          </div>
          {validation && (
            <div className="fi-preview__error" role="alert">
              <span className="fi-preview__error-icon" aria-hidden>!</span>
              {validation}
            </div>
          )}
          {children}
        </motion.div>
      )}
    </div>
  );
}
