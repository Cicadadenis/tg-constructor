import React from 'react';
import { motion } from 'framer-motion';
import { INSPECTOR_PRODUCT_TABS, inspectorTabLabels } from './inspectorTabs.js';

const TAB_ICONS = {
  content: '✎',
  logic: '⑂',
  audience: '👥',
  analytics: '📊',
  settings: '⚙',
};

export default function FlowInspectorTabBar({ tab, onTabChange, lang = 'ru' }) {
  const labels = inspectorTabLabels(lang);

  return (
    <div className="fi-tabs" role="tablist" aria-label={lang === 'en' ? 'Inspector' : 'Инспектор'}>
      {INSPECTOR_PRODUCT_TABS.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          className={`fi-tabs__tab${tab === id ? ' fi-tabs__tab--active' : ''}`}
          onClick={() => onTabChange(id)}
        >
          <span className="fi-tabs__icon" aria-hidden>{TAB_ICONS[id]}</span>
          <span className="fi-tabs__label">{labels[id]}</span>
          {tab === id && (
            <motion.span
              className="fi-tabs__indicator"
              layoutId="fi-tab-indicator"
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
