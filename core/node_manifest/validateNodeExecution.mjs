/**
 * Runtime gate — all graph node execution must pass NodeManifest validation.
 */

import { getNodeManifestRegistry } from './nodeManifestRegistry.mjs';
import { NodeManifestNotFoundError } from './nodeManifestRegistry.mjs';

export class NodeManifestValidationError extends Error {
  /**
   * @param {string} message
   * @param {{ type?: string, nodeId?: string, issues?: unknown[] }} [detail]
   */
  constructor(message, detail = {}) {
    super(message);
    this.name = 'NodeManifestValidationError';
    this.type = detail.type ?? null;
    this.nodeId = detail.nodeId ?? null;
    this.issues = detail.issues ?? [];
  }
}

/**
 * @param {unknown} payload
 * @returns {Record<string, unknown>}
 */
function extractProps(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const p = /** @type {Record<string, unknown>} */ (payload);
  if (p.props && typeof p.props === 'object' && !Array.isArray(p.props)) {
    return /** @type {Record<string, unknown>} */ (p.props);
  }
  if (p.data && typeof p.data === 'object' && !Array.isArray(p.data)) {
    return /** @type {Record<string, unknown>} */ (p.data);
  }
  const { _runtime, _blockType, ...rest } = p;
  return rest;
}

/**
 * Validate node type + payload against NodeManifest before execution.
 * @param {string} blockType
 * @param {unknown} [payload]
 * @param {{ nodeId?: string, stepId?: string }} [context]
 * @returns {import('./nodeManifestTypes.mjs').NodeManifest}
 */
export function validateNodeExecution(blockType, payload = {}, context = {}) {
  const type = String(blockType || '').trim();
  if (!type) {
    throw new NodeManifestValidationError(
      context.nodeId
        ? `Node "${context.nodeId}": block type is required for execution`
        : 'Block type is required for execution',
      { nodeId: context.nodeId, type },
    );
  }

  let manifest;
  try {
    manifest = getNodeManifestRegistry().get(type, { nodeId: context.nodeId });
  } catch (err) {
    if (err instanceof NodeManifestNotFoundError) {
      throw new NodeManifestValidationError(err.message, {
        type,
        nodeId: context.nodeId,
      });
    }
    throw err;
  }

  const props = extractProps(payload);
  const parsed = manifest.inputs.schema.safeParse({ props });
  if (!parsed.success) {
    throw new NodeManifestValidationError(
      context.nodeId
        ? `Node "${context.nodeId}" (${type}): invalid input payload`
        : `Node type "${type}": invalid input payload`,
      {
        type,
        nodeId: context.nodeId,
        issues: parsed.error.issues,
      },
    );
  }

  if (manifest.validateProps) {
    const reason = manifest.validateProps(parsed.data.props);
    if (reason) {
      throw new NodeManifestValidationError(
        context.nodeId
          ? `Node "${context.nodeId}" (${type}): ${reason}`
          : `Node type "${type}": ${reason}`,
        { type, nodeId: context.nodeId },
      );
    }
  }

  return manifest;
}

/**
 * @param {string} blockType
 * @param {unknown} [payload]
 * @param {{ nodeId?: string, stepId?: string }} [context]
 */
export function assertNodeExecutionAllowed(blockType, payload = {}, context = {}) {
  return validateNodeExecution(blockType, payload, context);
}

/**
 * @param {{ type?: string, data?: object, payload?: object, id?: string }} node
 */
export function validateGraphNodeForExecution(node) {
  const nodeId = node?.id != null ? String(node.id) : undefined;
  const type = String(node?.type || '').trim();
  const payload = node?.data ?? node?.payload ?? {};
  return validateNodeExecution(type, payload, { nodeId });
}
