import React from 'react';

const SELECT_STYLE = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 11,
  borderRadius: 8,
  border: '1px solid rgba(99,102,241,0.5)',
  background: 'var(--bg)',
  color: 'var(--text)',
  cursor: 'pointer',
};

/**
 * Searchable graph reference picker — shows display labels only (no raw callback_data in UI).
 */
export default function SmartGraphRefPicker({
  title,
  refs = [],
  selectedRefId = '',
  selectedCompileValue = '',
  onSelect,
  onJumpToNode,
  onCreateNew,
  createLabel = 'Создать обработчик',
  emptyHint,
  allowManual = false,
  manualValue = '',
  onManualChange,
  manualPlaceholder = '',
}) {
  const [query, setQuery] = React.useState('');
  const selected = refs.find((r) => r.id === selectedRefId)
    || refs.find((r) => r.compileValue === selectedCompileValue);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return refs;
    return refs.filter((r) => (
      r.displayLabel?.toLowerCase().includes(q)
      || r.ownerLabel?.toLowerCase().includes(q)
      || r.compileValue?.toLowerCase().includes(q)
    ));
  }, [refs, query]);

  if (!refs.length) {
    return emptyHint ? (
      <div style={{
        padding: '10px 12px',
        borderRadius: 8,
        fontSize: 10,
        lineHeight: 1.5,
        color: 'var(--text3)',
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.25)',
      }}>
        {emptyHint}
      </div>
    ) : null;
  }

  return (
    <div style={{
      marginBottom: 12,
      padding: '10px 12px',
      borderRadius: 8,
      background: 'rgba(99,102,241,0.1)',
      border: '1px solid rgba(99,102,241,0.32)',
    }}>
      {title && (
        <div style={{
          fontSize: 9,
          color: '#a78bfa',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
          marginBottom: 8,
          fontWeight: 700,
        }}>
          {title}
        </div>
      )}
      {refs.length > 6 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск…"
          style={{
            width: '100%',
            marginBottom: 8,
            padding: '6px 8px',
            fontSize: 10,
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'var(--bg)',
            color: 'var(--text)',
          }}
        />
      )}
      <select
        value={selected?.id || ''}
        onChange={(e) => {
          const ref = refs.find((r) => r.id === e.target.value);
          if (ref) onSelect?.(ref);
        }}
        style={SELECT_STYLE}
      >
        <option value="">— Выберите —</option>
        {filtered.map((ref) => (
          <option key={ref.id} value={ref.id}>
            {ref.ownerLabel ? `${ref.displayLabel}  ·  ${ref.ownerLabel}` : ref.displayLabel}
          </option>
        ))}
      </select>
      {selected && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {onJumpToNode && (
            <button
              type="button"
              onClick={() => onJumpToNode(selected.ownerNodeId)}
              style={{
                padding: '4px 8px',
                fontSize: 9,
                borderRadius: 6,
                border: '1px solid rgba(99,102,241,0.35)',
                background: 'rgba(99,102,241,0.15)',
                color: '#c4b5fd',
                cursor: 'pointer',
              }}
            >
              Показать на холсте
            </button>
          )}
          {onCreateNew && (
            <button
              type="button"
              onClick={() => onCreateNew(selected)}
              style={{
                padding: '4px 8px',
                fontSize: 9,
                borderRadius: 6,
                border: '1px solid rgba(62,207,142,0.35)',
                background: 'rgba(62,207,142,0.12)',
                color: '#3ecf8e',
                cursor: 'pointer',
              }}
            >
              {createLabel}
            </button>
          )}
        </div>
      )}
      {allowManual && (
        <input
          value={manualValue}
          onChange={(e) => onManualChange?.(e.target.value)}
          placeholder={manualPlaceholder || 'Дополнительно вручную…'}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '6px 8px',
            fontSize: 10,
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'var(--bg)',
            color: 'var(--text2)',
          }}
        />
      )}
    </div>
  );
}
