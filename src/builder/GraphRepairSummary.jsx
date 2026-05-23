import React from 'react';
import { getConstructorStrings } from '../builderI18n.js';

export default function GraphRepairSummary({
  result,
  lang = 'ru',
  onShowRepairs,
  onUndoRepair,
}) {
  if (!result?.fixCount) return null;
  const ui = getConstructorStrings(lang);
  const labels = lang === 'en'
    ? {
        title: (n) => `Fixed ${n} issue(s)`,
        show: 'Show fixes',
        undo: 'Undo repair',
        was: 'Before',
        now: 'After',
      }
    : {
        title: (n) => `Исправлено ${n} ошибок`,
        show: 'Показать исправления',
        undo: 'Отменить исправление',
        was: 'Было',
        now: 'Стало',
      };

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 10,
        background: 'rgba(62,207,142,0.1)',
        border: '1px solid rgba(62,207,142,0.35)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#3ecf8e', marginBottom: 8 }}>
        {labels.title(result.fixCount)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {onShowRepairs && (
          <button type="button" onClick={onShowRepairs} style={btnStyle}>
            {ui.repairShowFixes || labels.show}
          </button>
        )}
        {onUndoRepair && (
          <button type="button" onClick={onUndoRepair} style={{ ...btnStyle, borderColor: 'rgba(251,191,36,0.45)', color: '#fde68a' }}>
            {ui.repairUndo || labels.undo}
          </button>
        )}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, lineHeight: 1.5, color: 'rgba(226,232,240,0.9)' }}>
        {(result.fixes || []).slice(0, 8).map((f, i) => (
          <li key={`${f.actionId}-${i}`} style={{ marginBottom: 4 }}>
            <span style={{ opacity: 0.7 }}>{labels.was}:</span> {f.before}
            <br />
            <span style={{ color: '#86efac' }}>{labels.now}: {f.after}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const btnStyle = {
  padding: '5px 10px',
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 8,
  border: '1px solid rgba(62,207,142,0.45)',
  background: 'rgba(62,207,142,0.15)',
  color: '#86efac',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
