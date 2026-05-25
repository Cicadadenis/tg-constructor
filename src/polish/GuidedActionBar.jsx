import React from 'react';

/**
 * Floating guided actions above canvas (context-aware).
 */
export default function GuidedActionBar({ actions = [], visible = true }) {
  if (!visible || !actions.length) return null;

  return (
    <div className="mc-guided-bar" role="toolbar" aria-label="Suggested actions">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className="mc-guided-bar__chip"
          onClick={a.onClick}
          title={a.title}
        >
          {a.icon && <span aria-hidden>{a.icon}</span>}
          <span>{a.label}</span>
          {a.shortcut && <kbd>{a.shortcut}</kbd>}
        </button>
      ))}
    </div>
  );
}
