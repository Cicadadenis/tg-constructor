/**
 * Full graph check — structural audit, callbacks, compile dry-run (explicit «Проверить»).
 */

import { compileFlowToPython } from '../../core/mappers/compileFlowGraph.mjs';
import { graphDocumentToProjectGraph } from '../constructor/graph_document/graph_project_bridge.js';
import { projectGraphToFlow } from '../../core/graph/model.js';
import { runGraphValidationPipeline, strictCompileValidation } from '../constructor/graph_document/graph_validation_pipeline.js';
import { formatDiagnosticsForUser, groupGraphErrorsForDisplay } from './graph_error_messages.js';
import { VALIDATION_MODE, validationBadgeLevel, validationModeToStage } from '../constructor/graph_document/validation_modes.js';
import { VALIDATION_STAGE } from '../constructor/graph_document/validation_stages.js';
import { isGraphEffectivelyEmpty } from '../constructor/graph_document/graph_canvas_state.js';

/**
 * @param {object|null} document
 * @param {{ strict?: boolean, lang?: string }} [options]
 */
export function runFullGraphValidation(document, options = {}) {
  const lang = options.lang || 'ru';
  const strict = options.strict === true;
  const mode = strict ? VALIDATION_MODE.STRICT : VALIDATION_MODE.FULL;
  const stage = validationModeToStage(mode, VALIDATION_STAGE.COMMITTED);

  if (!document || isGraphEffectivelyEmpty(document)) {
    return {
      ok: true,
      mode,
      stage,
      pipeline: null,
      compileMeta: null,
      userErrors: [],
      displayErrors: [],
      badge: 'ok',
      summary: { bySeverity: { error: 0, warning: 0, info: 0 }, total: 0 },
    };
  }

  const pipeline = runGraphValidationPipeline(document, {
    strict,
    validationStage: stage,
    allowMissingCallbackHandlers: !strict,
    includeCallbacks: true,
    skipLegacy: true,
  });

  const gate = strictCompileValidation(document, {
    validationStage: strict ? VALIDATION_STAGE.COMPILE : stage,
    includeCallbacks: true,
    strict,
    allowMissingCallbackHandlers: !strict,
  });

  const flow = projectGraphToFlow(graphDocumentToProjectGraph(document));
  const compileMeta = compileFlowToPython(flow, {
    graphDocument: document,
    strict,
  });

  const rawCompileErrors = compileMeta.compileErrors || [];
  const pipelineUser = formatDiagnosticsForUser(pipeline.diagnostics, { lang, graphDocument: document });
  const compileUser = formatDiagnosticsForUser(
    rawCompileErrors.map((e) => ({
      code: e.code,
      severity: e.severity || 'error',
      message: e.message,
      nodeId: e.nodeId,
      edgeId: e.edgeId,
    })),
    { lang, graphDocument: document },
  );
  const gateUser = formatDiagnosticsForUser(gate.blocking || gate.errors || [], { lang, graphDocument: document });

  const mergedByKey = new Map();
  for (const item of [...pipelineUser, ...compileUser, ...gateUser]) {
    if (!item) continue;
    const key = `${item.code || ''}:${item.title || ''}`;
    if (!mergedByKey.has(key)) mergedByKey.set(key, item);
  }
  const userErrors = [...mergedByKey.values()];
  const displayErrors = groupGraphErrorsForDisplay(
    rawCompileErrors.length ? rawCompileErrors : pipeline.errors,
    { lang, graphDocument: document },
  );

  const errorCount = (pipeline.summary?.bySeverity?.error || 0)
    + rawCompileErrors.filter((e) => String(e.severity || 'error') === 'error').length;
  const warningCount = (pipeline.summary?.bySeverity?.warning || 0)
    + rawCompileErrors.filter((e) => String(e.severity) === 'warning').length;

  const badge = validationBadgeLevel({ error: errorCount, warning: warningCount });
  const ok = badge === 'ok' && pipeline.ok && !compileMeta.compileBlocked;

  return {
    ok,
    mode,
    stage,
    pipeline,
    gate,
    compileMeta,
    userErrors,
    displayErrors,
    badge,
    summary: {
      bySeverity: {
        error: errorCount,
        warning: warningCount,
        info: pipeline.summary?.bySeverity?.info || 0,
      },
      total: userErrors.length,
    },
  };
}
