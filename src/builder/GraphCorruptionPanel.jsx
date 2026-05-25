import React, { useMemo } from 'react';
import { auditGraphCorruption } from '../constructor/graph_document/graph_state_repair.js';
import { compilePurgeInvalidEdges } from '../constructor/graph_document/graph_state_repair.js';

/**
 * Detailed legacy corruption report + repair actions.
 */
export default function GraphCorruptionPanel({
  document,
  lang = 'ru',
  onApplyRepair,
  onResetGraph,
  onHighlightEdge,
  onHighlightNodeIds,
}) {
  const audit = useMemo(() => (document ? auditGraphCorruption(document) : null), [document]);

  const labels = lang === 'en'
    ? {
        title: 'Flow health check',
        dangling: 'Broken connections in file',
        stale: 'Removed on last import',
        nodes: 'Steps in flow',
        edges: 'Connections (valid / total)',
        ghostSel: 'Stale selection',
        orphans: 'Disconnected steps',
        purge: 'Remove broken connections',
        reset: 'Fully reset corrupted flow',
        jump: 'Highlight on canvas',
        none: 'No issues detected',
      }
    : {
        title: 'Проверка целостности сценария',
        dangling: 'Битые связи в файле',
        stale: 'Удалены при загрузке',
        nodes: 'Шагов в сценарии',
        edges: 'Связей (корректных / всего)',
        ghostSel: 'Устаревшее выделение',
        orphans: 'Несвязанные шаги',
        purge: 'Удалить битые связи',
        reset: 'Полностью сбросить повреждённый сценарий',
        jump: 'Подсветить на холсте',
        none: 'Проблем не обнаружено',
      };

  if (!audit) return null;

  const hasIssue = audit.danglingEdges.length > 0
    || audit.staleHydrationCount > 0
    || audit.ghostSelectionIds.length > 0
    || audit.canvasMismatch;

  if (!hasIssue && !onResetGraph) return null;

  const runPurge = () => {
    const compiled = compilePurgeInvalidEdges(document);
    if (compiled.ok && onApplyRepair) onApplyRepair(compiled.operations);
  };

  return (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        background: 'rgba(30,20,20,0.95)',
        border: '1px solid rgba(248,113,113,0.4)',
        fontSize: 10,
        color: 'rgba(254,202,202,0.9)',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#fca5a5', fontFamily: 'Syne, system-ui' }}>
        {labels.title}
      </div>
      {!hasIssue ? (
        <div style={{ opacity: 0.7 }}>{labels.none}</div>
      ) : (
        <>
          <div style={{ marginBottom: 6 }}>
            {labels.nodes}: {audit.nodeCount}
            {' · '}
            {labels.edges}: {audit.validEdgeCount} / {audit.edgeCount}
          </div>
          {audit.staleHydrationCount > 0 && (
            <div style={{ marginBottom: 6, color: 'rgba(253,230,138,0.85)' }}>
              {labels.stale}: {audit.staleHydrationCount}
            </div>
          )}
          {audit.danglingEdges.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{labels.dangling}:</div>
              {audit.danglingEdges.slice(0, 8).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onHighlightEdge?.(e.id);
                    const ids = [e.source, e.target].filter(Boolean);
                    if (ids.length) onHighlightNodeIds?.(ids);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    marginBottom: 4,
                    padding: '4px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(248,113,113,0.25)',
                    background: 'rgba(0,0,0,0.25)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 9,
                  }}
                >
                  {e.id}: {e.source} → {e.target}
                  {e.invalidReason ? ` (${e.invalidReason})` : ''}
                </button>
              ))}
              {audit.danglingEdges.length > 8 && (
                <div style={{ opacity: 0.6 }}>+{audit.danglingEdges.length - 8} …</div>
              )}
            </div>
          )}
          {audit.ghostSelectionIds.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              {labels.ghostSel}: {audit.ghostSelectionIds.join(', ')}
            </div>
          )}
          {audit.orphanNodeIds.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              {labels.orphans}: {audit.orphanNodeIds.slice(0, 6).join(', ')}
              {audit.orphanNodeIds.length > 6 ? ` +${audit.orphanNodeIds.length - 6}` : ''}
            </div>
          )}
        </>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {audit.danglingEdges.length > 0 && (
          <button type="button" onClick={runPurge} style={btnStyle}>
            {labels.purge}
          </button>
        )}
        {onResetGraph && (
          <button type="button" onClick={onResetGraph} style={{ ...btnStyle, borderColor: 'rgba(239,68,68,0.6)', color: '#fecaca' }}>
            {labels.reset}
          </button>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  fontSize: 10,
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid rgba(99,102,241,0.4)',
  background: 'rgba(99,102,241,0.15)',
  color: '#c7d2fe',
  cursor: 'pointer',
};
