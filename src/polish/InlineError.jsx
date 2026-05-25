import React from 'react';

export default function InlineError({ message, onRetry, retryLabel }) {
  if (!message) return null;

  return (
    <div className="mc-inline-error" role="alert">
      <span className="mc-inline-error__icon" aria-hidden>!</span>
      <div>
        <p style={{ margin: 0 }}>{message}</p>
        {onRetry && (
          <button
            type="button"
            className="ds-btn ds-btn--ghost ds-btn--sm"
            style={{ marginTop: 8 }}
            onClick={onRetry}
          >
            {retryLabel || 'Повторить'}
          </button>
        )}
      </div>
    </div>
  );
}
