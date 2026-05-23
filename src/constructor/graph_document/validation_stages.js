/**

 * Staged validation lifecycle — edit / insertion / committed / compile.

 */



import {

  VALIDATION_STAGE,

  isCallbackValidationDeferred,

  isGraphInEditMode,

  isKeyboardInsertionActive,

  isNodeInEditMode,

  resolveSessionValidationStage,

} from './graph_edit_session.js';



export { VALIDATION_STAGE };



/** @typedef {'edit'|'insertion'|'committed'|'compile'} ValidationStage */



const CALLBACK_DEFER_CODES = new Set([

  'MissingCallbackHandlerError',

  'missing_handlers',

  'broken_callback_route',

  'CALLBACK_HANDLER_DISCONNECTED',

  'invalid_callbacks',

  'CALLBACK_HANDLER_AUTO',

]);



const NON_CALLBACK_BLOCKING_CODES = new Set([

  'dangling_edge',

  'hydration_orphan_edges',

  'incompatible_connection',

  'self_connection',

  'duplicate_edge',

  'invalid_edges',

  'schema_mismatch',

  'registry_semantic',

  'GRAPH_COMPILE_GATE',

  'cycles',

]);



export function isDeferredCallbackError(err) {

  const code = String(err?.code || err || '').trim();

  if (CALLBACK_DEFER_CODES.has(code)) return true;

  const msg = String(err?.message || err || '');

  return /MissingCallbackHandler|Нет handler для callback|Нет реакции на/i.test(msg);

}



export function defersCallbackBlocking(stage) {

  return stage !== VALIDATION_STAGE.COMPILE;

}



/** Editor / committed diagnostics — missing handlers are warnings, not blockers. */

export function shouldSoftEnforceCallbacks(options = {}) {

  if (options.allowMissingCallbackHandlers === false) return false;

  if (options.validationStage === VALIDATION_STAGE.COMPILE) return false;

  if (options.allowMissingCallbackHandlers === true) return true;

  return options.validationStage !== VALIDATION_STAGE.COMPILE;

}



/** Split pipeline diagnostics into ok/errors/warnings with optional callback softening. */

export function partitionPipelineDiagnostics(promoted, options = {}) {

  let list = promoted;

  if (shouldSoftEnforceCallbacks(options)) {

    list = softenDiagnosticsForStage(promoted, VALIDATION_STAGE.EDIT);

  }

  const errors = list.filter((d) => d.severity === 'error');

  const warnings = list.filter((d) => d.severity !== 'error');

  return {

    ok: errors.length === 0,

    diagnostics: list,

    errors,

    warnings,

    summary: {

      bySeverity: {

        error: errors.length,

        warning: warnings.length,

        info: list.filter((d) => d.severity === 'info').length,

      },

      byCode: list.reduce((acc, d) => {

        acc[d.code] = (acc[d.code] || 0) + 1;

        return acc;

      }, {}),

      total: list.length,

    },

  };

}



export function filterErrorsForStage(errors, stage) {

  if (!Array.isArray(errors)) return [];

  if (stage === VALIDATION_STAGE.COMPILE) return errors;

  if (defersCallbackBlocking(stage)) {

    return errors.filter((e) => !isDeferredCallbackError(e));

  }

  return errors;

}



export function filterBlockingOverlayErrors(errors, stage) {

  const list = filterErrorsForStage(errors, stage);

  if (stage === VALIDATION_STAGE.COMPILE) return list;

  return list.filter((e) => !isDeferredCallbackError(e));

}



export function extractCallbackHints(errors, stage) {

  if (stage === VALIDATION_STAGE.COMPILE) return [];

  return (errors || []).filter((e) => isDeferredCallbackError(e));

}



export function softenDiagnosticsForStage(items, stage) {

  if (stage === VALIDATION_STAGE.COMPILE) return items;

  return (items || []).map((d) => {

    if (!isDeferredCallbackError(d)) return d;

    return {

      ...d,

      severity: 'warning',

      _deferredInEdit: defersCallbackBlocking(stage),

    };

  });

}



export function shouldShowCompileOverlay(stage, blockingErrors = [], options = {}) {

  if (options.allowBlockingOverlay === false) return false;

  if (stage === VALIDATION_STAGE.COMPILE) return blockingErrors.length > 0;

  return blockingErrors.some((e) => (

    !isDeferredCallbackError(e)

    && (NON_CALLBACK_BLOCKING_CODES.has(e.code) || e.severity === 'error')

  ));

}



export function strictCompileGateForStage(stage) {

  return stage === VALIDATION_STAGE.COMPILE;

}



export function resolveOptionsStage(options = {}) {

  if (options.validationStage) return options.validationStage;

  if (options.strict === true) return VALIDATION_STAGE.COMPILE;

  return VALIDATION_STAGE.COMMITTED;

}



export function resolveValidationStage(nodeId) {

  return resolveSessionValidationStage(nodeId);

}



export function includeCallbacksInGraphGate(stage, nodeId) {

  if (defersCallbackBlocking(stage)) return false;

  if (isCallbackValidationDeferred(nodeId)) return false;

  return true;

}



export function shouldAbortCompile(meta, stage, filteredErrors) {

  if (stage !== VALIDATION_STAGE.COMPILE) {

    const hard = filterBlockingOverlayErrors(filteredErrors, stage);

    return hard.length > 0 && Boolean(meta?.aborted) && hard.some((e) => !isDeferredCallbackError(e));

  }

  return Boolean(meta?.aborted)

    || Boolean(meta?.compileBlocked)

    || filteredErrors.length > 0;

}



export {

  isGraphInEditMode,

  isNodeInEditMode,

  isKeyboardInsertionActive,

  isCallbackValidationDeferred,

  resolveSessionValidationStage,

};


