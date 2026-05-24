/**
 * Node type boundaries: Intent / Flow Graph / Execution IR.
 * `scenario` and related types MUST NOT reach Flow Graph or Execution IR.
 */

/** Intent-level constructs (Bot Intent Plan, Canonical IR scenarios[], editor stacks). */
export const INTENT_ONLY_NODE_TYPES = Object.freeze(
  new Set([
    'scenario',
    'step',
    'block',
    'run',
    'use',
    'use_block',
  ]),
);

/** Planner flow graph (capability synthesizer output). */
export const ALLOWED_FLOW_GRAPH_NODE_TYPES = Object.freeze(
  new Set([
    'entry',
    'root',
    'interaction',
    'task_entry',
    'present',
    'collect',
    'notify',
    'remember',
    'persist',
    'load',
    'send_file',
    'route_inline',
    'branch',
    'branch_arm',
    'merge',
    'delegate',
    'terminal',
  ]),
);

/** Structural / control — compiled in Execution IR but not capability actions. */
export const FLOW_GRAPH_STRUCTURAL_TYPES = Object.freeze(
  new Set(['entry', 'root', 'interaction', 'task_entry', 'branch_arm', 'merge', 'delegate']),
);

/** Executable source node types allowed in Execution IR build. */
export const ALLOWED_EXECUTION_IR_NODE_TYPES = Object.freeze(
  new Set([
    ...ALLOWED_FLOW_GRAPH_NODE_TYPES,
  ]),
);

export function isIntentOnlyNodeType(type) {
  return INTENT_ONLY_NODE_TYPES.has(String(type || '').trim());
}

export function isAllowedFlowGraphNodeType(type) {
  const t = String(type || '').trim();
  if (!t) return false;
  if (isIntentOnlyNodeType(t)) return false;
  return ALLOWED_FLOW_GRAPH_NODE_TYPES.has(t);
}

export function isAllowedExecutionIrNodeType(type) {
  const t = String(type || '').trim();
  if (!t) return false;
  if (isIntentOnlyNodeType(t)) return false;
  return ALLOWED_EXECUTION_IR_NODE_TYPES.has(t);
}

/**
 * @param {{ id?: string, type?: string }} node
 * @param {ReadonlySet<string>} allowedTypes
 * @param {{ strict?: boolean, throwOnIntentOnly?: boolean }} [options]
 */
export function validateNodeType(node, allowedTypes, options = {}) {
  const nodeId = String(node?.id ?? 'unknown');
  const type = String(node?.type ?? '').trim();

  if (!type) {
    const msg = `Node ${nodeId}: missing type`;
    if (options.strict) throw new Error(msg);
    return { ok: false, reason: 'missing_type', type: '', nodeId };
  }

  if (isIntentOnlyNodeType(type)) {
    const msg = `Node ${nodeId}: intent-only type "${type}" cannot reach execution layer`;
    if (options.throwOnIntentOnly || options.strict) throw new Error(msg);
    return { ok: false, reason: 'intent_only', type, nodeId };
  }

  if (!allowedTypes.has(type)) {
    const msg = `Node ${nodeId}: type "${type}" not in allowed execution types`;
    if (options.strict) throw new Error(msg);
    return { ok: false, reason: 'unknown', type, nodeId };
  }

  return { ok: true, reason: null, type, nodeId };
}

export function validateFlowGraphNodes(nodes, options = {}) {
  const errors = [];
  for (const node of nodes || []) {
    const result = validateNodeType(node, ALLOWED_FLOW_GRAPH_NODE_TYPES, {
      strict: false,
      throwOnIntentOnly: false,
      ...options,
    });
    if (!result.ok) {
      errors.push(result);
    }
  }
  return errors;
}
