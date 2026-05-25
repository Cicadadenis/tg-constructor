import React from 'react';

/**
 * Guided empty state with optional primary/secondary actions.
 * @param {object} props
 * @param {string} [props.icon]
 * @param {string} props.title
 * @param {string} [props.hint]
 * @param {React.ReactNode} [props.actions]
 * @param {string} [props.className]
 */
export default function EmptyState({ icon = '📭', title, hint, actions, className = '' }) {
  return (
    <div className={`ds-empty ${className}`.trim()} role="status">
      {icon && <span className="ds-empty__icon" aria-hidden>{icon}</span>}
      <p className="ds-empty__title">{title}</p>
      {hint && <p className="ds-empty__hint">{hint}</p>}
      {actions && <div className="ds-empty__actions">{actions}</div>}
    </div>
  );
}
