import React from 'react';

import { PYTHON_EXPORT_MODES } from '../../core/pythonAiogramCodegen.js';

import { graphDocumentToProjectGraph } from '../constructor/graph_document/graph_project_bridge.js';

import { projectGraphToFlow } from '../../core/graph/model.js';

import { compileGraphToPython } from '../../core/codegen/pipeline.js';

import { inspectGraph } from '../debug/graphInspector.js';

import { inspectRuntime } from '../debug/runtimeInspector.js';

import { reactFlowToGraph } from '../../core/mappers/reactFlowToGraph.ts';

import { groupGraphErrorsForDisplay } from './graph_error_messages.js';

import { isGraphInEditMode } from '../constructor/graph_document/graph_edit_session.js';

import {

  VALIDATION_MODE,

  allowsBlockingCompileOverlay,

  validationModeToStage,

} from '../constructor/graph_document/validation_modes.js';

import {

  extractCallbackHints,

  filterBlockingOverlayErrors,

  filterErrorsForStage,

  resolveSessionValidationStage,

  shouldAbortCompile,

  shouldShowCompileOverlay,

  VALIDATION_STAGE,

} from '../constructor/graph_document/validation_stages.js';

import {
  isGraphEffectivelyEmpty,
  isGraphSettingsOnlyShell,
  hasUserVisibleCanvasNodes,
} from '../constructor/graph_document/graph_canvas_state.js';

const EMPTY_COMPILE_ERRORS = [];

const PREVIEW_DEBOUNCE_MS = 450;

function graphHasCanvasNodes(doc) {

  return Object.keys(doc?.nodes || {}).length > 0;

}

/**
 * Python preview — soft mode during edit (no blocking overlay).
 * @param {object} [options]
 * @param {import('../constructor/graph_document/validation_modes.js').VALIDATION_MODE[keyof typeof VALIDATION_MODE]} [options.validationMode]
 * @param {boolean} [options.allowBlockingOverlay]
 */
export function useGraphPythonCompile(getGraphDocument, graphRevision, lang = 'ru', options = {}) {

  const validationMode = options.validationMode || VALIDATION_MODE.SOFT;

  const allowBlockingOverlay = options.allowBlockingOverlay === true

    || allowsBlockingCompileOverlay(validationMode);

  const [exportMode] = React.useState(PYTHON_EXPORT_MODES.FULL_MODULE);

  const [compileTick, setCompileTick] = React.useState(0);

  React.useEffect(() => {

    const delay = isGraphInEditMode() ? PREVIEW_DEBOUNCE_MS : 120;

    const t = setTimeout(() => setCompileTick((n) => n + 1), delay);

    return () => clearTimeout(t);

  }, [graphRevision]);

  const graphDocument = React.useMemo(

    () => (typeof getGraphDocument === 'function' ? getGraphDocument() : null),

    [getGraphDocument, graphRevision],

  );

  const sessionStage = React.useMemo(

    () => resolveSessionValidationStage(),

    [graphRevision, compileTick],

  );

  /** Preview codegen: never use EDIT stage (would empty Python via callback assert). */
  const codegenStage = React.useMemo(

    () => (validationMode === VALIDATION_MODE.STRICT

      ? VALIDATION_STAGE.COMPILE

      : VALIDATION_STAGE.COMMITTED),

    [validationMode],

  );

  const diagnosticsStage = React.useMemo(

    () => validationModeToStage(validationMode, sessionStage),

    [validationMode, sessionStage],

  );

  const skipGraphGate = validationMode !== VALIDATION_MODE.STRICT;

  const pythonMeta = React.useMemo(() => {
    try {
      if (!graphDocument || Object.keys(graphDocument.nodes || {}).length === 0) {
        return {
          code: '',
          python: '',
          compileErrors: [],
          compileWarnings: [],
          transpileTrace: [],
          empty: true,
          success: false,
        };
      }

      const flow = projectGraphToFlow(graphDocumentToProjectGraph(graphDocument));

      const meta = compileGraphToPython(flow, {
        graphDocument,
        exportMode: PYTHON_EXPORT_MODES.FULL_MODULE,
        validationStage: codegenStage,
        strict: validationMode === VALIDATION_MODE.STRICT,
        skipGraphGate: skipGraphGate,
        validatePython: false,
      });

      const code = meta.code || '';
      const empty = !code.trim() && (meta.empty !== false);
      const normalized = {
        ...meta,
        code,
        python: code,
        empty,
        success: !empty && !meta.aborted,
      };

      if (import.meta.env?.DEV && normalized.success && code) {
        try {
          inspectGraph(reactFlowToGraph(flow.nodes, flow.edges));
        } catch (inspectErr) {
          console.warn('[compile preview inspect]', inspectErr);
        }
      }

      return normalized;
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.warn('[compile preview]', err);
      }
      return {
        code: '',
        python: '',
        compileErrors: [{
          code: 'COMPILE_PREVIEW',
          message: err instanceof Error ? err.message : String(err),
          severity: 'error',
        }],
        compileWarnings: [],
        transpileTrace: [],
        empty: true,
        success: false,
      };
    }

  }, [graphDocument, exportMode, codegenStage, compileTick, skipGraphGate, validationMode]);

  const hasNodes = graphHasCanvasNodes(graphDocument);

  const generatedPython = pythonMeta.code || '';

  const isEmpty = !hasNodes || !generatedPython.trim();

  const rawCompileErrors = isEmpty ? EMPTY_COMPILE_ERRORS : (pythonMeta.compileErrors ?? EMPTY_COMPILE_ERRORS);

  const compileErrors = React.useMemo(

    () => filterErrorsForStage(rawCompileErrors, diagnosticsStage),

    [rawCompileErrors, diagnosticsStage],

  );

  const blockingErrors = React.useMemo(

    () => filterBlockingOverlayErrors(rawCompileErrors, diagnosticsStage),

    [rawCompileErrors, diagnosticsStage],

  );

  const callbackHints = React.useMemo(

    () => extractCallbackHints(rawCompileErrors, diagnosticsStage),

    [rawCompileErrors, diagnosticsStage],

  );

  const compileAborted = !isEmpty && allowBlockingOverlay && (

    shouldAbortCompile(pythonMeta, diagnosticsStage, compileErrors)

    || shouldShowCompileOverlay(diagnosticsStage, blockingErrors, { allowBlockingOverlay })

  );

  const displayErrors = React.useMemo(

    () => groupGraphErrorsForDisplay(

      compileAborted ? blockingErrors : compileErrors,

      { lang, graphDocument },

    ),

    [compileAborted, blockingErrors, compileErrors, lang, graphDocument],

  );

  const displayCallbackHints = React.useMemo(

    () => groupGraphErrorsForDisplay(callbackHints, { lang, graphDocument }),

    [callbackHints, lang, graphDocument],

  );

  const emptyPreviewReason = React.useMemo(() => {
    if (!graphHasCanvasNodes(graphDocument)) return 'no_nodes';
    if (generatedPython.trim()) return null;
    if (isGraphSettingsOnlyShell(graphDocument)) return 'settings_only';
    try {
      const flow = projectGraphToFlow(graphDocumentToProjectGraph(graphDocument));
      const hasFlowEdges = (flow?.edges || []).length > 0;
      if (!hasFlowEdges && hasUserVisibleCanvasNodes(graphDocument)) return 'no_edges';
    } catch {
      // fall through
    }
    if (isGraphEffectivelyEmpty(graphDocument)) return 'no_handlers';
    return 'no_handlers';
  }, [graphDocument, generatedPython]);

  return {

    pythonMeta,

    isEmpty,

    emptyPreviewReason,

    generatedPython,

    compileErrors,

    blockingErrors,

    callbackHints,

    compileAborted,

    displayErrors,

    displayCallbackHints,

    validationStage: diagnosticsStage,

    codegenStage,

    validationMode,

  };

}

/** Plain text for clipboard from formatted compile errors. */

export function compileErrorsToClipboardText(displayErrors) {

  if (!displayErrors?.length) return '';

  return displayErrors

    .map((err) => {

      const head = `${err.title}${err.count > 1 ? ` (${err.count})` : ''}`;

      return err.hint ? `${head}\n${err.hint}` : head;

    })

    .join('\n\n');

}
