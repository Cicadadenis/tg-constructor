import React from 'react';
import { isMobileBuilderViewport } from '../apiClient.js';
import { highlightPythonLine } from './pythonSyntaxHighlight.js';
import { BuilderUiContext } from '../builderContext.js';
import { getConstructorStrings } from '../builderI18n.js';
import { useGraphPythonCompile } from './useGraphPythonCompile.js';
import { VALIDATION_MODE } from '../constructor/graph_document/validation_modes.js';
import { useGraphValidation } from './graphValidationContext.jsx';
import ValidationStatusBadge from './ValidationStatusBadge.jsx';

function PythonPane({ getGraphDocument, graphRevision, isMobile, onClose }) {
  const ctx = React.useContext(BuilderUiContext);
  const ui = ctx?.t || getConstructorStrings('ru');
  const validation = useGraphValidation();

  const {
    pythonMeta,
    isEmpty,
    generatedPython,
  } = useGraphPythonCompile(getGraphDocument, graphRevision, ctx?.lang || 'ru', {
    validationMode: VALIDATION_MODE.SOFT,
  });

  const [copied, setCopied] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  const handleCheck = () => {
    if (checking || !validation?.requestFullValidation) return;
    setChecking(true);
    validation.requestFullValidation();
    setTimeout(() => setChecking(false), 400);
  };

  const copy = () => {
    if (isEmpty || !generatedPython) return;
    const doCopy = (text) => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return Promise.resolve();
    };
    doCopy(generatedPython).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  const download = (filename = 'bot.py') => {
    if (isEmpty || !generatedPython) return;
    const blob = new Blob([generatedPython], { type: 'text/x-python;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: filename,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const isRuntimeMobile = Boolean(isMobile || isMobileBuilderViewport());
  const canClose = !isRuntimeMobile && typeof onClose === 'function';
  const fullHasErrors = validation?.fullResult?.badge === 'errors';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderTop: '1px solid var(--border)',
      flex: isMobile ? '1 1 auto' : '0 0 50%',
      height: isMobile ? '100%' : undefined,
      minHeight: 0,
      minWidth: 0,
      position: 'relative',
    }}>
      <div style={{
        padding: '6px 10px',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'rgba(99,102,241,0.85)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span>{ui.pythonPreviewTitle || 'Python Preview'}</span>
        <ValidationStatusBadge onClick={handleCheck} compact />
      </div>

      <div style={{
        padding: '5px 10px',
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        minWidth: 0,
        overflowX: 'auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 6,
          width: '100%',
        }}>
          {canClose && (
            <button type="button" onClick={onClose} style={{ gridColumn: '1 / -1', padding: '4px 8px', fontSize: 10 }}>
              × Закрыть
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            disabled={isEmpty}
            style={{ padding: '4px 10px', fontSize: 10, opacity: isEmpty ? 0.45 : 1 }}
          >
            {copied ? (ui.pythonCopied || 'Скопировано') : (ui.pythonCopy || 'Копировать')}
          </button>
          <button
            type="button"
            onClick={handleCheck}
            disabled={isEmpty || checking}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 700,
              opacity: isEmpty ? 0.45 : 1,
              borderColor: 'rgba(99,102,241,0.45)',
              color: 'rgba(167,139,250,0.95)',
            }}
          >
            {checking ? '…' : (ui.graphCheckButton || 'Проверить')}
          </button>
          <button
            type="button"
            onClick={() => download('bot.py')}
            disabled={isEmpty || fullHasErrors}
            style={{ padding: '4px 10px', fontSize: 10, opacity: isEmpty ? 0.45 : 1 }}
            title={fullHasErrors ? (ui.validationDownloadBlocked || 'Сначала исправьте ошибки проверки') : undefined}
          >
            {ui.pythonDownload || '↓ bot.py'}
          </button>
        </div>
      </div>

      {(pythonMeta.compileWarnings || []).length > 0 && !isEmpty && (
        <div style={{ padding: '4px 10px', borderBottom: '1px solid var(--border)', fontSize: 9, color: 'rgba(251,191,36,0.75)', opacity: 0.85 }}>
          {(pythonMeta.compileWarnings || []).slice(0, 1).map((w, i) => (
            <div key={`w-${i}`}>{w}</div>
          ))}
        </div>
      )}

      <div style={{
        flex: 1,
        margin: 0,
        padding: isEmpty ? '24px 16px' : '7px 10px',
        fontSize: isEmpty ? 12 : 9,
        lineHeight: 1.65,
        color: isEmpty ? 'var(--text3)' : 'var(--text2)',
        fontFamily: isEmpty ? 'inherit' : 'var(--mono)',
        overflowY: 'auto',
        background: 'var(--bg)',
        opacity: fullHasErrors ? 0.55 : 1,
        display: isEmpty ? 'flex' : 'block',
        alignItems: isEmpty ? 'center' : undefined,
        justifyContent: isEmpty ? 'center' : undefined,
        textAlign: isEmpty ? 'center' : 'left',
      }}>
        {isEmpty ? (
          <div style={{ maxWidth: 280 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
              {ui.pythonPreviewEmptyTitle || 'Перетащите блоки на холст'}
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text3)' }}>
              {ui.pythonPreviewEmptyHint || 'Preview появится после добавления обработчиков и действий на схему.'}
            </div>
          </div>
        ) : (
          generatedPython.split('\n').map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <span style={{ flexShrink: 0, width: 28, textAlign: 'right', opacity: 0.35 }}>{i + 1}</span>
              <span style={{ flex: 1 }}>
                {highlightPythonLine(line).map((tok) => (
                  <span key={tok.key} style={{ color: tok.color }}>{tok.text}</span>
                ))}
                {!line ? '\u00a0' : null}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const MemoPythonPane = React.memo(PythonPane);
export default MemoPythonPane;
export { MemoPythonPane as PythonPane };
export function fixDslSchema(input) {
  return String(input ?? '');
}
