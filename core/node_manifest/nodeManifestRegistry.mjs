/**
 * NodeManifestRegistry — single source of truth for node types (read-only after boot).
 */

import { blockDefinitions } from '../blockRegistry.js';

import { buildAllNodeManifests } from './buildNodeManifests.mjs';

export class NodeManifestRegistryModificationError extends Error {
  static MESSAGE = 'Runtime modification of node manifest registry is forbidden';

  constructor(context = '') {
    const suffix = context ? ` (${context})` : '';
    super(`${NodeManifestRegistryModificationError.MESSAGE}${suffix}`);
    this.name = 'NodeManifestRegistryModificationError';
  }
}

export class NodeManifestNotFoundError extends Error {
  /**
   * @param {string} type
   * @param {{ nodeId?: string }} [context]
   */
  constructor(type, context = {}) {
    const nodePart = context.nodeId ? ` for node "${context.nodeId}"` : '';
    super(`Unknown node type "${type}"${nodePart} — not registered in NodeManifestRegistry`);
    this.name = 'NodeManifestNotFoundError';
    this.type = type;
    this.nodeId = context.nodeId ?? null;
  }
}

export class NodeManifestRegistry {
  /** @param {readonly import('./nodeManifestTypes.mjs').NodeManifest[]} manifests */
  constructor(manifests) {
    /** @type {Map<string, import('./nodeManifestTypes.mjs').NodeManifest>} */
    this._byType = new Map();
    this._sealed = false;

    for (const manifest of manifests) {
      const type = String(manifest.type || '').trim();
      if (!type) throw new Error('NodeManifest.type is required');
      if (this._byType.has(type)) {
        throw new Error(`Duplicate NodeManifest type "${type}"`);
      }
      this._byType.set(type, manifest);
    }
    this._seal();
  }

  _seal() {
    this._sealed = true;
    Object.defineProperty(this, 'register', {
      value: () => {
        throw new NodeManifestRegistryModificationError('register');
      },
      writable: false,
      configurable: false,
    });
    Object.freeze(this._byType);
    Object.freeze(this);
  }

  get size() {
    return this._byType.size;
  }

  /** @returns {readonly string[]} */
  types() {
    return Object.freeze([...this._byType.keys()].sort());
  }

  /** @returns {readonly import('./nodeManifestTypes.mjs').NodeManifest[]} */
  list() {
    return Object.freeze([...this._byType.values()]);
  }

  /**
   * @param {string} type
   * @returns {import('./nodeManifestTypes.mjs').NodeManifest | undefined}
   */
  tryGet(type) {
    return this._byType.get(String(type || '').trim());
  }

  /**
   * @param {string} type
   * @returns {boolean}
   */
  has(type) {
    return this._byType.has(String(type || '').trim());
  }

  /**
   * @param {string} type
   * @param {{ nodeId?: string }} [context]
   * @returns {import('./nodeManifestTypes.mjs').NodeManifest}
   */
  get(type, context = {}) {
    const manifest = this.tryGet(type);
    if (!manifest) {
      throw new NodeManifestNotFoundError(String(type || '').trim(), context);
    }
    return manifest;
  }

  /**
   * @param {string} type
   * @param {{ nodeId?: string }} [context]
   * @returns {string}
   */
  assertRegistered(type, context = {}) {
    this.get(type, context);
    return String(type || '').trim();
  }
}

/** @type {NodeManifestRegistry | null} */
var _registry = null;

/**
 * Initialize sealed registry (call once after blockRegistry is loaded).
 * @param {readonly import('../blockRegistry.js').BlockDefinition[]} blockDefinitions
 */
export function primeNodeManifestRegistry(blockDefinitions) {
  if (_registry) return _registry;
  _registry = new NodeManifestRegistry(buildAllNodeManifests(blockDefinitions));
  return _registry;
}

/**
 * Boot-time singleton (read-only after prime).
 * @returns {NodeManifestRegistry}
 */
export function getNodeManifestRegistry() {
  if (!_registry) {
    primeNodeManifestRegistry(blockDefinitions);
  }
  return _registry;
}

/** @param {NodeManifestRegistry} registry — tests only, before first getNodeManifestRegistry(). */
export function __setNodeManifestRegistryForTests(registry) {
  if (_registry) {
    throw new Error('NodeManifestRegistry already initialized');
  }
  _registry = registry;
}

export function __resetNodeManifestRegistryForTests() {
  _registry = null;
}
