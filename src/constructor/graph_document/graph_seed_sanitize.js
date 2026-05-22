/**
 * Pre-hydration seed cleanup — breaks circular imports with graph_document.
 */

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

/**
 * Drop broken edges and ghost selection before createGraphDocument.
 * @param {object} seed
 */
export function sanitizeGraphSeed(seed = {}) {
  const nodes = {};
  for (const raw of asArray(seed.nodes)) {
    if (raw?.id) nodes[String(raw.id)] = raw;
  }
  const nodeIds = new Set(Object.keys(nodes));
  const droppedEdges = [];
  const keptEdges = [];

  for (const raw of asArray(seed.edges)) {
    const source = String(raw?.source ?? raw?.from ?? '').trim();
    const target = String(raw?.target ?? raw?.to ?? '').trim();
    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) {
      droppedEdges.push({
        id: raw?.id,
        source,
        target,
        invalidReason: raw?.invalidReason || 'dropped_on_sanitize',
      });
      continue;
    }
    const { invalid, invalidReason, ...clean } = raw;
    keptEdges.push(clean);
  }

  const meta = { ...(seed.metadata || {}) };
  if (droppedEdges.length) {
    meta.hydrationDiagnostics = {
      orphanEdgeCount: droppedEdges.length,
      orphanEdges: droppedEdges,
      at: new Date().toISOString(),
      sanitized: true,
    };
  } else {
    meta.hydrationDiagnostics = null;
  }

  const ui = seed.ui_state ?? seed.ui ?? {};
  const selection = (ui.selection || []).filter((id) => nodeIds.has(String(id)));

  return {
    ...seed,
    nodes: Object.values(nodes),
    edges: keptEdges,
    metadata: meta,
    ui_state: { ...ui, selection },
  };
}
