/**
 * Resolve block type → capability contract (no node.type switches downstream).
 */

import {
  assertBlockCapabilitiesRegistered,
  getBlockCapabilities,
  getBlockCapabilitiesStrict,
} from "../registry/blockCapabilities.js";

export interface ResolvedNodeCapability {
  blockType: string;
  /** Primary action for body / runtime execution. */
  primaryAction: string;
  actions: readonly string[];
  triggers: readonly string[];
  async: boolean;
  outputs: readonly string[];
}

/**
 * @param {string} blockType
 * @param {{ nodeId?: string, strict?: boolean }} [options]
 */
export function resolveNodeCapability(
  blockType: string,
  options: { nodeId?: string; strict?: boolean } = {},
): ResolvedNodeCapability {
  const caps = options.strict
    ? getBlockCapabilitiesStrict(blockType, { nodeId: options.nodeId })
    : getBlockCapabilities(blockType);

  const actions = caps.actions ?? [];
  const triggers = caps.triggers ?? [];
  const primaryAction = actions[0] ?? triggers[0] ?? "noop";

  return Object.freeze({
    blockType: String(blockType || "").trim(),
    primaryAction,
    actions: Object.freeze([...actions]),
    triggers: Object.freeze([...triggers]),
    async: Boolean(caps.async),
    outputs: Object.freeze([...(caps.outputs ?? [])]),
  });
}

/**
 * Handler nodes: compile / bind transport via trigger capability.
 */
export function resolveHandlerTriggerCapability(
  blockType: string,
  options: { nodeId?: string } = {},
): string | null {
  const resolved = resolveNodeCapability(blockType, {
    ...options,
    strict: true,
  });
  return resolved.triggers[0] ?? null;
}

/**
 * Fail-fast registry assert for compile/runtime pipelines.
 */
export function assertNodeCapabilityRegistered(
  blockType: string,
  nodeId?: string,
): ResolvedNodeCapability {
  assertBlockCapabilitiesRegistered(blockType);
  return resolveNodeCapability(blockType, { nodeId, strict: true });
}
