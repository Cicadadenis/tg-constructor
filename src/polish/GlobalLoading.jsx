import React from 'react';

export default function GlobalLoading({ open, label }) {
  if (!open) return null;

  return (
    <div className="mc-global-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="mc-global-loading__spinner" aria-hidden />
      {label && <p className="mc-global-loading__label">{label}</p>}
    </div>
  );
}
