import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppLayout } from '../../layout/AppLayoutContext.jsx';
import FlowInspectorTabBar from './FlowInspectorTabBar.jsx';
import FlowInspectorEmpty from './FlowInspectorEmpty.jsx';
import { normalizeInspectorTab } from './inspectorTabs.js';
import './flow-inspector.css';

/**
 * Right rail — live simulator (primary) + contextual properties (secondary).
 */
export default function FlowInspectorShell({
  tab: tabProp,
  onTabChange,
  lang = 'ru',
  header = null,
  preview = null,
  children,
  empty = null,
  codePane = null,
  lockedCodePane = null,
  canSeeCode = false,
  onLockedCodeTab,
  simulatorPane = null,
  hasSelection = false,
  onFocusCanvas,
}) {
  const tab = normalizeInspectorTab(tabProp);
  const { isMobile, toggleInspector, toggleInspectorCollapsed } = useAppLayout();
  const hasSimulator = Boolean(simulatorPane);

  const collapseLabel = lang === 'en' ? 'Minimize' : 'Свернуть';
  const closeLabel = lang === 'en' ? 'Close panel' : 'Закрыть панель';
  const propsLabel = lang === 'en' ? 'Step properties' : 'Свойства шага';

  const handleTabChange = (next) => {
    onTabChange?.(normalizeInspectorTab(next));
  };

  const showCodeInSettings = tab === 'settings' && (codePane || lockedCodePane);

  return (
    <div className={`fi-shell app-zone app-zone--right mc-inspector-panel${hasSimulator ? ' fi-shell--with-sim' : ''}`} data-zone="right" data-tour="props-panel-desktop">
      <div className="fi-shell__chrome">
        {hasSimulator && (
          <div className="fi-shell__chrome-title">
            <span className="fi-shell__chrome-live-dot" aria-hidden />
            {lang === 'en' ? 'Live preview' : lang === 'uk' ? 'Живий перегляд' : 'Живой превью'}
          </div>
        )}
        {hasSelection && (
          <FlowInspectorTabBar tab={tab} onTabChange={handleTabChange} lang={lang} />
        )}
        <div className="fi-shell__chrome-actions">
          {!isMobile && (
            <button
              type="button"
              className="fi-shell__icon-btn"
              onClick={toggleInspectorCollapsed}
              aria-label={collapseLabel}
              title={collapseLabel}
            >
              ─
            </button>
          )}
          <button
            type="button"
            className="fi-shell__icon-btn"
            onClick={toggleInspector}
            aria-label={closeLabel}
            title={closeLabel}
          >
            ×
          </button>
        </div>
      </div>

      <div className="fi-shell__body">
        {hasSimulator ? (
          <div className="fi-shell__split">
            <div className="fi-shell__sim-primary">
              {simulatorPane}
            </div>
            <div className={`fi-shell__props-pane${hasSelection ? '' : ' fi-shell__props-pane--idle'}`}>
              {hasSelection ? (
                <>
                  <div className="fi-shell__props-label">{propsLabel}</div>
                  {header}
                  {tab === 'content' && preview}
                  <div className="fi-shell__scroll fi-shell__scroll--nested">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={tab}
                        className="fi-shell__tab-panel"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.14 }}
                      >
                        {children}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  {showCodeInSettings && (
                    <div className="fi-shell__code">
                      {canSeeCode ? codePane : lockedCodePane}
                    </div>
                  )}
                </>
              ) : (
                <div className="fi-shell__props-idle">
                  <p>{lang === 'en' ? 'Select a step on the canvas to edit properties.' : 'Выберите шаг на холсте, чтобы редактировать свойства.'}</p>
                  {onFocusCanvas && (
                    <button type="button" className="fi-shell__props-idle-btn" onClick={onFocusCanvas}>
                      {lang === 'en' ? 'Canvas' : 'Холст'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : !hasSelection ? (
          empty || <FlowInspectorEmpty lang={lang} onFocusCanvas={onFocusCanvas} />
        ) : (
          <>
            {header}
            {tab === 'content' && preview}
            <div className="fi-shell__scroll">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  className="fi-shell__tab-panel"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.16 }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
            {showCodeInSettings && (
              <div className="fi-shell__code">
                {canSeeCode ? codePane : lockedCodePane}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
