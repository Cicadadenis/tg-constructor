import React from 'react';
import './flow-history-toolbar.css';

/**
 * Undo / redo for flow builder graph operations.
 * @param {object} props
 * @param {boolean} props.canUndo
 * @param {boolean} props.canRedo
 * @param {() => void} props.onUndo
 * @param {() => void} props.onRedo
 * @param {string} [props.lang]
 */
export default function FlowHistoryToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  lang = 'ru',
}) {
  const undoTitle = lang === 'en' ? 'Undo (Ctrl+Z)' : lang === 'uk' ? 'Скасувати (Ctrl+Z)' : 'Отменить (Ctrl+Z)';
  const redoTitle = lang === 'en' ? 'Redo (Ctrl+Y)' : lang === 'uk' ? 'Повторити (Ctrl+Y)' : 'Повторить (Ctrl+Y)';

  return (
    <div className="flow-history-toolbar" role="toolbar" aria-label={lang === 'en' ? 'History' : 'История'}>
      <button
        type="button"
        className="flow-history-toolbar__btn"
        onClick={onUndo}
        disabled={!canUndo}
        title={undoTitle}
        aria-label={undoTitle}
      >
        ↶
      </button>
      <button
        type="button"
        className="flow-history-toolbar__btn"
        onClick={onRedo}
        disabled={!canRedo}
        title={redoTitle}
        aria-label={redoTitle}
      >
        ↷
      </button>
    </div>
  );
}
