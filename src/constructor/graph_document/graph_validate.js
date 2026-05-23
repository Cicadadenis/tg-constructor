/**
 * Runtime validation before graph hydrate / example load / import.
 * Editor path uses soft callback stage — mutation never blocked by missing handlers.
 */

import { validateGraph } from './validate_graph.js';
import { isDeferredCallbackError } from './validation_stages.js';

/**
 * Post-commit editor diagnostics — callback hints only (non-blocking).
 * @param {object} document
 * @returns {{ warnings: object[], callbackHints: object[] }}
 */
export function collectEditorCallbackDiagnostics(document) {
  const result = validateGraph(document, {
    allowMissingCallbackHandlers: true,
    includeCallbacks: true,
  });
  const callbackHints = (result.diagnostics || []).filter((d) => isDeferredCallbackError(d));
  return {
    warnings: callbackHints,
    callbackHints,
  };
}

/**
 * @param {object} document
 * @returns {{
 *   ok: boolean,
 *   errors: { code: string, message: string, nodeId?: string }[],
 *   warnings: string[],
 *   callbackHints?: object[],
 *   diagnostics?: object[],
 * }}
 */
export function validateGraphDocumentForEditor(document) {
  const result = validateGraph(document, {
    allowMissingCallbackHandlers: true,
    includeCallbacks: true,
  });
  const blockingIssues = result.issues.filter((issue) => !isDeferredCallbackError(issue));
  const errors = blockingIssues.map((issue) => ({
    code: String(issue.code || 'INVALID_GRAPH').toUpperCase(),
    message: issue.message,
    ...(issue.nodeId ? { nodeId: issue.nodeId } : {}),
  }));
  const callbackHints = (result.diagnostics || []).filter((d) => isDeferredCallbackError(d));
  return {
    ok: result.ok && errors.length === 0,
    errors,
    warnings: result.warnings,
    callbackHints,
    diagnostics: result.diagnostics,
  };
}
