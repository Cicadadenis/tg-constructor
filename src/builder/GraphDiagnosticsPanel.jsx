import React, { useMemo } from 'react';
import {
  runGraphValidationPipeline,
} from '../constructor/graph_document/graph_validation_pipeline.js';
import {
  getRepairCapabilities,
  suggestRepairStrategy,
  REPAIR_ACTION_REGISTRY,
} from '../constructor/graph_document/graph_auto_repair.js';

const AUTO_FIX_CODES = new Set(REPAIR_ACTION_REGISTRY.flatMap((a) => a.codes));
import { subscribeGraphTelemetry } from '../constructor/graph_document/graph_telemetry.js';
import { getProductUiLabels, productTerms } from '../copy/productCopy.js';
import { formatDiagnosticsForUser, groupGraphErrorsForDisplay } from './graph_error_messages.js';
import GraphDiagnosticsRenderer from './GraphDiagnosticsRenderer.jsx';
import GraphCorruptionPanel from './GraphCorruptionPanel.jsx';
import GraphRepairSummary from './GraphRepairSummary.jsx';
import { useGraphValidation } from './graphValidationContext.jsx';

export function GraphDiagnosticsPanel({
  document,
  strict = false,
  fullValidation = null,
  onApplyRepair,
  onStrictChange,
  onResetGraph,
  onHighlightEdge,
  onHighlightNodeIds,
  onClose,
  lang = 'ru',
}) {
  const validation = useGraphValidation();
  const [telemetry, setTelemetry] = React.useState([]);

  React.useEffect(() => {
    return subscribeGraphTelemetry((entry) => {
      setTelemetry((prev) => [...prev.slice(-24), entry]);
    });
  }, []);

  const pipeline = useMemo(() => {
    if (fullValidation?.pipeline) return fullValidation.pipeline;
    if (!document) return null;
    return runGraphValidationPipeline(document, {
      strict,
      includeCallbacks: true,
      allowMissingCallbackHandlers: !strict,
    });
  }, [document, strict, fullValidation]);

  const capabilities = useMemo(() => {
    if (!pipeline) return { autoFixable: [], manual: [] };
    return getRepairCapabilities(pipeline.diagnostics || [], document);
  }, [pipeline, document]);

  const userErrors = useMemo(() => {
    if (fullValidation?.displayErrors?.length) return fullValidation.displayErrors;
    if (fullValidation?.userErrors?.length) return fullValidation.userErrors;
    if (!pipeline) return [];
    const items = (pipeline.diagnostics || []).filter(
      (d) => d.severity === 'error' || d.severity === 'warning',
    );
    return groupGraphErrorsForDisplay(items, { lang, graphDocument: document });
  }, [pipeline, lang, document, fullValidation]);

  const enrichedErrors = useMemo(() => {
    const repairedCodes = new Set((validation?.lastRepairResult?.fixes || []).map((f) => f.code));
    return userErrors.map((err) => {
      const manual = suggestRepairStrategy(err.code, lang);
      const autoFixAvailable = AUTO_FIX_CODES.has(err.code) || capabilities.autoFixable.length > 0;
      return {
        ...err,
        autoFixAvailable,
        repaired: repairedCodes.has(err.code),
        severity: err.severity || 'error',
        manualStrategy: manual?.strategy,
        aiNote: manual?.aiNote,
      };
    });
  }, [userErrors, capabilities, validation?.lastRepairResult]);

  const p = getProductUiLabels(lang);
  const t = productTerms(lang);
  const labels = lang === 'en'
    ? {
      title: p.flowHealthTitle,
      strict: t.thoroughCheck,
      close: 'Close',
      empty: 'No issues',
      telemetry: p.activityLogTitle,
      autoFix: 'Fix automatically',
      fixing: 'Repairing…',
    }
    : lang === 'uk'
      ? {
        title: p.flowHealthTitle,
        strict: t.thoroughCheck,
        close: 'Закрити',
        empty: 'Проблем не знайдено',
        telemetry: p.activityLogTitle,
        autoFix: 'Виправити автоматично',
        fixing: 'Виправлення…',
      }
      : {
        title: p.flowHealthTitle,
        strict: t.thoroughCheck,
        close: 'Закрыть',
        empty: 'Проблем не найдено',
        telemetry: p.activityLogTitle,
        autoFix: 'Исправить автоматически',
        fixing: 'Исправление…',
      };

  const hasIssues = !pipeline?.ok || enrichedErrors.length > 0;
  const canAutoFix = capabilities.autoFixable.length > 0 && hasIssues;

  const handleAction = (action, error) => {
    if (action === 'auto_repair' || action === 'repair_callbacks' || action === 'remove_edge') {
      validation?.requestAutoRepair?.();
      return;
    }
    if (action === 'reset_graph') onResetGraph?.();
  };

  const handleJump = ({ nodeIds, edgeIds }) => {
    onHighlightNodeIds?.({ nodeIds: nodeIds || [], edgeIds: edgeIds || [] });
  };

  if (!pipeline) return null;

  return (
    <div
      className="graph-diagnostics-panel"
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        background: 'rgba(15,23,42,0.92)',
        border: '1px solid rgba(248,113,113,0.35)',
        fontSize: 11,
        color: 'rgba(248,250,252,0.9)',
        maxHeight: 420,
        overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ color: '#fbbf24' }}>{labels.title}</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={strict} onChange={(e) => onStrictChange?.(e.target.checked)} />
            {labels.strict}
          </label>
          {typeof onClose === 'function' && (
            <button
              type="button"
              onClick={onClose}
              title={labels.close}
              aria-label={labels.close}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(30,41,59,0.6)',
                color: 'rgba(248,250,252,0.9)',
                cursor: 'pointer',
                fontFamily: 'Syne, system-ui, sans-serif',
              }}
            >
              {labels.close}
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 8, opacity: 0.85 }}>
        {lang === 'en' ? 'Errors' : 'Ошибки'}: {pipeline.summary.bySeverity.error || 0}
        {' · '}
        {lang === 'en' ? 'Warnings' : 'Предупреждения'}: {pipeline.summary.bySeverity.warning || 0}
      </div>

      {canAutoFix && (
        <button
          type="button"
          disabled={validation?.repairBusy}
          onClick={() => validation?.requestAutoRepair?.()}
          style={{
            width: '100%',
            marginBottom: 10,
            padding: '10px 14px',
            fontSize: 12,
            fontWeight: 800,
            borderRadius: 10,
            border: '1px solid rgba(62,207,142,0.5)',
            background: 'linear-gradient(135deg, rgba(62,207,142,0.2), rgba(34,197,94,0.12))',
            color: '#86efac',
            cursor: validation?.repairBusy ? 'wait' : 'pointer',
            fontFamily: 'Syne, system-ui, sans-serif',
          }}
        >
          {validation?.repairBusy ? labels.fixing : labels.autoFix}
        </button>
      )}

      {validation?.lastRepairResult?.fixCount > 0 && (
        <GraphRepairSummary
          result={validation.lastRepairResult}
          lang={lang}
          onShowRepairs={() => validation?.showRepairHighlights?.()}
          onUndoRepair={() => validation?.undoLastRepair?.()}
        />
      )}

      {pipeline.ok && enrichedErrors.length === 0 ? (
        <div style={{ opacity: 0.7 }}>{labels.empty}</div>
      ) : (
        <GraphDiagnosticsRenderer
          errors={enrichedErrors}
          lang={lang}
          maxVisible={12}
          onJump={handleJump}
          onAction={handleAction}
          capabilities={capabilities}
        />
      )}

      <GraphCorruptionPanel
        document={document}
        lang={lang}
        onApplyRepair={onApplyRepair}
        onResetGraph={onResetGraph}
        onHighlightEdge={onHighlightEdge}
        onHighlightNodeIds={onHighlightNodeIds}
      />
      {import.meta.env?.DEV && telemetry.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', opacity: 0.8 }}>{labels.telemetry}</summary>
          <pre style={{ fontSize: 9, marginTop: 4, opacity: 0.75 }}>
            {telemetry.map((t) => `${t.at} ${t.event}`).join('\n')}
          </pre>
        </details>
      )}
    </div>
  );
}
