import React from 'react';
import { useAppLayout } from './AppLayoutContext.jsx';

/**
 * Floating inspector — properties / code with collapse control.
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
  const { isMobile, toggleInspector, toggleInspectorCollapsed } = useAppLayout();

  const propsLabel = lang === 'en' ? 'Properties' : lang === 'uk' ? 'Властивості' : 'Свойства';
  const codeLabel = lang === 'en' ? 'Code' : lang === 'uk' ? 'Код' : 'Код';
  const collapseLabel = lang === 'en' ? 'Minimize' : 'Свернуть';
  const closeLabel = lang === 'en' ? 'Close panel' : 'Закрыть панель';

  return (
    <div className="app-zone app-zone--right mc-inspector-panel" data-zone="right" data-tour="props-panel-desktop">
      <div className="mc-inspector-panel__chrome">
        <div className="app-inspector-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'props'}
            className={`app-inspector-tab${tab === 'props' ? ' active' : ''}`}
            onClick={() => onTabChange('props')}
          >
            {propsLabel}
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
            {canSeeCode ? codeLabel : `🔒 ${codeLabel}`}
          </button>
        </div>
        <div className="mc-inspector-panel__actions">
          {!isMobile && (
            <button
              type="button"
              className="mc-inspector-panel__icon-btn"
              onClick={toggleInspectorCollapsed}
              aria-label={collapseLabel}
              title={collapseLabel}
            >
              ─
            </button>
          )}
          <button
            type="button"
            className="mc-inspector-panel__icon-btn"
            onClick={toggleInspector}
            aria-label={closeLabel}
            title={closeLabel}
          >
            ×
          </button>
        </div>
      </div>
      <div className="app-inspector-body">
        {tab === 'props' && (
          <div className="mc-inspector-panel__props">
            {inspector}
          </div>
        )}
        {tab === 'code' && canSeeCode && (
          <div className="mc-inspector-panel__code">
            {codePane}
          </div>
        )}
        {tab === 'code' && !canSeeCode && (
          <div className="mc-inspector-panel__code">
            {lockedCodePane}
          </div>
        )}
      </div>
    </div>
  );
}
