/**
 * Module library — insertion preview, topology, conflicts, staged actions.
 */

import { ModuleCompositionPanel } from './ModuleCompositionPanel.jsx';
import { CONFLICT_RESOLUTION_OPTIONS } from '../modules/library/conflict_resolution.js';
import { formatTopologySummary } from '../modules/library/topology_preview.js';

export function ModuleLibraryInsertPanel({
  selected,
  catalogEntry,
  insertionPreview,
  composeLoading,
  lang = 'ru',
  topologyOpen,
  onToggleTopology,
  onInsertGraph,
  onMigrate,
  onPreviewLegacy,
  onInsertIsolated,
  onAutoAddDependencies,
  onComposeSuite,
  onResolveGlobal,
  t = {},
}) {
  const labels = {
    ru: {
      insert: 'Вставить в редактор',
      whyDisabled: 'Почему нельзя вставить',
      migrate: 'Конвертировать в Graph',
      previewOnly: 'Только preview',
      isolated: 'Вставить как изолированный фрагмент',
      topology: 'Посмотреть структуру',
      autoDeps: 'Добавить автоматически',
      legacyTitle: 'Старая DSL-архитектура',
      graphPreview: 'Предпросмотр graph',
    },
    en: {
      insert: 'Insert into editor',
      whyDisabled: 'Why insert is blocked',
      migrate: 'Convert to Graph',
      previewOnly: 'Preview only',
      isolated: 'Insert as isolated fragment',
      topology: 'View structure',
      autoDeps: 'Add automatically',
      legacyTitle: 'Legacy DSL architecture',
      graphPreview: 'Graph preview',
    },
  };
  const L = labels[lang] || labels.ru;

  const entry = catalogEntry;
  const preview = insertionPreview;
  const canGraphInsert = entry?.canInsert && preview?.ok;
  const blockers = preview?.blockers || [];
  const topology = preview?.topology;

  return (
    <div
      className="neo-lib-insert-bar"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '14px 20px',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {entry?.legacyNotice && (
        <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.5 }}>
          {entry.legacyNotice}
        </div>
      )}

      {blockers.length > 0 && (
        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>{L.whyDisabled}</div>
          {blockers.map((b, i) => (
            <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
              {b.message}
              {b.suggestedAction?.type === 'add_dependency' && onAutoAddDependencies && (
                <button
                  type="button"
                  onClick={() => onAutoAddDependencies(b.suggestedAction.moduleId)}
                  style={{
                    display: 'block',
                    marginTop: 6,
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(62,207,142,0.4)',
                    background: 'rgba(62,207,142,0.12)',
                    color: '#3ecf8e',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  {L.autoDeps}: {b.suggestedAction.moduleId}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {topology && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', whiteSpace: 'pre-line' }}>
          {formatTopologySummary(topology, lang)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div
          className="neo-lib-code-preview"
          style={{
            flex: 1,
            minWidth: 200,
            background: '#0d0d0f',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '10px 14px',
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
            maxHeight: 110,
            overflowY: 'auto',
            whiteSpace: 'pre',
          }}
        >
          {entry?.graphNative
            ? (preview?.ok
              ? `${L.graphPreview}\n${formatTopologySummary(topology, lang)}`
              : (composeLoading ? '…' : t.libGraphPreview || 'Сборка предпросмотра…'))
            : (selected?.code?.slice(0, 400) || t.libLegacyPreview || 'Legacy DSL')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {entry?.graphNative && (
            <>
              <button
                type="button"
                className="neo-lib-primary-btn"
                disabled={composeLoading || !canGraphInsert}
                title={!canGraphInsert && blockers[0]?.message ? blockers[0].message : ''}
                style={{
                  background: canGraphInsert
                    ? 'linear-gradient(135deg,#ffd700,#ffaa00)'
                    : 'rgba(255,255,255,0.12)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 22px',
                  color: canGraphInsert ? '#111' : 'rgba(255,255,255,0.35)',
                  fontWeight: 800,
                  fontFamily: 'Syne, system-ui',
                  fontSize: 13,
                  cursor: composeLoading ? 'wait' : (canGraphInsert ? 'pointer' : 'not-allowed'),
                  whiteSpace: 'nowrap',
                  boxShadow: canGraphInsert ? '0 4px 16px rgba(255,215,0,0.35)' : 'none',
                }}
                onClick={onInsertGraph}
              >
                {composeLoading ? '…' : L.insert}
              </button>
              {onToggleTopology && topology && (
                <button
                  type="button"
                  onClick={onToggleTopology}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: topologyOpen ? 'rgba(255,215,0,0.12)' : 'transparent',
                    color: '#fff',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {L.topology}
                </button>
              )}
            </>
          )}

          {entry?.canMigrate && (
            <>
              <button
                type="button"
                onClick={onMigrate}
                disabled={composeLoading}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg,#38bdf8,#6366f1)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {L.migrate}
              </button>
              {onPreviewLegacy && (
                <button type="button" onClick={onPreviewLegacy} style={secondaryBtnStyle}>
                  {L.previewOnly}
                </button>
              )}
              {onInsertIsolated && (
                <button
                  type="button"
                  onClick={onInsertIsolated}
                  disabled={composeLoading}
                  style={secondaryBtnStyle}
                >
                  {L.isolated}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {topologyOpen && topology && (
        <ModuleTopologyDetail topology={topology} lang={lang} />
      )}

      {(preview?.conflicts?.length > 0 || preview?.fixes?.length > 0) && (
        <ModuleCompositionPanel
          report={{
            conflicts: preview.conflicts,
            fixes: preview.fixes,
            resolvedDependencies: preview.resolvedDependencies,
            ok: preview.ok,
          }}
          selectedIds={preview.moduleIds}
          lang={lang}
          onComposeSuite={onComposeSuite}
          t={t}
          globalConflicts={preview.conflicts?.filter((c) => c.kind === 'global')}
          onResolveGlobal={onResolveGlobal}
          resolutionOptions={CONFLICT_RESOLUTION_OPTIONS}
        />
      )}
    </div>
  );
}

const secondaryBtnStyle = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.8)',
  fontSize: 12,
  cursor: 'pointer',
};

function ModuleTopologyDetail({ topology, lang }) {
  const types = Object.entries(topology.byType || {})
    .map(([t, n]) => `${t}: ${n}`)
    .join(', ');
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
        maxHeight: 200,
        overflowY: 'auto',
      }}
    >
      <div><strong>{lang === 'en' ? 'Handlers' : 'Обработчики'}:</strong> {topology.handlers}</div>
      <div><strong>Callbacks:</strong> {topology.routes?.join(', ') || '—'}</div>
      <div><strong>{lang === 'en' ? 'Globals' : 'Глобальные'}:</strong> {topology.globals?.join(', ') || '—'}</div>
      <div><strong>{lang === 'en' ? 'FSM nodes' : 'Состояния'}:</strong> {topology.states}</div>
      <div style={{ marginTop: 6, opacity: 0.8 }}>{types}</div>
    </div>
  );
}
