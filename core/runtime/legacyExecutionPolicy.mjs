/**
 * Production runtime policy: Graph Execution IR only unless LEGACY_EXECUTION_ENABLED.
 *
 * Set LEGACY_EXECUTION_ENABLED=true to allow:
 * - Bot IR capability plan runtime (createRuntimeEngine / execute)
 * - Bot IR → Execution IR (buildExecutionIrFromBotIr)
 * - Direct buildExecutionIrFromFlowGraph without compileFlowGraphToExecutionIr
 */

export class LegacyExecutionDisabledError extends Error {
  /**
   * @param {string} [context]
   * @param {string} [hint]
   */
  constructor(context = '', hint = '') {
    const suffix = context ? `: ${context}` : '';
    const guide =
      hint ||
      'Use compileFlowGraphToExecutionIr() and ExecutionScheduler (runGraphExecutionIr).';
    super(`Legacy execution is disabled (LEGACY_EXECUTION_ENABLED=false)${suffix}. ${guide}`);
    this.name = 'LegacyExecutionDisabledError';
    this.code = 'LEGACY_EXECUTION_DISABLED';
  }
}

/** @returns {boolean} */
export function isLegacyExecutionEnabled() {
  const raw = process.env.LEGACY_EXECUTION_ENABLED;
  if (raw === undefined || raw === '') return false;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

/** @returns {boolean} */
export function isProductionRuntime() {
  const env = String(process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  return env === 'production';
}

/**
 * Capability-plan / IrProgram-style JS runtime (not Graph Execution IR).
 * @param {string} [context]
 */
export function assertLegacyExecutionAllowed(context = '') {
  if (isLegacyExecutionEnabled()) return;
  throw new LegacyExecutionDisabledError(
    context,
    'Enable LEGACY_EXECUTION_ENABLED=true for Bot IR capability runtime, or use runGraphExecutionIr.',
  );
}

let _compileGateDepth = 0;

/**
 * Internal: only compileFlowGraphToExecutionIr may call buildExecutionIrFromFlowGraph in production.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function withExecutionIrCompileGate(fn) {
  _compileGateDepth += 1;
  try {
    return fn();
  } finally {
    _compileGateDepth -= 1;
  }
}

/** @returns {boolean} */
export function isExecutionIrCompileGateOpen() {
  return _compileGateDepth > 0;
}

/**
 * Flow-graph Execution IR build must go through the validated compiler gate.
 * @param {string} [context]
 */
export function assertGraphExecutionIrCompilePath(context = '') {
  if (isLegacyExecutionEnabled()) return;
  if (_compileGateDepth > 0) return;
  throw new LegacyExecutionDisabledError(
    context,
    'Call compileFlowGraphToExecutionIr() (runStrictExecutionCompilerGate → build).',
  );
}

/**
 * @param {import('./execution/executionIr.js').ExecutionIrPlan | { metadata?: { source?: string } }} plan
 * @param {string} [context]
 */
export function assertGraphExecutionIrPlan(plan, context = '') {
  const source = plan?.metadata?.source;
  if (source === 'flow_graph' || source === undefined) return;
  assertLegacyExecutionAllowed(
    context || `Execution IR plan source "${String(source)}"`,
  );
}
