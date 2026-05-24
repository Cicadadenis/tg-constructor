/**
 * Compiler registry — registerCompiler(type, fn) for aiogram block → Python.
 */

import { MissingCompilerError } from './errors.js';
import { compileBlockViaCapability } from './capabilityPythonRegistry.js';

/** @type {Map<string, (block: object, ctx: object) => string>} */
const compilers = new Map();

/**
 * @param {string} type
 * @param {(block: object, ctx: object) => string} fn
 */
export function registerCompiler(type, fn) {
  const key = String(type || '').trim();
  if (!key || typeof fn !== 'function') {
    throw new Error('registerCompiler(type, fn) requires non-empty type and function');
  }
  compilers.set(key, fn);
}

/** @param {string} type */
export function getCompiler(type) {
  return compilers.get(String(type || '').trim()) || null;
}

/** @returns {ReadonlyArray<string>} */
export function listRegisteredCompilerTypes() {
  return [...compilers.keys()].sort();
}

/** Frozen snapshot for tests. */
export function getCompilerRegistrySnapshot() {
  return Object.freeze(Object.fromEntries(compilers));
}

/**
 * @param {{ type?: string, props?: object, payload?: object, id?: string }} block
 * @param {object} context
 */
export function compileBlock(block, context = {}) {
  const type = String(block?.type ?? '').trim();
  if (!type) {
    throw new MissingCompilerError('(missing)', block?.id ?? block?.props?.nodeId);
  }
  if (context?.emitHandlerDecorator) {
    return compileBlockViaCapability(block, context);
  }
  const fn = getCompiler(type);
  if (!fn) {
    throw new MissingCompilerError(type, block?.id ?? block?.props?.nodeId);
  }
  return fn(block, context);
}

export const BLOCK_TO_PYTHON_COMPILER = new Proxy(
  {},
  {
    get(_t, prop) {
      if (typeof prop === 'string') return getCompiler(prop);
      return undefined;
    },
    ownKeys() {
      return listRegisteredCompilerTypes();
    },
    getOwnPropertyDescriptor(_t, prop) {
      if (getCompiler(String(prop))) {
        return { enumerable: true, configurable: true };
      }
      return undefined;
    },
  },
);
