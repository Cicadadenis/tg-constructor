/**
 * Local version history — production SaaS snapshot store (per project).
 */

const STORAGE_PREFIX = 'cicada_flow_versions_';
const MAX_VERSIONS = 24;

/** @type {Map<string, string> | null} */
let memoryStore = null;

let localStorageOk = null;

function useMemoryStore() {
  if (localStorageOk === null) {
    localStorageOk = false;
    if (typeof localStorage !== 'undefined') {
      try {
        const probe = '__cicada_vh_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        localStorageOk = true;
      } catch {
        localStorageOk = false;
      }
    }
  }
  if (localStorageOk) return false;
  if (!memoryStore) memoryStore = new Map();
  return true;
}

function storageKey(projectId) {
  return `${STORAGE_PREFIX}${projectId || '__draft__'}`;
}

function readRaw(key) {
  if (useMemoryStore()) return memoryStore.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  if (useMemoryStore()) {
    memoryStore.set(key, value);
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch { /* quota */ }
}

/**
 * @param {string} projectId
 * @returns {object[]}
 */
export function listFlowVersions(projectId) {
  try {
    const raw = readRaw(storageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} projectId
 * @param {object} graphDocument
 * @param {{ label?: string, kind?: 'autosave' | 'publish' | 'manual' }} [meta]
 */
export function pushFlowVersion(projectId, graphDocument, meta = {}) {
  if (!graphDocument) return null;
  const versions = listFlowVersions(projectId);
  const entry = {
    id: `v_${Date.now()}`,
    ts: Date.now(),
    label: meta.label || defaultLabel(meta.kind),
    kind: meta.kind || 'autosave',
    nodeCount: Object.keys(graphDocument.nodes || {}).length,
    edgeCount: Object.keys(graphDocument.edges || {}).length,
    revision: graphDocument.metadata?.revision ?? 0,
    snapshot: {
      nodes: graphDocument.nodes,
      edges: graphDocument.edges,
      metadata: graphDocument.metadata,
      viewport: graphDocument.viewport,
      ui_state: graphDocument.ui_state,
    },
  };
  const next = [entry, ...versions.filter((v) => v.id !== entry.id)].slice(0, MAX_VERSIONS);
  writeRaw(storageKey(projectId), JSON.stringify(next));
  return entry;
}

/**
 * @param {string} projectId
 * @param {string} versionId
 */
export function getFlowVersion(projectId, versionId) {
  return listFlowVersions(projectId).find((v) => v.id === versionId) || null;
}

/**
 * @param {string} projectId
 * @param {string} versionId
 */
export function removeFlowVersion(projectId, versionId) {
  const next = listFlowVersions(projectId).filter((v) => v.id !== versionId);
  writeRaw(storageKey(projectId), JSON.stringify(next));
  return next;
}

function defaultLabel(kind) {
  if (kind === 'publish') return 'Published';
  if (kind === 'manual') return 'Snapshot';
  return 'Autosave';
}
