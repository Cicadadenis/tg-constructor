/**
 * AI validation — Graph IR / stacks only (no DSL / parser.py).
 */

import { semanticValidateFlow } from '../core/ai/semanticValidateFlow.js';
import { compilePythonFromStacks } from './pythonCodegen.mjs';
import { validatePythonSyntax } from '../core/codegen/validatePython.mjs';
import { stacksToFlow } from '../core/codegen/stacksFlow.js';
import { buildProjectGraphDocumentFromStacks } from '../core/graph/projectDocument.js';
import { inferRequiredFeaturesFromFlow } from '../core/graph/features.js';
import {
  computeValidationPipelineFingerprintV1,
  diagnosticV1FromSemanticError,
  diagnosticV1FromSemanticWarning,
  diagnosticV1FromUnsupportedFeatures,
  diagnosticV1FromGraphBuild,
  primaryErrorDiagnosticV1,
} from '../core/diagnostics/index.js';
import { VALIDATION_ORCHESTRATION_VERSION } from '../core/diagnostics/pipelineFingerprintV1.js';

export const AI_GRAPH_PIPELINE_VERSION = VALIDATION_ORCHESTRATION_VERSION;

/**
 * @param {{ stacks: unknown[], runtimeSupportedFeatures?: Iterable<string> | null, skipSemantic?: boolean, projectGraphOptions?: object }} opts
 */
export function runAiGraphValidationPipeline(opts) {
  const stacks = opts.stacks || [];
  const flow = stacksToFlow(stacks);
  const diagnostics = [];
  const stages = {};

  if (!opts.skipSemantic) {
    const sem = semanticValidateFlow(flow);
    stages.semantic = sem;
    for (const e of sem.errors || []) {
      diagnostics.push(diagnosticV1FromSemanticError(e));
    }
    for (const w of sem.warnings || []) {
      diagnostics.push(diagnosticV1FromSemanticWarning(w));
    }
  }

  const codegen = compilePythonFromStacks(stacks, {
    validatePython: true,
    validatePythonSyntax,
  });
  stages.codegen = {
    ok: !codegen.compileErrors?.length,
    compileErrors: codegen.compileErrors,
    compileWarnings: codegen.compileWarnings,
  };
  for (const err of codegen.compileErrors || []) {
    diagnostics.push({
      phase: 'codegen',
      severity: 'error',
      code: err.code || 'CODEGEN_ERROR',
      message: err.message,
      nodeId: err.nodeId,
      blockType: err.blockType,
    });
  }

  const required = inferRequiredFeaturesFromFlow(flow);
  if (opts.runtimeSupportedFeatures) {
    const allowed = new Set(opts.runtimeSupportedFeatures);
    const unsupported = required.filter((f) => !allowed.has(f));
    if (unsupported.length) {
      diagnostics.push(...unsupported.map((f) => diagnosticV1FromUnsupportedFeatures(f)));
      stages.capabilities = { unsupported };
    }
  }

  let projectGraph = null;
  try {
    projectGraph = buildProjectGraphDocumentFromStacks(stacks, opts.projectGraphOptions);
    stages.projectGraph = { ok: true };
  } catch (e) {
    stages.projectGraph = { ok: false, error: String(e?.message || e) };
    diagnostics.push(diagnosticV1FromGraphBuild(String(e?.message || e)));
  }

  const ok = diagnostics.every((d) => d.severity !== 'error') && stages.codegen?.ok;
  const fingerprint = computeValidationPipelineFingerprintV1({
    pipelineVersion: AI_GRAPH_PIPELINE_VERSION,
    diagnostics,
  });

  const primary = primaryErrorDiagnosticV1(diagnostics);

  return {
    pipelineVersion: AI_GRAPH_PIPELINE_VERSION,
    ok,
    stages,
    diagnostics,
    fingerprint,
    flow,
    stacks,
    generatedPython: codegen.code,
    projectGraph,
    repair: primary
      ? { stage: primary.phase, error: { type: primary.code, message: primary.message }, diagnostic: primary }
      : undefined,
  };
}
