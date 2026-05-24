/**
 * Preview / debug codegen — GraphDocument → Python + platform Graph IR.
 * No legacy DSL in the preview pipeline.
 */

import { assertUiImportAllowed } from './uiLayerGuard.js';
import { graphDocumentToGraphIR } from './graph_document/graph_ir_bridge.js';
import { graphDocumentToProjectGraph } from './graph_document/graph_project_bridge.js';
import { strictCompileValidation } from './graph_document/graph_validation_pipeline.js';
import { VALIDATION_STAGE } from './graph_document/validation_stages.js';
import { validateCodegenContract } from './graph_document/contracts.js';
import { migrateLegacyGraph } from './aiogram3Migration.js';
import { projectGraphToFlow } from '../../core/graph/model.js';
import { compileFlowToPython } from '../../core/mappers/compileFlowGraph.mjs';

assertUiImportAllowed('constructor/previewCodegenBridge');

/**
 * @param {object|(() => object)} getDocument — GraphDocument or getter
 * @param {{ exportMode?: string, storage?: string }} [options]
 * @returns {{
 *   graph: object,
 *   generatedPython: string,
 *   compileWarnings: string[],
 *   compileErrors: object[],
 *   transpileTrace: object[],
 *   empty: boolean,
 * }}
 */
export function buildPreviewCodegenSnapshot(getDocument, options = {}) {
  const document = typeof getDocument === 'function' ? getDocument() : getDocument;
  const strictRun = options.strictGraph !== false || options.validationStage === VALIDATION_STAGE.COMPILE;
  const validationStage = options.validationStage
    || (strictRun ? VALIDATION_STAGE.COMPILE : VALIDATION_STAGE.COMMITTED);
  const graphValidation = strictCompileValidation(document, {
    strict: strictRun,
    validationStage,
  });
  if (!graphValidation.ok) {
    const blocking = graphValidation.blocking?.length
      ? graphValidation.blocking
      : graphValidation.errors;
    return {
      graph: {},
      generatedPython: '',
      empty: false,
      compileWarnings: [],
      compileErrors: blocking.map((issue) => ({
        code: issue.code || 'GRAPH_VALIDATION',
        message: issue.message,
        nodeId: issue.nodeId,
        edgeId: issue.edgeId,
      })),
      transpileTrace: [],
      compileBlocked: true,
      compileDiagnostics: graphValidation.compileDiagnostics,
    };
  }
  const project = graphDocumentToProjectGraph(document);
  const flow = migrateLegacyGraph(projectGraphToFlow(project));
  const {
    code,
    compileWarnings,
    transpileTrace,
    compileErrors = [],
    empty = false,
  } = compileFlowToPython(flow, {
    graphDocument: document,
    strict: strictRun,
  });
  const graph = graphDocumentToGraphIR(document, { skipValidation: true });
  const snapshot = {
    graph,
    generatedPython: empty ? '' : code,
    empty,
    compileWarnings: empty
      ? []
      : [
        ...compileWarnings.map((w) => (typeof w === 'string' ? w : w.message || String(w.code || ''))),
        ...compileErrors.map((e) => e.message),
      ],
    compileErrors,
    transpileTrace,
  };
  const contract = validateCodegenContract(snapshot);
  if (!contract.success) {
    return {
      ...snapshot,
      compileErrors: [
        ...compileErrors,
        { code: 'CODEGEN_CONTRACT', message: contract.error.issues[0]?.message || 'Invalid codegen snapshot' },
      ],
      generatedPython: '',
    };
  }
  return snapshot;
}
