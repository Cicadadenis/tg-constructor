import React from 'react';
import { useAppLayout } from './AppLayoutContext.jsx';

/**
 * Mobile bottom navigation — switches left / canvas / right zones.
 */
export default function MobileZoneNav({
  labels = {},
  runSlot = null,
  onZoneChange = null,
}) {
  const { mobileZone, setMobileZone } = useAppLayout();

  const tabs = [
    { key: 'left', label: labels.list || 'List' },
    { key: 'canvas', label: labels.canvas || 'Canvas' },
    { key: 'right', label: labels.inspector || 'Inspector' },
  ];

  return (
    <nav className="app-mobile-nav" aria-label="Workspace zones">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`app-mobile-nav__zone editor-mobile-tab${mobileZone === tab.key ? ' active' : ''}`}
          data-zone={tab.key}
          onClick={() => {
            setMobileZone(tab.key);
            onZoneChange?.(tab.key);
          }}
          data-tour={tab.key === 'canvas' ? 'mobile-tab-canvas' : tab.key === 'left' ? 'mobile-tab-blocks' : 'mobile-tab-props'}
        >
          <span className="tab-icon" aria-hidden />
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
      {runSlot}
    </nav>
  );
}
