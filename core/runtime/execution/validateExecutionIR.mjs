/**
 * Execution IR type vocabulary + normalization (type rewrite only).
 * Full validation: runStrictExecutionCompilerGate() before buildExecutionIrFromFlowGraph.
 */

import { isIntentOnlyNodeType } from './executionNodeTypes.mjs';

/** Only types permitted in nodes passed to Execution IR compilation. */
export const ALLOWED_EXECUTION_IR_NODE_TYPES = Object.freeze(
  new Set(['message', 'input', 'button', 'action', 'condition']),
);

/** Planner / legacy flow-graph type → Execution IR node type (explicit rewrite). */
const PLANNER_TYPE_TO_EXECUTION = Object.freeze({
  message: 'message',
  present: 'message',
  notify: 'message',
  reply: 'message',

  input: 'input',
  collect: 'input',
  ask: 'input',

  button: 'button',
  route_inline: 'button',
  inline: 'button',

  condition: 'condition',
  branch: 'condition',

  action: 'action',
  remember: 'action',
  persist: 'action',
  load: 'action',
  send_file: 'action',
  delegate: 'action',
  terminal: 'action',

  entry: 'action',
  root: 'action',
  interaction: 'action',
  task_entry: 'action',
  merge: 'action',
  branch_arm: 'action',
});

/** Structural planner types stored on action nodes (not executed as capabilities). */
export const STRUCTURAL_ACTION_TYPES = Object.freeze(
  new Set(['entry', 'root', 'interaction', 'task_entry', 'merge', 'branch_arm']),
);

export class ExecutionIRValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ExecutionIRValidationError';
    this.details = details;
  }
}

/**
 * @deprecated Use runStrictExecutionCompilerGate — partial type-only check (tests/helpers).
 * @param {readonly { id?: string, type?: string }[]} nodes
 */
export function validateExecutionIR(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const errors = [];

  for (const node of list) {
    const nodeId = String(node?.id ?? 'unknown');
    const type = String(node?.type ?? '').trim();

    if (!type) {
      errors.push(`Node ${nodeId}: missing type`);
      continue;
    }

    if (!ALLOWED_EXECUTION_IR_NODE_TYPES.has(type)) {
      errors.push(
        `Node ${nodeId}: type "${type}" is not allowed in Execution IR `
        + `(allowed: ${[...ALLOWED_EXECUTION_IR_NODE_TYPES].join(', ')})`,
      );
    }
  }

  if (errors.length) {
    throw new ExecutionIRValidationError(
      `Execution IR validation failed:\n${errors.join('\n')}`,
      { errors, nodeCount: list.length },
    );
  }

  return { ok: true, nodeCount: list.length };
}

/**
 * Map a single planner/legacy type to Execution IR vocabulary (throws on illegal types).
 * @param {string} plannerType
 * @param {string} nodeId
 */
export function mapPlannerTypeToExecutionIR(plannerType, nodeId = 'unknown') {
  const raw = String(plannerType ?? '').trim();

  if (!raw) {
    throw new ExecutionIRValidationError(`Node ${nodeId}: missing type`);
  }

  if (isIntentOnlyNodeType(raw)) {
    throw new ExecutionIRValidationError(
      `Node ${nodeId}: intent-only type "${raw}" cannot reach Execution IR`,
      { nodeId, type: raw },
    );
  }

  const mapped = PLANNER_TYPE_TO_EXECUTION[raw];
  if (!mapped) {
    throw new ExecutionIRValidationError(
      `Node ${nodeId}: unknown type "${raw}" cannot be compiled to Execution IR`,
      { nodeId, type: raw },
    );
  }

  return mapped;
}

/**
 * Rewrite flow graph nodes to Execution IR vocabulary (throws — no silent drops).
 * @param {object} flowGraph
 * @returns {object} flow graph with normalized nodes
 */
export function normalizeFlowGraphForExecutionIR(flowGraph) {
  const nodes = Array.isArray(flowGraph?.nodes) ? flowGraph.nodes : [];
  const normalizedNodes = nodes.map((node) => {
    const plannerType = String(node?.type ?? '').trim();
    const executionType = mapPlannerTypeToExecutionIR(plannerType, node?.id);

    const payload = {
      ...(node?.payload || {}),
      _plannerType: plannerType,
    };

    if (STRUCTURAL_ACTION_TYPES.has(plannerType)) {
      payload.structuralType = plannerType;
    }

    if (plannerType === 'terminal') {
      payload.halt = true;
    }

    return {
      ...node,
      type: executionType,
      payload,
    };
  });

  return {
    ...flowGraph,
    nodes: normalizedNodes,
    metadata: {
      ...(flowGraph?.metadata || {}),
      executionIrNormalized: true,
    },
  };
}
