import React from 'react';
import FlowInspectorQuickActions from './FlowInspectorQuickActions.jsx';

export default function FlowInspectorHeader({
  icon,
  title,
  categoryLabel,
  statusBadge = null,
  lang = 'ru',
  quickActions = null,
}) {
  return (
    <header className="fi-header">
      <div className="fi-header__main">
        <div className="fi-header__icon" aria-hidden>{icon}</div>
        <div className="fi-header__text">
          <h2 className="fi-header__title">{title}</h2>
          <p className="fi-header__meta">{categoryLabel}</p>
          {statusBadge}
        </div>
      </div>
      {quickActions && (
        <FlowInspectorQuickActions lang={lang} {...quickActions} />
      )}
    </header>
  );
}
