import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MC_SPRING, tabPanelVariants } from '../../motion/index.js';
import { useAppLayout } from '../../layout/AppLayoutContext.jsx';
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
  children,
  empty = null,
  codePane = null,
  lockedCodePane = null,
  canSeeCode = false,
  onLockedCodeTab,
  hasSelection = false,
  onFocusCanvas,
}) {
  const tab = normalizeInspectorTab(tabProp);
  const { isMobile } = useAppLayout();

  const showCodeInSettings = tab === 'settings' && (codePane || lockedCodePane);

  return (
    <div className="fi-shell app-zone app-zone--right mc-inspector-panel" data-zone="right" data-tour="props-panel-desktop">
      {!hasSelection ? (
        empty || <FlowInspectorEmpty lang={lang} onFocusCanvas={onFocusCanvas} />
      ) : (
        <>
          {header}
          <div className="fi-shell__scroll">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                className="fi-shell__tab-panel"
                variants={tabPanelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={MC_SPRING.gentle}
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
          {isMobile && null}
        </>
      )}
    </div>
  );
}
