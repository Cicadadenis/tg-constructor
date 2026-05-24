import React from 'react';
import { FLOW_LAYOUT_MODES } from './flowLayoutModes.js';
import './flow-layout-toolbar.css';

const MODE_LABELS = {
  ru: { AUTO: 'Авто', COMPACT: 'Компакт', EXPANDED: 'Широкий' },
  en: { AUTO: 'Auto', COMPACT: 'Compact', EXPANDED: 'Expanded' },
};

/**
 * @param {object} props
 * @param {string} props.mode
 * @param {(mode: string) => void} props.onModeChange
 * @param {() => void} [props.onRelayout]
 * @param {string} [props.lang]
 */
export default function FlowLayoutToolbar({ mode, onModeChange, onRelayout, lang = 'ru' }) {
  const labels = MODE_LABELS[lang === 'en' ? 'en' : 'ru'];

  return (
    <div className="flow-layout-toolbar" role="toolbar" aria-label={lang === 'en' ? 'Layout' : 'Раскладка'}>
      <span className="flow-layout-toolbar__label">
        {lang === 'en' ? 'Layout' : 'Раскладка'}
      </span>
      <div className="flow-layout-toolbar__modes" role="group">
        {FLOW_LAYOUT_MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={`flow-layout-toolbar__mode${mode === m ? ' flow-layout-toolbar__mode--active' : ''}`}
            aria-pressed={mode === m}
            onClick={() => onModeChange(m)}
          >
            {labels[m]}
          </button>
        ))}
      </div>
      {onRelayout && (
        <button
          type="button"
          className="flow-layout-toolbar__relayout"
          title={lang === 'en' ? 'Re-apply layout' : 'Применить раскладку'}
          onClick={onRelayout}
        >
          ↻
        </button>
      )}
    </div>
  );
}
