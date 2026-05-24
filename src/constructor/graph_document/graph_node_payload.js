/**
 * Canonical GraphDocument node typing — `node.type` is the only source of truth.
 * `node.data.type` / `node.data.blockType` are deprecated cache mirrors (legacy readers only).
 * React Flow projection uses `data.canvasBlockType` (derived, never written back).
 */

import { blockRegistry, getBlockDefinition } from '../../../core/blockRegistry.js';
import { getNodeManifestRegistry } from '../../../core/node_manifest/nodeManifestRegistry.mjs';

export const LEGACY_WRAPPER_TYPES = new Set(['cicada', 'unknown', '']);

/** @deprecated Use node.type — legacy cache key in node.data */
export const DEPRECATED_DATA_TYPE_KEY = 'type';

/** @deprecated Use node.type — legacy cache key in node.data */
export const DEPRECATED_DATA_BLOCK_TYPE_KEY = 'blockType';

export class UnknownBlockTypeError extends Error {
  /**
   * @param {string} message
   * @param {{ nodeId?: string, type?: string }} [detail]
   */
  constructor(message, detail = {}) {
    super(message);
    this.name = 'UnknownBlockTypeError';
    this.nodeId = detail.nodeId ?? null;
    this.type = detail.type ?? null;
  }
}

/** @param {boolean} [force] */
export function isBlockInsertionDebugEnabled(force = false) {
  if (force) return true;
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__CICADA_DEBUG_BLOCKS__ === true) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * @param {string} message
 * @param {Record<string, unknown>} [detail]
 */
export function logBlockInsertion(message, detail = {}) {
  if (!isBlockInsertionDebugEnabled()) return;
  const label = '[ADD_BLOCK]';
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(`${label} ${message}`);
    console.log(detail);
    console.groupEnd();
  } else {
    console.log(label, message, detail);
  }
}

/**
 * Remove type mirrors from props before merging; does not add deprecated cache.
 * @param {object} [data]
 */
export function stripTypeFieldsFromData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  const raw = data.props && typeof data.props === 'object' && !Array.isArray(data.props)
    ? { ...data.props }
    : { ...data };
  delete raw.type;
  delete raw.blockType;
  delete raw.props;
  return raw;
}

/**
 * @deprecated Cache mirrors for legacy readers — canonical type is node.type.
 * @param {object} props — props-only payload
 * @param {string} blockType
 */
export function attachDeprecatedTypeCache(props, blockType) {
  const t = String(blockType || '').trim();
  return Object.freeze({
    ...props,
    [DEPRECATED_DATA_TYPE_KEY]: t,
    [DEPRECATED_DATA_BLOCK_TYPE_KEY]: t,
  });
}

/**
 * Resolve block type string — prefers `node.type`; deprecated data cache only for wrappers / import.
 * @param {{ id?: string, type?: string, data?: object }} node
 */
export function coerceLegacyBlockType(node) {
  const nodeId = node?.id != null ? String(node.id) : undefined;
  const raw = String(node?.type ?? '').trim();
  if (raw && !LEGACY_WRAPPER_TYPES.has(raw)) {
    return raw;
  }
  const data = node?.data && typeof node.data === 'object' ? node.data : {};
  /** @deprecated data.type / data.blockType — cache only */
  const cached = String(
    data[DEPRECATED_DATA_TYPE_KEY] || data[DEPRECATED_DATA_BLOCK_TYPE_KEY] || '',
  ).trim();
  if (cached && !LEGACY_WRAPPER_TYPES.has(cached)) {
    return cached;
  }
  if (LEGACY_WRAPPER_TYPES.has(raw) || !raw) {
    throw new UnknownBlockTypeError(
      nodeId
        ? `Node "${nodeId}" has no canonical block type (wrapper "${raw || '∅'}" without node.type)`
        : 'Block type is required',
      { nodeId, type: raw || cached || undefined },
    );
  }
  throw new UnknownBlockTypeError(
    nodeId ? `Node "${nodeId}" has invalid block type "${raw}"` : `Invalid block type "${raw}"`,
    { nodeId, type: raw },
  );
}

/**
 * Fail-fast: type must exist in blockRegistry.
 * @param {string} type
 * @param {{ nodeId?: string }} [context]
 */
export function assertRegisteredBlockType(type, context = {}) {
  const t = String(type ?? '').trim();
  if (!t || LEGACY_WRAPPER_TYPES.has(t)) {
    throw new UnknownBlockTypeError(
      context.nodeId
        ? `Node "${context.nodeId}": block type is required`
        : 'Block type is required',
      { nodeId: context.nodeId, type: t || undefined },
    );
  }
  try {
    getNodeManifestRegistry().assertRegistered(t, { nodeId: context.nodeId });
  } catch (err) {
    throw new UnknownBlockTypeError(
      err instanceof Error ? err.message : `Unknown block type "${t}"`,
      { nodeId: context.nodeId, type: t },
    );
  }
  return t;
}

/**
 * Runtime assert: node.type must be registered in blockRegistry.
 * @param {{ id?: string, type?: string, data?: object }} node
 */
export function assertNodeTypeInRegistry(node) {
  const nodeId = node?.id != null ? String(node.id) : undefined;
  const type = coerceLegacyBlockType(node);
  getNodeManifestRegistry().assertRegistered(type, { nodeId });
  return type;
}

/**
 * Canonical read — node.type (+ registry assert). Alias: graphResolveNodeType.
 * @param {{ id?: string, type?: string, data?: object }} node
 */
export function graphResolveNodeType(node) {
  return assertNodeTypeInRegistry(node);
}

/** @deprecated Prefer graphResolveNodeType */
export function resolveCanonicalNodeType(node) {
  return graphResolveNodeType(node);
}

/**
 * Props + deprecated type cache for node.data (canonical type lives on node.type).
 * @param {string} blockType
 * @param {object} [props]
 */
export function buildGraphNodeData(blockType, props = {}) {
  const t = assertRegisteredBlockType(blockType);
  const clean = stripTypeFieldsFromData(props);
  return attachDeprecatedTypeCache(clean, t);
}

/**
 * Normalize AddNode / composition payload before VM apply.
 * @param {object} payload
 */
export function normalizeGraphNodePayload(payload = {}) {
  const dataIn = payload.data ?? payload.props ?? {};
  const blockType = assertRegisteredBlockType(
    coerceLegacyBlockType({
      id: payload.nodeId,
      type: payload.type ?? payload.blockType,
      data: dataIn,
    }),
    { nodeId: payload.nodeId != null ? String(payload.nodeId) : undefined },
  );

  const data = buildGraphNodeData(blockType, dataIn);
  const normalized = {
    nodeId: payload.nodeId,
    type: blockType,
    position: payload.position,
    data,
    meta: payload.meta,
  };

  logBlockInsertion('normalizeGraphNodePayload', {
    type: blockType,
    nodeId: normalized.nodeId,
    dataKeys: Object.keys(data),
  });

  return normalized;
}

/**
 * Stack / palette block → AddNode composition payload. Type from block.type only.
 * @param {{ id: string, type: string, props?: object, uiAttachments?: object }} block
 * @param {{ x: number, y: number }} position
 */
export function blockToNodePayload(block, position) {
  if (!block?.id) {
    throw new Error('blockToNodePayload: block.id is required');
  }
  const blockType = String(block?.type ?? '').trim();
  if (!blockType) {
    throw new UnknownBlockTypeError(`blockToNodePayload: block.type is required (id=${block.id})`, {
      nodeId: block.id,
    });
  }
  assertRegisteredBlockType(blockType, { nodeId: block.id });
  return normalizeGraphNodePayload({
    nodeId: block.id,
    type: blockType,
    position,
    data: block.props || {},
    meta: { uiAttachments: block.uiAttachments || {} },
  });
}

/**
 * Plain node row for stacksToGraphDocument / validation snapshots.
 */
export function buildGraphDocumentNodeRow(block, position) {
  const payload = blockToNodePayload(
    {
      id: block.id,
      type: block.type,
      props: block.props,
      uiAttachments: block.uiAttachments,
    },
    position,
  );
  const node = {
    id: payload.nodeId,
    type: payload.type,
    position: payload.position,
    data: { ...payload.data },
    meta: payload.meta || {},
  };
  assertNodeTypeInRegistry(node);
  return node;
}

/**
 * Import stack block type — block.type first; props cache only for legacy stacks.
 * @param {{ type?: string, props?: object }} block
 */
export function resolveStackBlockType(block) {
  const direct = String(block?.type ?? '').trim();
  if (direct) {
    return assertRegisteredBlockType(direct);
  }
  const props = block?.props && typeof block.props === 'object' ? block.props : {};
  const legacy = String(
    props[DEPRECATED_DATA_TYPE_KEY] || props[DEPRECATED_DATA_BLOCK_TYPE_KEY] || '',
  ).trim();
  if (legacy) {
    return assertRegisteredBlockType(legacy);
  }
  throw new UnknownBlockTypeError('stacksToGraphDocument: block.type is required');
}

/** @deprecated Use blockRegistry lookup via assertRegisteredBlockType */
export { getBlockDefinition };
