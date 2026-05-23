/**
 * GraphDocument — canonical source of truth for the constructor graph editor.
 * Canvas / React state is a projection only; never authoritative.
 */

import {
  GRAPH_DOCUMENT_SCHEMA_VERSION,
  isGraphDocumentShape,
  edgeInvalidReason,
  normalizeGraphDocumentEdge,
  normalizeGraphDocumentNode,
  normalizeMetadata,
  normalizeUiState,
  normalizeViewport,
} from './graph_schema.js';
import { sanitizeGraphSeed } from './graph_seed_sanitize.js';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function sortById(entries) {
  return Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function createGraphDocument(seed = {}) {
  const sanitized = sanitizeGraphSeed(seed);
  const nodes = {};
  const edges = {};
  for (const raw of asArray(sanitized.nodes)) {
    const node = normalizeGraphDocumentNode(raw);
    if (node) nodes[node.id] = node;
  }
  const nodeIds = new Set(Object.keys(nodes));
  const hydrationOrphans = [];
  const hydrationFromMeta = sanitized.metadata?.hydrationDiagnostics?.orphanEdges;

  if (nodeIds.size === 0) {
    if (hydrationFromMeta?.length) {
      hydrationOrphans.push(...hydrationFromMeta);
    }
  } else {
    for (const raw of asArray(sanitized.edges)) {
      const edge = normalizeGraphDocumentEdge(raw, nodeIds);
      if (!edge) continue;
      const reason = edgeInvalidReason(edge.source, edge.target, nodeIds);
      if (reason) {
        hydrationOrphans.push({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          invalidReason: reason,
        });
        continue;
      }
      edges[edge.id] = { ...edge, invalid: false };
    }
    if (!hydrationOrphans.length && hydrationFromMeta?.length) {
      hydrationOrphans.push(...hydrationFromMeta);
    }
  }

  const baseMeta = normalizeMetadata(sanitized.metadata);
  const nodeCount = nodeIds.size;
  const hasDanglingInDoc = Object.values(edges).some((e) => e.invalid);
  let hydrationDiagnostics = null;
  if (hydrationOrphans.length > 0) {
    hydrationDiagnostics = {
      orphanEdgeCount: hydrationOrphans.length,
      orphanEdges: hydrationOrphans,
      at: new Date().toISOString(),
    };
  }
  if (hydrationOrphans.length > 0 && import.meta.env?.DEV) {
    console.warn(
      `[GraphDocument] Dropped ${hydrationOrphans.length} dangling edge(s) (audit in metadata.hydrationDiagnostics):`,
      hydrationOrphans,
    );
  }

  return Object.freeze({
    schema_version: GRAPH_DOCUMENT_SCHEMA_VERSION,
    nodes: Object.freeze(sortById(nodes)),
    edges: Object.freeze(sortById(edges)),
    metadata: Object.freeze({
      ...baseMeta,
      hydrationDiagnostics,
    }),
    viewport: Object.freeze(normalizeViewport(sanitized.viewport ?? seed.viewport)),
    ui_state: Object.freeze(normalizeUiState(sanitized.ui_state ?? seed.ui_state ?? seed.ui)),
  });
}

export function cloneGraphDocument(document) {
  return createGraphDocument({
    schema_version: document?.schema_version,
    nodes: Object.values(document?.nodes ?? {}),
    edges: Object.values(document?.edges ?? {}),
    metadata: document?.metadata,
    viewport: document?.viewport,
    ui_state: document?.ui_state,
  });
}

export function isGraphDocument(value) {
  return isGraphDocumentShape(value);
}

export function withGraphDocumentRevision(document, patch = {}) {
  const meta = document.metadata || {};
  return createGraphDocument({
    ...document,
    ...patch,
    metadata: {
      ...meta,
      revision: (meta.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    },
  });
}
