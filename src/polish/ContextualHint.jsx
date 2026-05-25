import React from 'react';

/**
 * Contextual hint — ManyChat-style inline guidance.
 */
export default function ContextualHint({
  icon = '💡',
  title,
  text,
  actions = [],
  onDismiss,
  className = '',
}) {
  if (!title && !text) return null;

  return (
    <div
      className={`mc-contextual-hint ${onDismiss ? 'mc-contextual-hint--dismissible' : ''} ${className}`.trim()}
      role="note"
    >
      <span className="mc-contextual-hint__icon" aria-hidden>{icon}</span>
      <div className="mc-contextual-hint__body">
        {title && <p className="mc-contextual-hint__title">{title}</p>}
        {text && <p className="mc-contextual-hint__text">{text}</p>}
        {actions.length > 0 && (
          <div className="mc-contextual-hint__actions">
            {actions.map((a) => (
              <button
                key={a.id || a.label}
                type="button"
                className="mc-contextual-hint__action"
                onClick={a.onClick}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="mc-contextual-hint__close"
          onClick={onDismiss}
          aria-label="Dismiss hint"
        >
          ×
        </button>
      )}
    </div>
  );
}
