import {
  getBlockDefaultProps,
  getBlockDefinition,
} from '../blockRegistry.js';
import { validateBlockAttachments } from '../capabilityEngine.js';

export const PROJECT_GRAPH_STATE_SCHEMA_VERSION = 1;

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function asRecord(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function normalizeViewport(viewport) {
  const x = Number(viewport?.x);
  const y = Number(viewport?.y);
  const zoom = Number(viewport?.zoom ?? viewport?.scale);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1,
  };
}

function normalizeUi(ui) {
  return {
    selection: Array.isArray(ui?.selection) ? ui.selection.map(String) : [],
    collapsed: Array.isArray(ui?.collapsed) ? ui.collapsed.map(String) : [],
  };
}

export function normalizeGraphNode(node) {
  const definition = getBlockDefinition(node?.type);
  if (!definition) return null;
  const normalized = validateBlockAttachments({
    id: node.id || uid('node'),
    type: definition.type,
    props: { ...getBlockDefaultProps(definition.type), ...(node.props || {}) },
    position: {
      x: Number.isFinite(Number(node.position?.x)) ? Number(node.position.x) : 260,
      y: Number.isFinite(Number(node.position?.y)) ? Number(node.position.y) : 160,
    },
    uiAttachments: node.uiAttachments,
  });
  return {
    ...normalized,
    category: definition.category,
  };
}

export function normalizeGraphEdge(edge) {
  const source = edge?.source ?? edge?.from;
  const target = edge?.target ?? edge?.to;
  if (!source || !target) return null;
  return {
    id: edge.id || uid('edge'),
    source: String(source),
    target: String(target),
    sourcePort: edge.sourcePort || edge.sourceHandle || 'flow',
    targetPort: edge.targetPort || edge.targetHandle || 'flow',
    label: edge.label || '',
    condition: edge.condition || '',
  };
}

export function createProjectGraphState(seed = {}) {
  const nodes = {};
  const edges = {};

  for (const rawNode of asArray(seed.nodes)) {
    const node = normalizeGraphNode(rawNode);
    if (node) nodes[node.id] = node;
  }

  for (const rawEdge of asArray(seed.edges)) {
    const edge = normalizeGraphEdge(rawEdge);
    if (edge && nodes[edge.source] && nodes[edge.target]) {
      edges[edge.id] = edge;
    }
  }

  return {
    schemaVersion: PROJECT_GRAPH_STATE_SCHEMA_VERSION,
    nodes,
    edges,
    viewport: normalizeViewport(seed.viewport),
    ui: normalizeUi(seed.ui),
  };
}

export function isProjectGraphState(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Number(value.schemaVersion) >= 1 &&
    value.nodes &&
    typeof value.nodes === 'object' &&
    !Array.isArray(value.nodes) &&
    value.edges &&
    typeof value.edges === 'object' &&
    !Array.isArray(value.edges)
  );
}

export function projectGraphToEngineGraph(projectGraph = createProjectGraphState()) {
  const graph = createProjectGraphState(projectGraph);
  return {
    nodes: Object.values(graph.nodes),
    edges: Object.values(graph.edges).map((edge) => ({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      label: edge.label || '',
      condition: edge.condition || '',
    })),
  };
}

export function projectGraphFromEngineGraph(engineGraph, options = {}) {
  return createProjectGraphState({
    nodes: engineGraph?.nodes || [],
    edges: (engineGraph?.edges || []).map((edge) => ({
      ...edge,
      source: edge.source ?? edge.from,
      target: edge.target ?? edge.to,
    })),
    viewport: options.viewport || options.previous?.viewport,
    ui: options.ui || options.previous?.ui,
  });
}

export function projectGraphToFlow(projectGraph = createProjectGraphState()) {
  const graph = createProjectGraphState(projectGraph);
  return {
    nodes: Object.values(graph.nodes).map((node) => ({
      id: node.id,
      type: 'cicada',
      position: node.position || { x: 0, y: 0 },
      data: {
        type: node.type,
        props: { ...(node.props || {}) },
        uiAttachments: node.uiAttachments || undefined,
        irId: node.id,
        compilerId: node.id,
        semanticId: node.id,
      },
    })),
    edges: Object.values(graph.edges).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourcePort || 'flow',
      targetHandle: edge.targetPort || 'flow',
      label: edge.label || '',
      condition: edge.condition || '',
    })),
  };
}

export function withProjectGraphViewport(projectGraph, viewport) {
  return createProjectGraphState({
    ...asRecord(projectGraph),
    viewport: normalizeViewport(viewport),
  });
}
