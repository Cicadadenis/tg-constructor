import React from 'react';
import { useAppLayout } from './AppLayoutContext.jsx';

/**
 * Mobile bottom navigation — bot builder modes (ManyChat-style).
 */
export default function MobileZoneNav({
  labels = {},
  onZoneChange = null,
}) {
  const { mobileZone, setMobileZone } = useAppLayout();

  const tabs = [
    { key: 'left', icon: '🧩', label: labels.list || 'Blocks' },
    { key: 'canvas', icon: '🔗', label: labels.canvas || 'Flow' },
    { key: 'right', icon: '⚙️', label: labels.inspector || 'Settings' },
    { key: 'test', icon: '▶️', label: labels.test || 'Test' },
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
          data-tour={
            tab.key === 'canvas'
              ? 'mobile-tab-canvas'
              : tab.key === 'left'
                ? 'mobile-tab-blocks'
                : tab.key === 'right'
                  ? 'mobile-tab-props'
                  : 'mobile-tab-test'
          }
        >
          <span className="tab-icon" aria-hidden>{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
