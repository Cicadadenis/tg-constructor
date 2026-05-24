import React from 'react';

/**
 * Right inspector — properties / code only (no entity-edit modals).
 * @param {object} props
 * @param {'props' | 'code'} props.tab
 * @param {(tab: 'props' | 'code') => void} props.onTabChange
 * @param {boolean} [props.canSeeCode]
 * @param {() => void} [props.onLockedCodeTab]
 * @param {React.ReactNode} props.inspector
 * @param {React.ReactNode} [props.codePane]
 * @param {React.ReactNode} [props.lockedCodePane]
 * @param {string} [props.lang]
 */
export default function RightInspectorPanel({
  tab,
  onTabChange,
  canSeeCode = false,
  onLockedCodeTab,
  inspector,
  codePane = null,
  lockedCodePane = null,
  lang = 'ru',
}) {
  const propsLabel = lang === 'en' ? 'Inspector' : lang === 'uk' ? 'Інспектор' : 'Инспектор';
  const codeLabel = lang === 'en' ? 'Code' : lang === 'uk' ? 'Код' : 'Код';

  return (
    <div className="app-zone app-zone--right" data-zone="right" data-tour="props-panel-desktop">
      <div className="app-inspector-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'props'}
          className={`app-inspector-tab${tab === 'props' ? ' active' : ''}`}
          onClick={() => onTabChange('props')}
        >
          ✏️ {propsLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'code'}
          className={`app-inspector-tab${tab === 'code' ? ' active' : ''}${!canSeeCode ? ' locked' : ''}`}
          onClick={() => {
            if (!canSeeCode) {
              onLockedCodeTab?.();
              return;
            }
            onTabChange('code');
          }}
        >
          {canSeeCode ? '📜' : '🔒'} {codeLabel}
        </button>
      </div>
      <div className="app-inspector-body">
        {tab === 'props' && (
          <div className="app-zone__scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {inspector}
          </div>
        )}
        {tab === 'code' && canSeeCode && codePane}
        {tab === 'code' && !canSeeCode && lockedCodePane}
      </div>
    </div>
  );
}
