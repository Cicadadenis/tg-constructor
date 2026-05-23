import React from 'react';
import { getConstructorStrings } from '../builderI18n.js';

const ACTION_LABELS = {
  ru: {
    jump: 'Перейти к ошибке',
    remove_edge: 'Удалить битую связь',
    repair_callbacks: 'Создать обработчики',
    auto_repair: 'Исправить',
    reset_graph: 'Сбросить graph',
    show_all_nodes: 'Показать все блоки',
  },
  en: {
    jump: 'Go to issue',
    remove_edge: 'Remove broken link',
    repair_callbacks: 'Create handlers',
    auto_repair: 'Fix',
    reset_graph: 'Reset graph',
    show_all_nodes: 'Show all blocks',
  },
};

/**
 * Single normalized error card.
 */
export function GraphErrorCard({
  error,
  lang = 'ru',
  onJump,
  onAction,
  compact = false,
  capabilities = null,
}) {
  const labels = ACTION_LABELS[lang] || ACTION_LABELS.ru;
  const nodeIds = error.nodeIds?.length ? error.nodeIds : (error.nodeId ? [error.nodeId] : []);
  const edgeIds = error.edgeIds?.length
    ? error.edgeIds
    : (error.edgeId ? [error.edgeId] : (error._edgeId ? [error._edgeId] : []));
  const canJump = nodeIds.length > 0 || edgeIds.length > 0;

  const severityColor = error.severity === 'warning'
    ? { border: 'rgba(251,191,36,0.45)', bg: 'rgba(251,191,36,0.08)', title: '#fde68a' }
    : error.severity === 'info'
      ? { border: 'rgba(99,102,241,0.35)', bg: 'rgba(99,102,241,0.08)', title: '#c7d2fe' }
      : { border: 'rgba(239,68,68,0.35)', bg: 'rgba(239,68,68,0.08)', title: '#fecaca' };

  const handleJump = () => {
    if (edgeIds[0]) onJump?.({ edgeIds, nodeIds });
    else if (nodeIds.length) onJump?.({ nodeIds, edgeIds: [] });
  };

  return (
    <div
      style={{
        textAlign: 'left',
        background: severityColor.bg,
        border: `1px solid ${severityColor.border}`,
        borderRadius: 8,
        padding: compact ? '8px 10px' : '10px 12px',
        fontFamily: 'Syne, system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: severityColor.title, lineHeight: 1.45 }}>
        {error.title}
        {error.count > 1 ? ` (${error.count})` : ''}
      </div>
      {!compact && error.cause && (
        <div style={{ fontSize: 10, color: 'rgba(254,202,202,0.75)', lineHeight: 1.5, marginTop: 6 }}>
          {error.cause}
        </div>
      )}
      {error.fix && (
        <div style={{
          fontSize: 10,
          color: 'rgba(254,202,202,0.9)',
          lineHeight: 1.5,
          marginTop: compact ? 4 : 6,
          fontWeight: 600,
        }}
        >
          → {error.fix}
        </div>
      )}
      {error.repaired && (
        <div style={{ fontSize: 10, color: '#86efac', marginTop: 4, fontWeight: 700 }}>
          ✓ {lang === 'en' ? 'Repaired' : 'Исправлено'}
        </div>
      )}
      {error.manualStrategy && !error.autoFixAvailable && (
        <div style={{ fontSize: 10, color: 'rgba(167,139,250,0.9)', marginTop: 4, lineHeight: 1.45 }}>
          💡 {error.manualStrategy}
        </div>
      )}
      {error.aiNote && (
        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.85)', marginTop: 4, lineHeight: 1.4 }}>
          {error.aiNote}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {canJump && (
          <button type="button" onClick={handleJump} style={actionBtnStyle}>
            {labels.jump}
          </button>
        )}
        {error.autoFixAvailable && !error.repaired && (
          <button
            type="button"
            onClick={() => onAction?.('auto_repair', error)}
            style={{ ...actionBtnStyle, borderColor: 'rgba(62,207,142,0.5)', color: '#86efac' }}
          >
            {labels.auto_repair}
          </button>
        )}
        {(error.actions || []).filter((a) => a !== 'jump' && a !== 'auto_repair').map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction?.(action, error)}
            style={actionBtnStyle}
          >
            {labels[action] || action}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Grouped error list for canvas overlay / diagnostics panel.
 */
export default function GraphDiagnosticsRenderer({
  errors = [],
  lang = 'ru',
  maxVisible = 4,
  onJump,
  onAction,
  footer = null,
  capabilities = null,
}) {
  const ui = getConstructorStrings(lang);
  const visible = errors.slice(0, maxVisible);
  const hidden = Math.max(0, errors.length - visible.length);

  if (!errors.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {visible.map((err, i) => (
        <GraphErrorCard
          key={`ge-${err.code}-${i}`}
          error={err}
          lang={lang}
          onJump={onJump}
          onAction={onAction}
          capabilities={capabilities}
        />
      ))}
      {hidden > 0 && (
        <div style={{ fontSize: 10, color: 'rgba(254,202,202,0.6)', lineHeight: 1.45 }}>
          {(ui.canvasErrorsMoreGroups || 'Ещё {count} типов ошибок.')
            .replace('{count}', String(hidden))}
        </div>
      )}
      {footer}
    </div>
  );
}

const actionBtnStyle = {
  padding: '4px 10px',
  fontSize: 9,
  fontWeight: 700,
  borderRadius: 6,
  border: '1px solid rgba(99,102,241,0.35)',
  background: 'rgba(99,102,241,0.12)',
  color: '#c7d2fe',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
