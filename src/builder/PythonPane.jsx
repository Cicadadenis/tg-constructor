import React from 'react';
import { isMobileBuilderViewport } from '../apiClient.js';
import { highlightPythonLine } from './pythonSyntaxHighlight.js';
import { BuilderUiContext } from '../builderContext.js';
import { getConstructorStrings } from '../builderI18n.js';
import { useGraphPythonCompile } from './useGraphPythonCompile.js';
import { VALIDATION_MODE } from '../constructor/graph_document/validation_modes.js';
import { useGraphValidation } from './graphValidationContext.jsx';
import './python-pane.css';

function PythonPane({ getGraphDocument, graphRevision, isMobile, onClose }) {
  const ctx = React.useContext(BuilderUiContext);
  const ui = ctx?.t || getConstructorStrings('ru');
  const validation = useGraphValidation();

  const {
    pythonMeta,
    isEmpty,
    emptyPreviewReason,
    generatedPython,
  } = useGraphPythonCompile(getGraphDocument, graphRevision, ctx?.lang || 'ru', {
    validationMode: VALIDATION_MODE.SOFT,
  });

  const [copied, setCopied] = React.useState(false);

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

  const emptyPreviewCopy = React.useMemo(() => {
    if (emptyPreviewReason === 'settings_only') {
      return {
        title: ui.pythonPreviewSettingsOnlyTitle || 'Нужны блоки сценария',
        hint: ui.pythonPreviewSettingsOnlyHint
          || 'Сейчас на холсте только настройки (версия, бот). Добавьте «Старт» и «Ответ» и соедините их — здесь появится bot.py.',
      };
    }
    if (emptyPreviewReason === 'no_edges') {
      return {
        title: ui.pythonPreviewNoEdgesTitle || 'Соедините блоки',
        hint: ui.pythonPreviewNoEdgesHint
          || 'Проведите стрелку от «Старт» к «Ответ» (или другим действиям), чтобы собрать сценарий.',
      };
    }
    if (emptyPreviewReason === 'no_handlers') {
      return {
        title: ui.pythonPreviewNoHandlersTitle || 'Добавьте обработчики',
        hint: ui.pythonPreviewNoHandlersHint
          || 'Перетащите «Старт», «Ответ» или кнопки и свяжите их на схеме.',
      };
    }
    return {
      title: ui.pythonPreviewEmptyTitle || 'Перетащите блоки на холст',
      hint: ui.pythonPreviewEmptyHint
        || 'Preview появится после добавления обработчиков и действий на схему.',
    };
  }, [emptyPreviewReason, ui]);

  return (
    <div className="python-pane">
      <div className="python-pane__header">
        <span>{ui.pythonPreviewTitle || 'Python Preview'}</span>
      </div>

      <div className="python-pane__toolbar">
        <div className="python-pane__toolbar-grid">
          {canClose && (
            <button type="button" onClick={onClose} style={{ gridColumn: '1 / -1' }}>
              × Закрыть
            </button>
          )}
          <button type="button" onClick={copy} disabled={isEmpty}>
            {copied ? (ui.pythonCopied || 'Скопировано') : (ui.pythonCopy || 'Копировать')}
          </button>
          <button
            type="button"
            onClick={() => download('bot.py')}
            disabled={isEmpty || fullHasErrors}
            title={fullHasErrors ? (ui.validationDownloadBlocked || 'Сначала исправьте ошибки проверки') : undefined}
          >
            {ui.pythonDownload || '↓ bot.py'}
          </button>
        </div>
      </div>

      {(pythonMeta.compileWarnings || []).length > 0 && !isEmpty && (
        <div className="python-pane__warnings">
          {(pythonMeta.compileWarnings || []).slice(0, 1).map((w, i) => (
            <div key={`w-${i}`}>{w}</div>
          ))}
        </div>
      )}

      <div
        className={[
          'python-pane__code',
          isEmpty ? 'python-pane__code--empty' : '',
          fullHasErrors ? 'python-pane__code--dimmed' : '',
        ].filter(Boolean).join(' ')}
      >
        {isEmpty ? (
          <div style={{ maxWidth: 280 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary, var(--text2))', marginBottom: 8 }}>
              {emptyPreviewCopy.title}
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--color-text-muted, var(--text3))' }}>
              {emptyPreviewCopy.hint}
            </div>
          </div>
        ) : (
          generatedPython.split('\n').map((line, i) => (
            <div key={i} className="python-pane__line">
              <span className="python-pane__ln">{i + 1}</span>
              <span className="python-pane__line-body">
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
