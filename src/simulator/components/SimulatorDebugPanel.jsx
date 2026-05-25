import React from 'react';

function VarTable({ variables }) {
  const entries = Object.entries(variables || {});
  if (!entries.length) {
    return <p className="chat-sim__debug-empty">Нет переменных</p>;
  }
  return (
    <table className="chat-sim__var-table">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td className="chat-sim__var-key">{k}</td>
            <td className="chat-sim__var-val">{String(v ?? '')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SubscriberCard({ snapshot }) {
  const sub = snapshot?.subscriber;
  if (!sub) return <p className="chat-sim__debug-empty">Загрузка…</p>;
  const tags = Array.isArray(sub.tags) ? sub.tags : [];
  const fields = sub.customFields && typeof sub.customFields === 'object'
    ? Object.entries(sub.customFields)
    : [];
  return (
    <div className="chat-sim__sub-card">
      <div><span className="chat-sim__sub-label">ID</span> {sub.externalUserId ?? sub.id}</div>
      <div><span className="chat-sim__sub-label">Имя</span> {sub.displayName ?? '—'}</div>
      <div><span className="chat-sim__sub-label">Теги</span> {tags.length ? tags.join(', ') : '—'}</div>
      <div><span className="chat-sim__sub-label">Канал</span> {sub.channel ?? 'telegram'}</div>
      {fields.length > 0 && (
        <div className="chat-sim__sub-fields">
          {fields.map(([k, v]) => (
            <div key={k}><span className="chat-sim__sub-label">{k}</span> {String(v ?? '')}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SimulatorDebugPanel({
  open,
  onToggle,
  tab,
  onTabChange,
  variables,
  executionPath,
  activeNodeId,
  subscriberSnapshot,
  stepLog,
  lastTraceId,
  replayIndex,
  messageCount,
  snapshotCount = 0,
  onReplayIndex,
  onReplaySnapshot,
  lastBranchPort,
  testMode,
  onTestModeChange,
  liveMode,
  onLiveModeChange,
}) {
  const tabs = [
    { id: 'path', label: 'Путь' },
    { id: 'vars', label: 'Данные' },
    { id: 'sub', label: 'Подписчик' },
    { id: 'replay', label: 'Повтор' },
  ];

  return (
    <aside className={`chat-sim__debug ${open ? 'chat-sim__debug--open' : ''}`}>
      <div className="chat-sim__debug-head">
        <span className="chat-sim__debug-title">Данные подписчика</span>
        <button type="button" className="chat-sim__debug-toggle" onClick={onToggle}>
          {open ? '◂' : '▸'}
        </button>
      </div>
      {open && (
        <>
          <div className="chat-sim__debug-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chat-sim__debug-tab ${tab === t.id ? 'chat-sim__debug-tab--active' : ''}`}
                onClick={() => onTabChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="chat-sim__test-mode">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(e) => onTestModeChange?.(e.target.checked)}
            />
            Тестовый режим (печатает… и паузы)
          </label>
          <label className="chat-sim__test-mode">
            <input
              type="checkbox"
              checked={liveMode !== false}
              onChange={(e) => onLiveModeChange?.(e.target.checked)}
            />
            Обновления в реальном времени
          </label>
          {lastBranchPort && (
            <div className={`chat-sim__debug-branch chat-sim__debug-branch--${lastBranchPort}`}>
              Ветка: {lastBranchPort}
            </div>
          )}

          <div className="chat-sim__debug-body">
            {tab === 'path' && (
              <>
                <div className="chat-sim__active-node">
                  <span className="chat-sim__sub-label">Текущий шаг</span>
                  <code>{activeNodeId || '—'}</code>
                </div>
                {lastTraceId && (
                  <div className="chat-sim__trace-id">
                    сессия: <code>{lastTraceId.slice(0, 12)}…</code>
                  </div>
                )}
                <ol className="chat-sim__path-list">
                  {(executionPath || []).slice().reverse().map((step) => (
                    <li key={step.id} className="chat-sim__path-item">
                      <time>{new Date(step.ts).toLocaleTimeString()}</time>
                      <span className="chat-sim__path-in">{step.inbound}</span>
                      {step.nodeLabels?.length > 0 && (
                        <span className="chat-sim__path-nodes">{step.nodeLabels.join(' → ')}</span>
                      )}
                      {step.branchPort && (
                        <span className={`chat-sim__path-branch chat-sim__path-branch--${step.branchPort}`}>
                          {step.branchPort}
                        </span>
                      )}
                      <span className="chat-sim__path-meta">{step.outboundCount} effects</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {tab === 'vars' && <VarTable variables={variables} />}
            {tab === 'sub' && <SubscriberCard snapshot={subscriberSnapshot} />}
            {tab === 'replay' && (
              <div className="chat-sim__replay">
                <p className="chat-sim__replay-hint">
                  Шагов: {snapshotCount || messageCount}. Перемотка восстанавливает чат и переменные.
                </p>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, (snapshotCount || messageCount) - 1)}
                  value={Math.max(0, replayIndex)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (onReplaySnapshot && snapshotCount > 0) onReplaySnapshot(v);
                    else onReplayIndex?.(v);
                  }}
                  className="chat-sim__replay-slider"
                />
                <div className="chat-sim__replay-steps">
                  {(stepLog || []).slice(-8).reverse().map((s, i) => (
                    <button
                      key={`${s.ts}-${i}`}
                      type="button"
                      className="chat-sim__replay-step"
                      onClick={() => {
                        const snapIdx = Math.max(0, (stepLog?.length ?? 1) - 1 - i);
                        if (onReplaySnapshot) onReplaySnapshot(snapIdx);
                      }}
                    >
                      {s.inbound}
                      {s.branchPort ? ` · ${s.branchPort}` : ''}
                      {' · '}
                      {new Date(s.ts).toLocaleTimeString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
