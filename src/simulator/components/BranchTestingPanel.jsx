import React from 'react';

/**
 * ManyChat-style branch / condition testing helpers.
 */
export default function BranchTestingPanel({
  busy,
  lastBranchPort,
  lastInbound,
  subscriberTags = [],
  onAddTag,
  onRemoveTag,
  onRepeatLast,
  onInjectConditionProbe,
}) {
  return (
    <div className="chat-sim__branch-panel">
      <span className="chat-sim__injector-label">Ветки</span>
      {lastBranchPort != null && (
        <div className={`chat-sim__branch-result chat-sim__branch-result--${lastBranchPort}`}>
          Последняя ветка: <strong>{lastBranchPort === 'true' ? 'Да' : 'Нет'}</strong>
        </div>
      )}
      <div className="chat-sim__branch-row">
        <button
          type="button"
          className="chat-sim__injector-btn"
          disabled={busy || !lastInbound}
          title="Повторить последний входящий шаг"
          onClick={onRepeatLast}
        >
          ↻ Повтор
        </button>
        <button
          type="button"
          className="chat-sim__injector-btn"
          disabled={busy}
          onClick={() => onInjectConditionProbe?.('tag:vip')}
        >
          Probe tag:vip
        </button>
      </div>
      <div className="chat-sim__branch-row">
        <button
          type="button"
          className="chat-sim__injector-btn"
          disabled={busy}
          onClick={() => onAddTag?.('vip')}
        >
          +vip
        </button>
        <button
          type="button"
          className="chat-sim__injector-btn"
          disabled={busy}
          onClick={() => onAddTag?.('buyer')}
        >
          +buyer
        </button>
        <button
          type="button"
          className="chat-sim__injector-btn"
          disabled={busy || !subscriberTags.includes('vip')}
          onClick={() => onRemoveTag?.('vip')}
        >
          −vip
        </button>
      </div>
    </div>
  );
}
