/**
 * Capability-based Python codegen registry — dispatch by capability id, not node.type switch.
 */

import { MissingCompilerError } from './errors.js';
import { getBlockCapabilities } from '../registry/blockCapabilities.js';
import { resolveHandlerTriggerCapability } from '../capabilities/resolveNodeCapability.ts';

/** @type {Map<string, (block: object, ctx: object) => string>} */
const capabilityEmitters = new Map();

/** @type {Map<string, string>} blockType → primary capability id (cache) */
const blockTypePrimaryCapability = new Map();

/**
 * @param {string} capabilityId
 * @param {(block: object, ctx: object) => string} fn
 */
export function registerCapabilityEmitter(capabilityId, fn) {
  const id = String(capabilityId || '').trim();
  if (!id || typeof fn !== 'function') {
    throw new Error('registerCapabilityEmitter(id, fn) requires id and function');
  }
  capabilityEmitters.set(id, fn);
}

/** @param {string} capabilityId */
export function getCapabilityEmitter(capabilityId) {
  return capabilityEmitters.get(String(capabilityId || '').trim()) || null;
}

/** @param {string} blockType */
export function primaryCapabilityForBlockType(blockType) {
  const key = String(blockType || '').trim();
  if (blockTypePrimaryCapability.has(key)) {
    return blockTypePrimaryCapability.get(key);
  }
  const caps = getBlockCapabilities(key);
  const primary = caps.actions?.[0] ?? caps.triggers?.[0] ?? 'noop';
  blockTypePrimaryCapability.set(key, primary);
  return primary;
}

/**
 * @param {string} capabilityId
 * @param {object} block
 * @param {object} [ctx]
 */
export function emitCapabilityPython(capabilityId, block, ctx = {}) {
  const id = String(capabilityId || '').trim();
  const fn = capabilityEmitters.get(id);
  if (!fn) {
    throw new MissingCompilerError(id, block?.id ?? block?.props?.nodeId);
  }
  return fn(block, ctx);
}

/**
 * Compile block via capability contract (handler → trigger, body → primary action).
 * @param {{ type?: string, props?: object, payload?: object, id?: string }} block
 * @param {object} [ctx]
 */
export function compileBlockViaCapability(block, ctx = {}) {
  const type = String(block?.type || '').trim();
  if (!type) {
    throw new MissingCompilerError('(missing)', block?.id);
  }

  if (ctx?.emitHandlerDecorator) {
    const trigger = resolveHandlerTriggerCapability(type, {
      nodeId: block?.id ?? block?.props?.nodeId,
    });
    if (trigger) {
      return emitCapabilityPython(trigger, block, ctx);
    }
  }

  const capabilityId = primaryCapabilityForBlockType(type);
  return emitCapabilityPython(capabilityId, block, ctx);
}

export function listCapabilityEmitters() {
  return [...capabilityEmitters.keys()].sort();
}
