/**
 * Deterministic GraphDocument serialization and schema migration.
 */

import { createGraphDocument } from './graph_document.js';
import {
  GRAPH_DOCUMENT_SCHEMA_VERSION,
  normalizeGraphDocumentEdge,
  normalizeGraphDocumentNode,
  normalizeMetadata,
  normalizeUiState,
  normalizeViewport,
} from './graph_schema.js';
import { migrateUiAttachmentsToKeyboardNodes } from './graph_keyboard_nodes.js';

const MIGRATIONS = [
  {
    to: 1,
    id: 'constructor-graph-document-v1',
    description: 'Initial GraphDocument: nodes, edges, metadata, viewport, ui_state.',
    apply(raw) {
      const nodes = {};
      const edges = {};
      const nodeList = Array.isArray(raw.nodes)
        ? raw.nodes
        : Object.values(raw.nodes || {});
      const edgeList = Array.isArray(raw.edges)
        ? raw.edges
        : Object.values(raw.edges || {});
      for (const n of nodeList) {
        const node = normalizeGraphDocumentNode(n);
        if (node) nodes[node.id] = node;
      }
      for (const e of edgeList) {
        const edge = normalizeGraphDocumentEdge(e);
        if (edge && nodes[edge.source] && nodes[edge.target]) {
          edges[edge.id] = edge;
        }
      }
      return {
        schema_version: 1,
        nodes,
        edges,
        metadata: normalizeMetadata(raw.metadata ?? { name: raw.name }),
        viewport: normalizeViewport(raw.viewport),
        ui_state: normalizeUiState(raw.ui_state ?? raw.ui),
      };
    },
  },
  {
    to: 2,
    id: 'ui-attachments-to-keyboard-nodes-v2',
    description: 'Move inline/reply uiAttachments to inline_keyboard / reply_keyboard graph nodes.',
    apply(raw) {
      const base = {
        schema_version: 1,
        nodes: raw.nodes || {},
        edges: raw.edges || {},
        metadata: raw.metadata,
        viewport: raw.viewport,
        ui_state: raw.ui_state,
      };
      const doc = createGraphDocument(base);
      const { document } = migrateUiAttachmentsToKeyboardNodes(doc);
      return {
        ...document,
        schema_version: 2,
      };
    },
  },
];

export function migrateSchema(doc, targetVersion = GRAPH_DOCUMENT_SCHEMA_VERSION) {
  let current = { ...(doc || {}) };
  let version = Number(current.schema_version ?? current.schemaVersion ?? 0);
  const trace = [];
  while (version < targetVersion) {
    const step = MIGRATIONS.find((m) => m.to === version + 1);
    if (!step) {
      throw new Error(`No GraphDocument migration from version ${version} to ${version + 1}`);
    }
    current = step.apply(current);
    version = step.to;
    trace.push(step.id);
  }
  return { document: createGraphDocument(current), trace };
}

function stableSortIds(record) {
  return Object.keys(record || {}).sort((a, b) => a.localeCompare(b));
}

function deterministicId(prefix, parts) {
  let hash = 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i += 1) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`;
}

export function exportGraphDocument(document, options = {}) {
  const doc = createGraphDocument(document);
  const nodeIds = stableSortIds(doc.nodes);
  const edgeIds = stableSortIds(doc.edges);
  const remap = options.remapIds !== false;

  const nodes = nodeIds.map((id, index) => {
    const node = doc.nodes[id];
    const nextId = remap
      ? deterministicId('node', [node.type, index, node.position.x, node.position.y])
      : id;
    return { ...node, id: nextId, _sourceId: id };
  });
  const idMap = Object.fromEntries(nodes.map((n) => [n._sourceId, n.id]));

  const edges = edgeIds.map((id, index) => {
    const edge = doc.edges[id];
    const source = idMap[edge.source] ?? edge.source;
    const target = idMap[edge.target] ?? edge.target;
    const nextId = remap
      ? deterministicId('edge', [source, target, edge.sourcePort, edge.targetPort, index])
      : id;
    return {
      id: nextId,
      source,
      target,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      label: edge.label,
      condition: edge.condition,
    };
  });

  const exported = {
    schema_version: doc.schema_version,
    nodes: nodes.map(({ _sourceId, ...n }) => n),
    edges,
    metadata: { ...doc.metadata },
    viewport: { ...doc.viewport },
    ui_state: {
      selection: [...(doc.ui_state.selection || [])],
      collapsed: [...(doc.ui_state.collapsed || [])],
      groups: (doc.ui_state.groups || []).map((g) => ({
        id: g.id,
        label: g.label,
        nodeIds: g.nodeIds.map((nid) => idMap[nid] ?? nid).sort((a, b) => a.localeCompare(b)),
      })),
    },
  };
  return Object.freeze(exported);
}

export function importGraphDocument(raw, options = {}) {
  const target = options.targetVersion ?? GRAPH_DOCUMENT_SCHEMA_VERSION;
  const { document, trace } = migrateSchema(raw, target);
  return { document, trace };
}

export { MIGRATIONS as GRAPH_DOCUMENT_MIGRATIONS };
