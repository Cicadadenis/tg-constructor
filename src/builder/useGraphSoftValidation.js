import React from 'react';
import { auditGraphCorruption } from '../constructor/graph_document/graph_state_repair.js';
import { runGraphValidationPipeline } from '../constructor/graph_document/graph_validation_pipeline.js';
import { isGraphEffectivelyEmpty } from '../constructor/graph_document/graph_canvas_state.js';
import { validationBadgeLevel } from '../constructor/graph_document/validation_modes.js';
import { isDeferredCallbackError } from '../constructor/graph_document/validation_stages.js';
import { softenEngineeringCopy } from '../copy/productCopy.js';
import { formatDiagnosticsForUser } from './graph_error_messages.js';

const SOFT_DEBOUNCE_MS = 700;

/**
 * Lightweight debounced validation during editing — no compile, no overlay.
 */
export function useGraphSoftValidation(getGraphDocument, graphRevision, lang = 'ru') {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const t = setTimeout(() => setTick((n) => n + 1), SOFT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [graphRevision]);

  return React.useMemo(() => {
    const doc = typeof getGraphDocument === 'function' ? getGraphDocument() : null;
    if (!doc || isGraphEffectivelyEmpty(doc)) {
      return { badge: 'ok', counts: { error: 0, warning: 0 }, hints: [] };
    }

    const corruption = auditGraphCorruption(doc);
    let errorCount = (corruption?.danglingEdges?.length || 0) > 0 ? 1 : 0;
    let warningCount = corruption?.staleHydrationCount > 0 ? 1 : 0;

    const pipeline = runGraphValidationPipeline(doc, {
      strict: false,
      includeCallbacks: true,
      allowMissingCallbackHandlers: true,
      skipLegacy: true,
    });

    const softErrors = (pipeline.diagnostics || []).filter((d) => (
      d.severity === 'error'
      && ['dangling_edge', 'incompatible_connection', 'self_connection', 'duplicate_edge', 'schema_mismatch'].includes(d.code)
    ));
    const softWarnings = (pipeline.diagnostics || []).filter((d) => d.severity === 'warning');
    const callbackHints = (pipeline.diagnostics || []).filter((d) => isDeferredCallbackError(d));
    const callbackHintUx = formatDiagnosticsForUser(callbackHints, { lang, graphDocument: doc }).slice(0, 2);

    errorCount += softErrors.length;
    warningCount += softWarnings.length;

    const badge = validationBadgeLevel({ error: errorCount, warning: warningCount });
    const hintItems = [
      ...(errorCount > 0 ? [{
        code: 'dangling_edge',
        severity: 'error',
        title: softenEngineeringCopy(
          lang === 'en' ? 'Broken connection in your flow' : 'Обрыв связи в сценарии',
          lang,
        ),
      }] : []),
      ...softErrors.slice(0, 2).map((d) => ({
        code: d.code,
        severity: 'error',
        title: softenEngineeringCopy(d.message, lang),
      })),
      ...callbackHintUx.map((h) => ({
        code: h.code,
        severity: 'warning',
        title: h.title,
        fix: h.fix,
        actions: h.actions,
      })),
    ];
    return {
      badge,
      counts: { error: errorCount, warning: warningCount },
      hints: hintItems.slice(0, 3),
      callbackHints: callbackHintUx,
      pipelineSummary: pipeline.summary,
    };
  }, [getGraphDocument, graphRevision, tick, lang]);
}
