/**
 * GraphDocument ↔ project graph state bridge.
 * No UI stack semantics in this module.
 */

import { createGraphDocument } from './graph_document.js';
import {
  resolveCanonicalNodeType,
  stripTypeFieldsFromData,
} from './graph_node_payload.js';

/** Canonical type from GraphDocument node (node.type). */
export function resolveCanvasBlockType(node) {
  return resolveCanonicalNodeType(node);
}

const DATA_TYPE_MIRROR_KEYS = new Set(['type', 'blockType', 'canvasBlockType', 'props']);

/**
 * Props payload for project bridge — merges nested `data.props` with other data fields
 * (e.g. semanticId) without re-introducing type mirrors.
 */
export function resolveCanvasBlockProps(node) {
  const data = node?.data && typeof node.data === 'object' ? node.data : {};
  const props = stripTypeFieldsFromData(
    data.props && typeof data.props === 'object' && !Array.isArray(data.props)
      ? data.props
      : data,
  );
  const extras = {};
  for (const [key, value] of Object.entries(data)) {
    if (DATA_TYPE_MIRROR_KEYS.has(key)) continue;
    extras[key] = value;
  }
  return { ...extras, ...props };
}

export function projectGraphToGraphDocument(projectGraph) {
  const nodes = Object.values(projectGraph.nodes || {}).map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.props || n.data || {},
    meta: n.meta || {},
  }));
  const edges = Object.values(projectGraph.edges || {}).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourcePort: e.sourcePort || 'flow',
    targetPort: e.targetPort || 'flow',
    label: e.label || '',
    condition: e.condition || '',
  }));
  return createGraphDocument({
    schema_version: projectGraph.schemaVersion ?? 1,
    nodes,
    edges,
    viewport: projectGraph.viewport,
    ui_state: projectGraph.ui,
    metadata: { name: 'studio-project', revision: 0 },
  });
}

export function graphDocumentToProjectGraph(document) {
  const doc = createGraphDocument(document);
  const nodes = {};
  const edges = {};
  for (const node of Object.values(doc.nodes)) {
    nodes[node.id] = {
      id: node.id,
      type: resolveCanvasBlockType(node),
      props: resolveCanvasBlockProps(node),
      position: { ...node.position },
      meta: { ...node.meta },
      uiAttachments: node.meta?.uiAttachments,
    };
  }
  for (const edge of Object.values(doc.edges)) {
    if (edge.invalid) continue;
    edges[edge.id] = { ...edge };
  }
  return {
    schemaVersion: doc.schema_version,
    nodes,
    edges,
    viewport: { ...doc.viewport },
    ui: { ...doc.ui_state },
  };
}
