import React from 'react';
import { useAppLayout } from './AppLayoutContext.jsx';

/**
 * Mobile bottom navigation — switches left / canvas / right zones.
 */
export default function MobileZoneNav({
  labels = {},
  runSlot = null,
}) {
  const { mobileZone, setMobileZone } = useAppLayout();

  const tabs = [
    { key: 'canvas', icon: '🎨', label: labels.canvas || 'Canvas' },
    { key: 'left', icon: '📋', label: labels.list || 'List' },
    { key: 'right', icon: '✏️', label: labels.inspector || 'Inspector' },
  ];

  return (
    <nav className="app-mobile-nav" aria-label="Workspace zones">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`app-mobile-nav__zone editor-mobile-tab${mobileZone === tab.key ? ' active' : ''}`}
          onClick={() => setMobileZone(tab.key)}
          data-tour={tab.key === 'canvas' ? 'mobile-tab-canvas' : tab.key === 'left' ? 'mobile-tab-blocks' : 'mobile-tab-props'}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
      {runSlot}
    </nav>
  );
}
