/**
 * Graph validation entry — delegates to unified validation pipeline.
 */

import { runGraphValidationPipeline } from './graph_validation_pipeline.js';
import { VALIDATION_STAGE } from './validation_stages.js';

/**
 * @param {object} graph
 * @param {{
 *   strict?: boolean,
 *   strictStructural?: boolean,
 *   context?: string,
 *   includeCallbacks?: boolean,
 *   allowMissingCallbackHandlers?: boolean,
 *   validationStage?: string,
 * }} [options]
 */
export function validateGraph(graph, options = {}) {
  const strict = Boolean(options.strict || options.strictStructural);
  const validationStage = options.validationStage;
  const allowMissingCallbackHandlers = options.allowMissingCallbackHandlers
    ?? (!strict && validationStage !== VALIDATION_STAGE.COMPILE);
  const pipeline = runGraphValidationPipeline(graph, {
    strict,
    context: options.context,
    includeCallbacks: options.includeCallbacks !== false,
    allowMissingCallbackHandlers,
    validationStage,
  });

  const issues = pipeline.errors.map((d) => ({
    code: d.code,
    message: d.message,
    ...(d.nodeId ? { nodeId: d.nodeId } : {}),
    ...(d.edgeId ? { edgeId: d.edgeId } : {}),
  }));

  const warnings = pipeline.warnings.map((d) => (
    d.edgeId ? `${d.code}:${d.edgeId}` : `${d.code}:${d.nodeId || 'graph'}`
  ));

  for (const d of pipeline.diagnostics || []) {
    if (d.code === 'cyclic_loop' && !issues.some((i) => i.code === 'cycles')) {
      issues.push({
        code: 'cycles',
        message: d.message,
      });
    }
  }

  if (options.context === 'example' && issues.length) {
    issues.push({
      code: 'corrupted_examples',
      message: 'Example graph failed validation',
    });
  }

  return {
    ok: pipeline.ok && issues.length === 0,
    issues,
    warnings,
    document: pipeline.document,
    diagnostics: pipeline.diagnostics,
    summary: pipeline.summary,
  };
}
