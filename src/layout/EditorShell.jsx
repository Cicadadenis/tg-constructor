import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppLayout } from './AppLayoutContext.jsx';
import { useSelectionStore } from '../stores/selectionStore.js';
import './editor-shell.css';
import './editor-saas-shell.css';

const panelSpring = {
  type: 'spring',
  stiffness: 420,
  damping: 36,
  mass: 0.8,
};

const railVariants = {
  hidden: { opacity: 0, x: -24, scale: 0.98 },
  visible: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -16, scale: 0.98 },
};

const inspectorVariants = {
  hidden: { opacity: 0, x: 24, scale: 0.98 },
  visible: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 16, scale: 0.98 },
};

/**
 * ManyChat-style workspace: full-bleed canvas + floating panels.
 * Outer `.editor-shell--saas` wrapper lives in App.jsx (top bar + modals as siblings).
 */
export default function EditorShell({
  left,
  center,
  right,
  canvasControls = null,
  mobileNav = null,
  lang = 'ru',
}) {
  const {
    isMobile,
    mobileZone,
    leftRailOpen,
    inspectorOpen,
    inspectorCollapsed,
    focusMode,
    toggleLeftRail,
    toggleInspector,
    toggleInspectorCollapsed,
    toggleFocusMode,
    setInspectorOpen,
    setInspectorCollapsed,
    setFocusMode,
  } = useAppLayout();

  const inspectorRevealSeq = useSelectionStore((s) => s.inspectorRevealRequest?.seq ?? 0);

  useEffect(() => {
    if (!inspectorRevealSeq) return;
    setInspectorOpen(true);
    setInspectorCollapsed(false);
    setFocusMode(false);
  }, [inspectorRevealSeq, setInspectorOpen, setInspectorCollapsed, setFocusMode]);

  const showLeftDesktop = !isMobile && !focusMode && leftRailOpen;
  const showRightDesktop = !isMobile && !focusMode && inspectorOpen;
  const showLeftMobile = isMobile && mobileZone === 'left';
  const showRightMobile = isMobile && mobileZone === 'right';
  const showCenter = !isMobile || mobileZone === 'canvas';

  const focusLabel = lang === 'en'
    ? (focusMode ? 'Exit focus' : 'Focus mode')
    : lang === 'uk'
      ? (focusMode ? 'Вийти з фокусу' : 'Режим фокусу')
      : (focusMode ? 'Выйти из фокуса' : 'Режим фокуса');

  const leftToggleLabel = lang === 'en'
    ? (leftRailOpen ? 'Hide blocks' : 'Show blocks')
    : (leftRailOpen ? 'Скрыть панель' : 'Показать панель');

  const inspectorToggleLabel = lang === 'en'
    ? (inspectorOpen ? 'Hide inspector' : 'Show inspector')
    : (inspectorOpen ? 'Скрыть инспектор' : 'Показать инспектор');

  return (
    <div
      className={[
        'editor-shell__body',
        'editor-shell__body--saas',
        focusMode ? 'editor-shell--focus' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="editor-shell__stage">
        <div className="editor-shell__canvas-layer">
          {showCenter && center}
          {!focusMode && canvasControls}
        </div>

        <AnimatePresence>
          {(showLeftDesktop || showLeftMobile) && left && (
            <motion.aside
              key="left-rail"
              className="mc-floating-rail"
              variants={railVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={panelSpring}
              aria-label={lang === 'en' ? 'Blocks and flows' : 'Блоки и сценарии'}
            >
              {left}
            </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(showRightDesktop || showRightMobile) && right && (
            <motion.aside
              key="inspector"
              className={[
                'mc-floating-inspector',
                inspectorCollapsed ? 'mc-floating-inspector--collapsed' : '',
              ].filter(Boolean).join(' ')}
              variants={inspectorVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={panelSpring}
              aria-label={lang === 'en' ? 'Inspector' : 'Инспектор'}
            >
              {right}
            </motion.aside>
          )}
        </AnimatePresence>

        {!isMobile && !focusMode && (
          <>
            {!leftRailOpen && (
              <button
                type="button"
                className="mc-panel-toggle mc-panel-toggle--left"
                onClick={toggleLeftRail}
                aria-label={leftToggleLabel}
                title={leftToggleLabel}
              >
                ▶
              </button>
            )}
            {!inspectorOpen && (
              <button
                type="button"
                className="mc-panel-toggle mc-panel-toggle--right"
                onClick={toggleInspector}
                aria-label={inspectorToggleLabel}
                title={inspectorToggleLabel}
              >
                ◀
              </button>
            )}
          </>
        )}

        {!isMobile && (
          <button
            type="button"
            className="mc-focus-toggle"
            onClick={toggleFocusMode}
            aria-pressed={focusMode}
            title={focusLabel}
          >
            {focusMode ? '⊡ ' : '◻ '}{focusLabel}
          </button>
        )}
      </div>

      {isMobile && mobileNav}
    </div>
  );
}
