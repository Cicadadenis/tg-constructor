/**
 * ExecutionContract — required declaration for every executable node.
 */

import { z } from 'zod';

export const RETRY_POLICY_NONE = 'none';
export const RETRY_POLICY_SIMPLE = 'simple';
export const RETRY_POLICY_DURABLE = 'durable';

export const RETRY_POLICY_KINDS = Object.freeze([
  RETRY_POLICY_NONE,
  RETRY_POLICY_SIMPLE,
  RETRY_POLICY_DURABLE,
]);

export const ExecutionContractSchema = z
  .object({
    async: z.boolean(),
    idempotent: z.boolean(),
    retryPolicy: z.enum(RETRY_POLICY_KINDS),
  })
  .strict();

/** @typedef {z.infer<typeof ExecutionContractSchema>} ExecutionContract */

const SIMPLE_RETRY = Object.freeze({ maxAttempts: 3, backoffMs: 50 });
const DURABLE_RETRY = Object.freeze({ maxAttempts: 5, backoffMs: 100 });

export class ExecutionContractValidationError extends Error {
  /**
   * @param {string} message
   * @param {{ nodeId?: string, type?: string, issues?: unknown[] }} [detail]
   */
  constructor(message, detail = {}) {
    super(message);
    this.name = 'ExecutionContractValidationError';
    this.nodeId = detail.nodeId ?? null;
    this.type = detail.type ?? null;
    this.issues = detail.issues ?? [];
  }
}

/**
 * @param {unknown} contract
 * @param {{ nodeId?: string, type?: string }} [context]
 * @returns {ExecutionContract}
 */
export function assertValidExecutionContract(contract, context = {}) {
  const parsed = ExecutionContractSchema.safeParse(contract);
  if (!parsed.success) {
    const label = context.nodeId
      ? `Node "${context.nodeId}" (${context.type || '?'})`
      : `Type "${context.type || '?'}"`;
    throw new ExecutionContractValidationError(
      `${label}: invalid ExecutionContract — ${parsed.error.issues[0]?.message || parsed.error.message}`,
      {
        nodeId: context.nodeId,
        type: context.type,
        issues: parsed.error.issues,
      },
    );
  }
  return parsed.data;
}

/**
 * @param {ExecutionContract} contract
 * @returns {{ maxAttempts: number, backoffMs: number } | undefined}
 */
export function executionContractToRetryPolicy(contract) {
  assertValidExecutionContract(contract);
  if (contract.retryPolicy === RETRY_POLICY_NONE) {
    return undefined;
  }
  if (contract.retryPolicy === RETRY_POLICY_SIMPLE) {
    return { ...SIMPLE_RETRY };
  }
  return { ...DURABLE_RETRY };
}

/**
 * Build contract from capability map (NodeManifest boot).
 * @param {{ async?: boolean, actions?: string[] }} capMap
 */
export function buildExecutionContractFromCapabilities(capMap) {
  const async = Boolean(capMap?.async);
  const primaryAction = capMap?.actions?.[0] || 'noop';
  const idempotent = new Set([
    'load_storage',
    'ctx_get_var',
    'db_read',
    'db_query',
    'route',
    'noop',
    'branch',
    'halt',
  ]).has(primaryAction);

  let retryPolicy = RETRY_POLICY_NONE;
  if (async) {
    retryPolicy = idempotent ? RETRY_POLICY_SIMPLE : RETRY_POLICY_DURABLE;
  }

  return Object.freeze({
    async,
    idempotent,
    retryPolicy,
  });
}

/**
 * @param {ExecutionContract} contract
 * @returns {ExecutionContract}
 */
export function freezeExecutionContract(contract) {
  const valid = assertValidExecutionContract(contract);
  return Object.freeze({ ...valid });
}
