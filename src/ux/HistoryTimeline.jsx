import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MC_SPRING, slideInRight, staggerContainer, staggerItem } from '../motion/index.js';

function formatOpType(type, lang) {
  const map = {
    AddNode: lang === 'en' ? 'Add step' : 'Добавить шаг',
    RemoveNode: lang === 'en' ? 'Remove step' : 'Удалить шаг',
    AddEdge: lang === 'en' ? 'Connect' : 'Связь',
    RemoveEdge: lang === 'en' ? 'Disconnect' : 'Убрать связь',
    UpdateNodeData: lang === 'en' ? 'Edit step' : 'Изменить шаг',
    MoveNode: lang === 'en' ? 'Move' : 'Переместить',
    GroupSelection: lang === 'en' ? 'Group' : 'Группа',
  };
  return map[type] || type;
}

/**
 * Visual undo/redo timeline — click to jump in history.
 */
export default function HistoryTimeline({
  open,
  onClose,
  entries = [],
  cursor = 0,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onJumpTo,
  lang = 'ru',
}) {
  const title = lang === 'en' ? 'History' : 'История';
  const futureCount = Math.max(0, entries.length - cursor);

  const visible = useMemo(
    () => entries.slice(Math.max(0, entries.length - 24)),
    [entries],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="ux-history"
          initial={slideInRight.initial}
          animate={slideInRight.animate}
          exit={slideInRight.exit}
          transition={MC_SPRING.panel}
          role="region"
          aria-label={title}
        >
          <header className="ux-history__head">
            <strong>{title}</strong>
            <div className="ux-history__actions">
              <button type="button" className="ux-history__btn" disabled={!canUndo} onClick={onUndo} title="Undo">↶</button>
              <button type="button" className="ux-history__btn" disabled={!canRedo} onClick={onRedo} title="Redo">↷</button>
              <button type="button" className="ux-history__btn ux-history__btn--close" onClick={onClose} aria-label="Close">×</button>
            </div>
          </header>
          <p className="ux-history__meta">
            {cursor} / {entries.length}
            {futureCount > 0 && ` · ${futureCount} ${lang === 'en' ? 'ahead' : 'впереди'}`}
          </p>
          <motion.ol
            className="ux-history__list"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {visible.map((entry) => (
              <motion.li
                key={`${entry.index}-${entry.revision}`}
                variants={staggerItem}
                layout
                className={[
                  'ux-history__item',
                  entry.isCurrent ? 'ux-history__item--current' : '',
                  entry.isFuture ? 'ux-history__item--future' : '',
                ].filter(Boolean).join(' ')}
              >
                <button
                  type="button"
                  className="ux-history__item-btn"
                  onClick={() => onJumpTo?.(entry.index + 1)}
                  disabled={entry.isFuture && !canRedo}
                >
                  <span className="ux-history__dot" aria-hidden />
                  <span className="ux-history__type">{formatOpType(entry.type, lang)}</span>
                  <span className="ux-history__rev">#{entry.revision}</span>
                </button>
              </motion.li>
            ))}
          </motion.ol>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
