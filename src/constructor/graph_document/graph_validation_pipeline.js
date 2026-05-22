/**
 * Unified graph validation pipeline — single source of truth for editor / compile / persist.
 */

import { validateGraphDocumentContract } from './contracts.js';
import { createGraphDocument, cloneGraphDocument } from './graph_document.js';
import { validateGraph as validateRegistrySemantics } from './operation_registry.js';
import { runGraphStructuralAudit } from './graph_structural_audit.js';
import { graphHasDanglingEdges } from './graph_edge_repair.js';
import { formatDiagnosticsForUser } from '../../builder/graph_error_messages.js';
import { isGraphEffectivelyEmpty } from './graph_canvas_state.js';
import {
  defersCallbackBlocking,
  isDeferredCallbackError,
  softenDiagnosticsForStage,
  VALIDATION_STAGE,
} from './validation_stages.js';

function checkFsmTransitions(nodes, pushDiagnostic) {
  const nodeList = Object.values(nodes || {});
  const scenarioNames = new Set();
  const scenarioSteps = new Map();

  for (const node of nodeList) {
    if (node.type === 'scenario') {
      const name = String(node.data?.name || '').trim();
      if (name) scenarioNames.add(name);
    }
    if (node.type === 'step') {
      const scenario = String(node.data?.scenario || 'Scenario').trim() || 'Scenario';
      const step = String(node.data?.name || '').trim();
      if (!step) continue;
      if (!scenarioSteps.has(scenario)) scenarioSteps.set(scenario, new Set());
      scenarioSteps.get(scenario).add(step);
    }
  }

  if (scenarioNames.size === 0 && scenarioSteps.size === 0) return;

  for (const node of nodeList) {
    if (node.type !== 'goto' && node.type !== 'run') continue;
    const rawTarget = String(node.data?.target || node.data?.name || '').trim();
    if (!rawTarget) continue;
    const [scenario, step] = rawTarget.split(/[./]/).filter(Boolean);
    if (!scenario) continue;
    if (!scenarioNames.has(scenario) && !scenarioSteps.has(scenario)) {
      pushDiagnostic({
        code: 'invalid_fsm_transition',
        severity: 'error',
        stage: 'topology',
        message: `Node ${node.id} references unknown scenario "${scenario}"`,
        nodeId: node.id,
      });
      continue;
    }
    if (step) {
      const steps = scenarioSteps.get(scenario);
      if (steps && !steps.has(step)) {
        pushDiagnostic({
          code: 'invalid_fsm_transition',
          severity: 'error',
          stage: 'topology',
          message: `Node ${node.id} references unknown step "${scenario}.${step}"`,
          nodeId: node.id,
        });
      }
    }
  }
}

export const VALIDATION_STAGES = Object.freeze([
  'schema',
  'hydration',
  'registry',
  'connections',
  'topology',
  'callbacks',
  'compile_gate',
]);

const STRICT_PROMOTE_CODES = new Set([
  'unreachable_node',
  'dead_end_branch',
  'dead_end_chain',
  'dangling_entry',
  'orphan_node',
  'missing_successor',
  'missing_handlers',
  'broken_callback_route',
  'invalid_callbacks',
  'cyclic_loop',
]);

/**
 * @typedef {object} GraphDiagnostic
 * @property {string} code
 * @property {'error'|'warning'|'info'} severity
 * @property {string} stage
 * @property {string} message
 * @property {string} [nodeId]
 * @property {string} [edgeId]
 * @property {string} [callbackData]
 */

/**
 * @param {object} raw
 * @returns {GraphDiagnostic[]}
 */
function normalizeLegacyIssues(raw, stage = 'legacy') {
  const out = [];
  for (const issue of raw.issues || []) {
    out.push({
      code: issue.code || 'validation_error',
      severity: 'error',
      stage,
      message: issue.message || 'Validation error',
      nodeId: issue.nodeId || null,
      edgeId: issue.edgeId || null,
    });
  }
  for (const w of raw.warnings || []) {
    const text = String(w);
    const [code, ref] = text.split(':');
    out.push({
      code: code || 'warning',
      severity: 'warning',
      stage,
      message: text,
      nodeId: ref && ref !== 'graph' ? ref : null,
    });
  }
  return out;
}

function normalizeStructuralItems(items, stage = 'topology') {
  return (items || []).map((item) => ({
    code: item.code,
    severity: item.severity === 'error' ? 'error' : 'warning',
    stage,
    message: item.message,
    nodeId: item.nodeId || null,
    edgeId: item.edgeId || null,
    callbackData: item.callbackData || null,
  }));
}

function applyStrictPromotion(diagnostics, strict) {
  if (!strict) return diagnostics;
  return diagnostics.map((d) => {
    if (d.severity !== 'warning') return d;
    if (!STRICT_PROMOTE_CODES.has(d.code)) return d;
    return { ...d, severity: 'error', message: `[strict] ${d.message}` };
  });
}

/** Editor soft stage — missing callback handlers are warnings, never blocking errors. */
function applyEditorCallbackSoftening(diagnostics, options = {}) {
  if (!options.allowMissingCallbackHandlers) return diagnostics;
  return diagnostics.map((d) => {
    if (!isDeferredCallbackError(d)) return d;
    if (d.severity === 'warning') return { ...d, _softEditorCallback: true };
    return {
      ...d,
      severity: 'warning',
      _softEditorCallback: true,
    };
  });
}

function summarizeBySeverity(diagnostics) {
  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byCode = {};
  for (const d of diagnostics) {
    bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
    byCode[d.code] = (byCode[d.code] || 0) + 1;
  }
  return { bySeverity, byCode, total: diagnostics.length };
}

/**
 * Full validation pipeline (editor + persist).
 * @param {object} graphOrDocument
 * @param {{ strict?: boolean, context?: string, skipLegacy?: boolean }} [options]
 */
function resolveAllowMissingCallbackHandlers(options, strict, validationStage) {
  if (options.allowMissingCallbackHandlers != null) {
    return Boolean(options.allowMissingCallbackHandlers);
  }
  if (strict || validationStage === VALIDATION_STAGE.COMPILE) {
    return false;
  }
  return true;
}

export function runGraphValidationPipeline(graphOrDocument, options = {}) {
  const strict = Boolean(options.strict);
  const validationStage = options.validationStage
    ?? (strict ? VALIDATION_STAGE.COMPILE : undefined);
  const allowMissingCallbackHandlers = resolveAllowMissingCallbackHandlers(
    options,
    strict,
    validationStage,
  );
  const pipelineOptions = {
    ...options,
    strict,
    validationStage,
    allowMissingCallbackHandlers,
  };
  const diagnostics = [];
  const stages = [];

  const contract = validateGraphDocumentContract(graphOrDocument);
  stages.push('schema');
  if (!contract.success) {
    diagnostics.push({
      code: 'schema_mismatch',
      severity: 'error',
      stage: 'schema',
      message: contract.error.issues.map((x) => x.message).join('; '),
    });
  }

  const document = createGraphDocument(graphOrDocument);
  stages.push('hydration');

  const danglingInDoc = graphHasDanglingEdges(document);
  const hydrationCount = Number(document.metadata?.hydrationDiagnostics?.orphanEdgeCount) || 0;
  if (danglingInDoc) {
    diagnostics.push({
      code: 'hydration_orphan_edges',
      severity: 'error',
      stage: 'hydration',
      message: `Graph has ${Object.values(document.edges || {}).filter((e) => e.invalid).length} invalid edge(s) in document`,
    });
  } else if (hydrationCount > 0) {
    diagnostics.push({
      code: 'hydration_orphan_edges',
      severity: 'warning',
      stage: 'hydration',
      message: `Legacy import removed ${hydrationCount} dangling edge(s) (see metadata.hydrationDiagnostics)`,
    });
  }

  if (graphHasDanglingEdges(document)) {
    for (const edge of Object.values(document.edges)) {
      if (!edge.invalid) continue;
      diagnostics.push({
        code: 'dangling_edge',
        severity: 'error',
        stage: 'hydration',
        message: `Dangling edge ${edge.id} (${edge.invalidReason || 'invalid'}): ${edge.source} → ${edge.target}`,
        edgeId: edge.id,
      });
    }
  }

  const registry = validateRegistrySemantics(document);
  stages.push('registry');
  for (const msg of registry.errors || []) {
    diagnostics.push({
      code: 'registry_semantic',
      severity: 'error',
      stage: 'registry',
      message: msg,
    });
  }
  for (const msg of registry.warnings || []) {
    diagnostics.push({
      code: 'registry_semantic',
      severity: 'warning',
      stage: 'registry',
      message: msg,
    });
  }

  const structural = runGraphStructuralAudit(document, {
    strict,
    includeCallbacks: pipelineOptions.includeCallbacks !== false,
    allowMissingCallbackHandlers,
  });
  stages.push('connections', 'topology', 'callbacks');
  diagnostics.push(...normalizeStructuralItems(structural.errors, 'connections'));
  diagnostics.push(...normalizeStructuralItems(structural.warnings, 'topology'));
  checkFsmTransitions(document.nodes, (d) => diagnostics.push(d));

  const softened = applyEditorCallbackSoftening(diagnostics, pipelineOptions);
  const promoted = applyStrictPromotion(softened, strict);
  const staged = validationStage != null && validationStage !== VALIDATION_STAGE.COMPILE
    ? softenDiagnosticsForStage(promoted, validationStage)
    : promoted;
  const errors = staged.filter((d) => d.severity === 'error');
  const warnings = staged.filter((d) => d.severity === 'warning');

  return {
    ok: errors.length === 0,
    document,
    diagnostics: staged,
    errors,
    warnings,
    stages: [...new Set(stages)],
    summary: summarizeBySeverity(staged),
  };
}

/** Codes that always block compile / IR export. */
const COMPILE_BLOCK_CODES = new Set([
  'dangling_edge',
  'hydration_orphan_edges',
  'missing_handlers',
  'broken_callback_route',
  'invalid_callbacks',
  'incompatible_connection',
  'dangling_edge',
  'self_connection',
  'duplicate_edge',
  'invalid_edges',
  'schema_mismatch',
  'registry_semantic',
]);

/**
 * Mandatory pre-compile gate — editor ↔ graph ↔ codegen alignment.
 */
export function strictCompileValidation(document, options = {}) {
  const validationStage = options.validationStage || VALIDATION_STAGE.COMPILE;
  const deferCallbackBlocking = validationStage !== VALIDATION_STAGE.COMPILE;

  if (isGraphEffectivelyEmpty(document)) {
    const doc = createGraphDocument(document);
    return {
      ok: true,
      document: doc,
      diagnostics: [],
      errors: [],
      warnings: [],
      stages: [],
      summary: { bySeverity: { error: 0, warning: 0, info: 0 }, byCode: {}, total: 0 },
      compileBlocked: false,
      blocking: [],
      compileDiagnostics: { report: [], summary: { bySeverity: {}, byCode: {}, total: 0 }, blockingCount: 0 },
    };
  }

  const result = runGraphValidationPipeline(document, {
    strict: validationStage === VALIDATION_STAGE.COMPILE,
    validationStage,
    allowMissingCallbackHandlers: deferCallbackBlocking
      || defersCallbackBlocking(validationStage),
    includeCallbacks: options.includeCallbacks !== false,
    skipLegacy: true,
    ...options,
  });

  const skipCallbacks = options.includeCallbacks === false;
  const blocking = result.errors.filter((d) => {
    if (deferCallbackBlocking && isDeferredCallbackError(d)) return false;
    if (skipCallbacks && (
      d.code === 'missing_handlers'
      || d.code === 'broken_callback_route'
      || d.code === 'invalid_callbacks'
    )) {
      return false;
    }
    return (
      COMPILE_BLOCK_CODES.has(d.code)
      || d.stage === 'hydration'
      || (options.blockWarnings && d.severity === 'warning')
    );
  });

  const compileBlocked = blocking.length > 0 || graphHasDanglingEdges(result.document);

  return {
    ...result,
    ok: !compileBlocked,
    compileBlocked,
    blocking,
    compileDiagnostics: {
      report: result.diagnostics,
      summary: result.summary,
      blockingCount: blocking.length,
    },
  };
}

export function formatDiagnosticsReport(pipelineResult, options = {}) {
  return formatDiagnosticsForUser(pipelineResult.diagnostics || [], options);
}

/** Legacy text report for logs only */
export function formatDiagnosticsReportRaw(pipelineResult) {
  const lines = [];
  for (const d of pipelineResult.diagnostics || []) {
    const ref = d.nodeId || d.edgeId || '';
    lines.push(`[${d.severity}] ${d.stage}/${d.code}${ref ? ` @${ref}` : ''}: ${d.message}`);
  }
  return lines.join('\n');
}

export { cloneGraphDocument };
