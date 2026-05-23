/**
 * GraphDocument schema — canonical constructor graph model (structural only).
 */

export const GRAPH_DOCUMENT_SCHEMA_VERSION = 2;

/** Runtime editor operations (event-sourced; no snapshot replace). */
export const GRAPH_OPERATION_TYPES = Object.freeze([
  'AddNode',
  'RemoveNode',
  'MoveNode',
  'UpdateNodeData',
  'AddEdge',
  'RemoveEdge',
  'UpdateEdge',
  'UpdateViewport',
  'GroupSelection',
  'UpdateUiState',
  'PatchMetadata',
]);

/** @deprecated Legacy aliases — normalized to canonical types in graph_operations. */
export const GRAPH_OPERATION_ALIASES = Object.freeze({
  DeleteNode: 'RemoveNode',
  ConnectEdge: 'AddEdge',
  DisconnectEdge: 'RemoveEdge',
  UpdateCondition: 'UpdateEdge',
});

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function normalizeOperationType(type) {
  return GRAPH_OPERATION_ALIASES[type] || type;
}

export function normalizeViewport(viewport) {
  return {
    x: Number.isFinite(Number(viewport?.x)) ? Number(viewport.x) : 0,
    y: Number.isFinite(Number(viewport?.y)) ? Number(viewport.y) : 0,
    zoom: Number.isFinite(Number(viewport?.zoom ?? viewport?.scale))
      ? Number(viewport.zoom ?? viewport.scale)
      : 1,
  };
}

export function normalizeUiState(uiState) {
  const ui = asRecord(uiState);
  return {
    selection: Array.isArray(ui.selection) ? ui.selection.map(String) : [],
    collapsed: Array.isArray(ui.collapsed) ? ui.collapsed.map(String) : [],
    groups: Array.isArray(ui.groups)
      ? ui.groups.map((g) => ({
          id: String(g.id),
          label: String(g.label ?? ''),
          nodeIds: Array.isArray(g.nodeIds) ? g.nodeIds.map(String) : [],
        }))
      : [],
  };
}

export function normalizeGraphDocumentNode(node) {
  if (!node?.id) return null;
  const position = node.position || {};
  const rawData = asRecord(node.data ?? node.props);
  const rawType = String(node.type ?? 'unknown');
  const blockType = (rawType === 'cicada' || rawType === 'unknown')
    ? String(rawData.type || rawData.blockType || rawType).trim() || 'message'
    : rawType;
  let props = rawData;
  if (rawData.props && typeof rawData.props === 'object' && !Array.isArray(rawData.props)) {
    props = { ...rawData.props };
  } else if (rawType === 'cicada' || rawData.type || rawData.blockType) {
    props = { ...rawData };
    delete props.type;
    delete props.blockType;
    delete props.props;
  }
  return {
    id: String(node.id),
    type: blockType,
    position: {
      x: Number.isFinite(Number(position.x)) ? Number(position.x) : 0,
      y: Number.isFinite(Number(position.y)) ? Number(position.y) : 0,
    },
    data: props,
    meta: asRecord(node.meta),
  };
}

export function edgeInvalidReason(source, target, nodeIds) {
  const missingSource = source && !nodeIds.has(source);
  const missingTarget = target && !nodeIds.has(target);
  if (missingSource && missingTarget) return 'dangling_both';
  if (missingSource) return 'dangling_source';
  if (missingTarget) return 'dangling_target';
  return null;
}

export function normalizeGraphDocumentEdge(edge, nodeIds = null) {
  const source = edge?.source ?? edge?.from;
  const target = edge?.target ?? edge?.to;
  if (!source || !target) return null;
  const src = String(source);
  const tgt = String(target);
  const ids = nodeIds instanceof Set ? nodeIds : null;
  const reason = ids ? edgeInvalidReason(src, tgt, ids) : (
    edge?.invalid ? String(edge.invalidReason || 'dangling_unknown') : null
  );
  const invalid = Boolean(edge?.invalid) || Boolean(reason);
  return {
    id: String(edge.id),
    source: src,
    target: tgt,
    sourcePort: String(edge.sourcePort ?? edge.sourceHandle ?? 'flow'),
    targetPort: String(edge.targetPort ?? edge.targetHandle ?? 'flow'),
    label: String(edge.label ?? ''),
    condition: String(edge.condition ?? edge.label ?? ''),
    invalid,
    ...(invalid ? { invalidReason: reason || String(edge.invalidReason || 'dangling_unknown') } : {}),
  };
}

export function normalizeMetadata(metadata) {
  const m = asRecord(metadata);
  return {
    name: String(m.name ?? 'untitled'),
    createdAt: m.createdAt ?? null,
    updatedAt: m.updatedAt ?? null,
    revision: Number.isFinite(Number(m.revision)) ? Number(m.revision) : 0,
    tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
  };
}

export function isGraphDocumentShape(value) {
  return Boolean(
    value
    && Number(value.schema_version) >= 1
    && value.nodes
    && value.edges
    && !Array.isArray(value.nodes)
    && !Array.isArray(value.edges),
  );
}
