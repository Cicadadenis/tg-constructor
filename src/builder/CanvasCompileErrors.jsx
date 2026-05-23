import React from 'react';
import { BuilderUiContext } from '../builderContext.js';
import { getConstructorStrings } from '../builderI18n.js';
import { useGraphValidation } from './graphValidationContext.jsx';
import { graphErrorsToClipboardText } from './graph_error_messages.js';
import GraphDiagnosticsRenderer from './GraphDiagnosticsRenderer.jsx';
import { compilePurgeInvalidEdges } from '../constructor/graph_document/graph_state_repair.js';
import { repairBrokenCallbacksInDocument } from '../constructor/graph_document/graph_callback_repair.js';

const MAX_VISIBLE = 6;

/**
 * Blocking compile overlay — only after explicit «Проверить» with errors or strict run.
 */
export default function CanvasCompileErrors({
  getGraphDocument,
  graphRevision,
  onHighlightNodeIds,
  onFitAllNodes,
  onResetCorruptedGraph,
  onApplyRepair,
}) {
  const ctx = React.useContext(BuilderUiContext);
  const ui = ctx?.t || getConstructorStrings('ru');
  const lang = ctx?.lang || 'ru';
  const validation = useGraphValidation();

  const displayErrors = validation?.fullResult?.displayErrors || [];
  const showOverlay = Boolean(validation?.blockingOverlayActive && displayErrors.length);

  const doc = React.useMemo(
    () => (typeof getGraphDocument === 'function' ? getGraphDocument() : null),
    [getGraphDocument, graphRevision],
  );
  const nodeCount = Object.keys(doc?.nodes || {}).length;

  const highlightKey = !showOverlay
    ? ''
    : displayErrors.flatMap((e) => e.nodeIds || (e.nodeId ? [e.nodeId] : [])).join('\0');
  const lastHighlightKeyRef = React.useRef(null);

  React.useEffect(() => {
    if (lastHighlightKeyRef.current === highlightKey) return;
    lastHighlightKeyRef.current = highlightKey;
    const nodeIds = highlightKey ? highlightKey.split('\0').filter(Boolean) : [];
    onHighlightNodeIds?.(nodeIds);
  }, [highlightKey, onHighlightNodeIds]);

  const [copied, setCopied] = React.useState(false);

  const handleJump = ({ nodeIds, edgeIds }) => {
    onHighlightNodeIds?.({ nodeIds: nodeIds || [], edgeIds: edgeIds || [] });
  };

  const handleAction = (action) => {
    if (action === 'remove_edge' && doc && onApplyRepair) {
      const compiled = compilePurgeInvalidEdges(doc);
      if (compiled.ok) onApplyRepair(compiled.operations);
    } else if (action === 'reset_graph') onResetCorruptedGraph?.();
    else if (action === 'show_all_nodes') onFitAllNodes?.();
    else if (action === 'repair_callbacks' && onApplyRepair && doc) {
      const repaired = repairBrokenCallbacksInDocument(doc);
      if (repaired.modified && repaired.operations?.length) {
        onApplyRepair(repaired.operations);
      }
    }
  };

  const copyErrors = () => {
    const text = graphErrorsToClipboardText(displayErrors);
    if (!text) return;
    const paste = (value) => {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        return navigator.clipboard.writeText(value);
      }
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return Promise.resolve();
    };
    paste(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  if (!showOverlay) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'absolute',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 35,
        width: 'min(440px, calc(100% - 28px))',
        maxHeight: 'min(42vh, 360px)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(15,15,20,0.94)',
        border: '1px solid rgba(239,68,68,0.5)',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'auto',
        fontFamily: 'Syne, system-ui, sans-serif',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 12px',
        borderBottom: '1px solid rgba(239,68,68,0.25)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5' }}>
          {ui.graphErrorsTitle || ui.pythonCompileFailed || 'Проблемы в сценарии'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {validation?.requestAutoRepair && (
            <button
              type="button"
              onClick={() => validation.requestAutoRepair()}
              disabled={validation?.repairBusy}
              style={{
                ...headerBtnStyle,
                borderColor: 'rgba(62,207,142,0.5)',
                background: 'rgba(62,207,142,0.18)',
                color: '#86efac',
              }}
            >
              {validation?.repairBusy ? '…' : (ui.graphAutoFix || 'Исправить автоматически')}
            </button>
          )}
          <button type="button" onClick={copyErrors} style={headerBtnStyle}>
            {copied ? (ui.pythonCopied || '✓ скоп.') : (ui.pythonCopy || 'Копировать')}
          </button>
          <button
            type="button"
            onClick={() => validation?.dismissFullOverlay?.()}
            style={headerBtnStyle}
          >
            {ui.validationOverlayClose || 'Закрыть'}
          </button>
        </div>
      </div>
      <div style={{ padding: '10px 12px 12px', overflowY: 'auto' }}>
        {nodeCount > 2 && (
          <div style={{
            fontSize: 10,
            color: 'rgba(254,202,202,0.75)',
            marginBottom: 10,
            padding: '6px 8px',
            borderRadius: 8,
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}>
            {(ui.canvasErrorsStackedHint || '').replace('{count}', String(nodeCount))}
          </div>
        )}
        <GraphDiagnosticsRenderer
          errors={displayErrors}
          lang={lang}
          maxVisible={MAX_VISIBLE}
          onJump={handleJump}
          onAction={handleAction}
        />
      </div>
    </div>
  );
}

const headerBtnStyle = {
  padding: '5px 12px',
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 8,
  border: '1px solid rgba(239,68,68,0.4)',
  background: 'rgba(239,68,68,0.15)',
  color: '#fecaca',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
};
