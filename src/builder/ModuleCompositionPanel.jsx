/**
 * Merge preview / conflicts panel for graph module composition.
 */

import { GRAPH_MODULE_REGISTRY } from '../modules/graph/registry.js';

function conflictSeverity(kind) {
  if (kind === 'dependency' || kind === 'manifest') return 'error';
  if (kind === 'callback' || kind === 'global') return 'warning';
  return 'info';
}

export function ModuleCompositionPanel({
  report,
  selectedIds = [],
  lang = 'ru',
  onComposeSuite,
  t = {},
  globalConflicts = [],
  onResolveGlobal,
  resolutionOptions = [],
}) {
  if (!report && !selectedIds.length) return null;

  const conflicts = report?.conflicts || [];
  const fixes = report?.fixes || [];
  const deps = report?.resolvedDependencies || [];

  const labels = {
    ru: {
      title: 'Слияние модулей',
      deps: 'Зависимости',
      fixes: 'Авто-исправления',
      conflicts: 'Конфликты',
      suite: 'Собрать admin suite',
      graph: 'Graph-модуль',
      legacy: 'Legacy DSL',
    },
    en: {
      title: 'Module merge',
      deps: 'Dependencies',
      fixes: 'Auto-fixes',
      conflicts: 'Conflicts',
      suite: 'Compose admin suite',
      graph: 'Graph module',
      legacy: 'Legacy DSL',
    },
    uk: {
      title: "Злиття модулів",
      deps: 'Залежності',
      fixes: 'Авто-виправлення',
      conflicts: 'Конфлікти',
      suite: 'Зібрати admin suite',
      graph: 'Graph-модуль',
      legacy: 'Legacy DSL',
    },
  };
  const L = labels[lang] || labels.ru;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{L.title}</div>

      {selectedIds.length > 0 && (
        <div style={{ marginBottom: 8, opacity: 0.85 }}>
          {selectedIds.map((id) => (
            <span
              key={id}
              style={{
                display: 'inline-block',
                marginRight: 6,
                marginBottom: 4,
                padding: '2px 8px',
                borderRadius: 6,
                background: GRAPH_MODULE_REGISTRY[id]
                  ? 'rgba(62,207,142,0.15)'
                  : 'rgba(251,191,36,0.12)',
                color: GRAPH_MODULE_REGISTRY[id] ? '#3ecf8e' : '#fbbf24',
              }}
            >
              {GRAPH_MODULE_REGISTRY[id] ? L.graph : L.legacy}: {id}
            </span>
          ))}
        </div>
      )}

      {deps.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ opacity: 0.7 }}>{L.deps}: </span>
          {deps.join(' → ')}
        </div>
      )}

      {fixes.length > 0 && (
        <ul style={{ margin: '6px 0', paddingLeft: 16, color: '#3ecf8e' }}>
          {fixes.slice(0, 6).map((f, i) => (
            <li key={`fix-${i}`}>{f.message}</li>
          ))}
        </ul>
      )}

      {conflicts.length > 0 && (
        <ul style={{ margin: '6px 0', paddingLeft: 16 }}>
          {conflicts.slice(0, 8).map((c, i) => (
            <li
              key={`c-${i}`}
              style={{
                color: conflictSeverity(c.kind) === 'error' ? '#f87171' : '#fbbf24',
              }}
            >
              {c.message}
            </li>
          ))}
        </ul>
      )}

      {globalConflicts?.length > 0 && typeof onResolveGlobal === 'function' && (
        <div style={{ marginTop: 8 }}>
          {globalConflicts.map((c, i) => (
            <div key={i} style={{ marginBottom: 6, fontSize: 11, color: '#fbbf24' }}>
              {c.message}
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {(resolutionOptions.length ? resolutionOptions : [
                  { id: 'reuse', labelRu: 'Использовать существующий', labelEn: 'Use existing' },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onResolveGlobal(c, opt.id)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.06)',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      fontSize: 10,
                    }}
                  >
                    {lang === 'en' ? opt.labelEn : opt.labelRu}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {typeof onComposeSuite === 'function' && (
        <button
          type="button"
          onClick={onComposeSuite}
          style={{
            marginTop: 8,
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid rgba(62,207,142,0.35)',
            background: 'rgba(62,207,142,0.1)',
            color: '#3ecf8e',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {L.suite}
        </button>
      )}
    </div>
  );
}
