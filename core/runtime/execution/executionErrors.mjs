/**
 * Explicit graph execution failures — no silent break, skip, or warn-as-control-flow.
 */

/**
 * @param {readonly string[]} executionPath
 */
function formatPath(executionPath) {
  return executionPath?.length ? executionPath.join(' → ') : '(empty)';
}

/** @param {unknown} value */
function q(value) {
  return JSON.stringify(value);
}

/**
 * @param {object} step
 */
export function stepNodeId(step) {
  return String(step?.sourceNodeId ?? step?.stepId ?? 'unknown');
}

/**
 * @param {object} step
 */
export function stepNodeType(step) {
  const kind = String(step?.kind ?? 'unknown');
  const cap = step?.capabilityId ? `:${step.capabilityId}` : '';
  const manifest = step?.payload?._manifestBlockType;
  if (manifest) return `${kind}[${manifest}]`;
  return `${kind}${cap}`;
}

export class ExecutionError extends Error {
  /**
   * @param {string} message
   * @param {{ nodeId: string, nodeType?: string | null, executionPath: readonly string[], reason: string }} detail
   */
  constructor(message, { nodeId, nodeType = null, executionPath, reason }) {
    super(message);
    this.name = 'ExecutionError';
    this.nodeId = nodeId;
    this.nodeType = nodeType;
    this.executionPath = Object.freeze([...(executionPath || [])]);
    this.reason = reason;
  }

  /** @returns {Record<string, unknown>} */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      nodeId: this.nodeId,
      nodeType: this.nodeType,
      executionPath: [...this.executionPath],
      reason: this.reason,
    };
  }

  /**
   * @param {string} stepId
   * @param {readonly string[]} executionPath
   */
  static missingStep(stepId, executionPath) {
    const pathRepr = formatPath(executionPath);
    return new ExecutionError(
      `Execution step ${JSON.stringify(stepId)} is missing from plan `
      + `(node_id=${JSON.stringify(stepId)}, node_type=null, execution_path=${pathRepr})`,
      {
        nodeId: stepId,
        nodeType: null,
        executionPath,
        reason: 'missing_step',
      },
    );
  }

  /**
   * @param {string} nodeId
   * @param {string | null} nodeType
   * @param {readonly string[]} executionPath
   */
  static missingNode(nodeId, nodeType, executionPath) {
    const pathRepr = formatPath(executionPath);
    const typeRepr = nodeType ?? '?';
    return new ExecutionError(
      `Flow graph node ${nodeId} is missing `
      + `(node_id=${nodeId}, node_type=${typeRepr}, execution_path=${pathRepr})`,
      {
        nodeId,
        nodeType,
        executionPath,
        reason: 'missing_node',
      },
    );
  }

  /**
   * @param {object} step
   * @param {string} detail
   * @param {readonly string[]} executionPath
   */
  static invalidStep(step, detail, executionPath) {
    const nodeId = stepNodeId(step);
    const nodeType = stepNodeType(step);
    const pathRepr = formatPath(executionPath);
    return new ExecutionError(
      `Invalid execution step ${nodeId}: ${detail} `
      + `(node_id=${nodeId}, node_type=${nodeType}, execution_path=${pathRepr})`,
      {
        nodeId,
        nodeType,
        executionPath,
        reason: 'invalid_step',
      },
    );
  }

  /**
   * @param {object} step
   * @param {string} successorId
   * @param {readonly string[]} executionPath
   */
  static missingSuccessor(step, successorId, executionPath) {
    const nodeId = stepNodeId(step);
    const nodeType = stepNodeType(step);
    const pathRepr = formatPath(executionPath);
    return new ExecutionError(
      `Successor step ${successorId} is missing from plan (from ${nodeId}) `
      + `(node_id=${nodeId}, node_type=${nodeType}, execution_path=${pathRepr})`,
      {
        nodeId,
        nodeType,
        executionPath,
        reason: 'missing_successor',
      },
    );
  }

  /**
   * @param {object} step
   * @param {string} detail
   * @param {readonly string[]} executionPath
   */
  static invalidTransition(step, detail, executionPath) {
    const nodeId = stepNodeId(step);
    const nodeType = stepNodeType(step);
    const pathRepr = formatPath(executionPath);
    return new ExecutionError(
      `Invalid transition from ${nodeId}: ${detail} `
      + `(node_id=${nodeId}, node_type=${nodeType}, execution_path=${pathRepr})`,
      {
        nodeId,
        nodeType,
        executionPath,
        reason: 'invalid_transition',
      },
    );
  }

  /**
   * @param {string} nodeId
   * @param {string} nodeType
   * @param {readonly string[]} executionPath
   * @param {string} edgeKind
   */
  static missingEdge(nodeId, nodeType, executionPath, edgeKind) {
    const pathRepr = formatPath(executionPath);
    return new ExecutionError(
      `Required ${edgeKind} edge missing from node ${nodeId} `
      + `(node_id=${nodeId}, node_type=${nodeType}, execution_path=${pathRepr})`,
      {
        nodeId,
        nodeType,
        executionPath,
        reason: 'missing_edge',
      },
    );
  }

  /**
   * @param {string} nodeId
   * @param {string} nodeType
   * @param {readonly string[]} executionPath
   */
  static intentOnlyNode(nodeId, nodeType, executionPath) {
    const pathRepr = formatPath(executionPath);
    return new ExecutionError(
      `Node ${nodeId} has intent-only type ${nodeType} and cannot execute `
      + `(node_id=${nodeId}, node_type=${nodeType}, execution_path=${pathRepr})`,
      {
        nodeId,
        nodeType,
        executionPath,
        reason: 'intent_only_node',
      },
    );
  }

  /**
   * @param {object} step
   * @param {string} errorMessage
   * @param {readonly string[]} executionPath
   */
  static stepFailed(step, errorMessage, executionPath) {
    const nodeId = stepNodeId(step);
    const nodeType = stepNodeType(step);
    const pathRepr = formatPath(executionPath);
    return new ExecutionError(
      `Step ${nodeId} failed: ${errorMessage} `
      + `(node_id=${nodeId}, node_type=${nodeType}, execution_path=${pathRepr})`,
      {
        nodeId,
        nodeType,
        executionPath,
        reason: 'step_failed',
      },
    );
  }

  /**
   * @param {string} branchId
   * @param {readonly string[]} executionPath
   * @param {number} limit
   */
  static branchStepLimitExceeded(branchId, executionPath, limit) {
    const pathRepr = formatPath(executionPath);
    return new ExecutionError(
      `Branch ${branchId} exceeded ${limit} steps without completion `
      + `(node_id=${branchId}, node_type=branch, execution_path=${pathRepr})`,
      {
        nodeId: branchId,
        nodeType: 'branch',
        executionPath,
        reason: 'branch_step_limit_exceeded',
      },
    );
  }

  /**
   * @param {string} executionId
   * @param {readonly string[]} executionPath
   * @param {number} limit
   */
  static runStepLimitExceeded(executionId, executionPath, limit) {
    const pathRepr = formatPath(executionPath);
    return new ExecutionError(
      `Execution ${executionId} exceeded ${limit} scheduler steps `
      + `(node_id=${executionId}, node_type=null, execution_path=${pathRepr})`,
      {
        nodeId: executionId,
        nodeType: null,
        executionPath,
        reason: 'run_step_limit_exceeded',
      },
    );
  }
}
