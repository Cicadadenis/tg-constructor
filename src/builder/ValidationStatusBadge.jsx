import React from 'react';
import { BuilderUiContext } from '../builderContext.js';
import { getConstructorStrings } from '../builderI18n.js';
import { useGraphValidation } from './graphValidationContext.jsx';

const STYLES = {
  ok: { color: '#3ecf8e', border: 'rgba(62,207,142,0.35)', bg: 'rgba(62,207,142,0.1)' },
  warnings: { color: '#fbbf24', border: 'rgba(251,191,36,0.4)', bg: 'rgba(251,191,36,0.1)' },
  errors: { color: '#f87171', border: 'rgba(248,113,113,0.45)', bg: 'rgba(248,113,113,0.12)' },
};

export default function ValidationStatusBadge({ onClick, compact = false }) {
  const ctx = React.useContext(BuilderUiContext);
  const ui = ctx?.t || getConstructorStrings('ru');
  const validation = useGraphValidation();
  const level = validation?.fullResult?.badge || validation?.softStatus?.badge || 'ok';
  const style = STYLES[level] || STYLES.ok;

  const label = level === 'errors'
    ? (ui.validationBadgeErrors || '⛔ Ошибки')
    : level === 'warnings'
      ? (ui.validationBadgeWarnings || '⚠ Предупреждения')
      : (ui.validationBadgeOk || '✓ Схема OK');

  return (
    <button
      type="button"
      className="tb-btn"
      title={ui.validationBadgeHint || 'Нажмите «Проверить» для полной диагностики'}
      onClick={onClick}
      style={{
        fontSize: compact ? 10 : 11,
        fontWeight: 700,
        padding: compact ? '5px 8px' : '5px 10px',
        borderRadius: 8,
        color: style.color,
        background: style.bg,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {label}
    </button>
  );
}
