/**
 * Global variable merge for composable graph modules.
 */

/**
 * @param {object} node
 * @returns {{ name: string, value: string }|null}
 */
export function extractGlobalFromNode(node) {
  const type = String(node?.type || '');
  if (type !== 'global' && type !== 'set_global') return null;
  const props = node?.data || {};
  const name = String(props.varname || props.key || '').trim();
  if (!name) return null;
  return { name, value: String(props.value ?? '') };
}

/**
 * @param {Record<string, object>} nodes
 * @returns {Map<string, { value: string, nodeIds: string[] }>}
 */
export function buildGlobalsRegistry(nodes) {
  const registry = new Map();
  for (const node of Object.values(nodes || {})) {
    const g = extractGlobalFromNode(node);
    if (!g) continue;
    const prev = registry.get(g.name) || { value: g.value, nodeIds: [] };
    prev.nodeIds.push(node.id);
    if (!prev.value && g.value) prev.value = g.value;
    registry.set(g.name, prev);
  }
  return registry;
}

/**
 * @param {Record<string, object>} baseNodes
 * @param {Record<string, object>} incomingNodes
 * @param {'first_wins'|'reuse'|'merge'|'warn'} strategy
 * @returns {{ nodes: Record<string, object>, conflicts: object[], fixes: object[] }}
 */
export function mergeGlobals(baseNodes, incomingNodes, strategy = 'first_wins') {
  const baseReg = buildGlobalsRegistry(baseNodes);
  const conflicts = [];
  const fixes = [];
  const dropNodeIds = new Set();

  for (const node of Object.values(incomingNodes || {})) {
    const g = extractGlobalFromNode(node);
    if (!g) continue;
    const existing = baseReg.get(g.name);
    if (!existing) continue;

    if (existing.value && g.value && existing.value !== g.value && strategy !== 'merge') {
      conflicts.push({
        kind: 'global',
        code: 'global_value_conflict',
        message: `Global "${g.name}" already defined (${strategy})`,
        existing: existing.value,
        incoming: g.value,
        nodeId: node.id,
      });
    }

    if (strategy === 'reuse' || strategy === 'first_wins') {
      dropNodeIds.add(node.id);
      fixes.push({
        kind: 'global_dedupe',
        message: `Reused existing global "${g.name}"`,
        from: node.id,
      });
    }
  }

  const nodes = {};
  for (const [id, node] of Object.entries(incomingNodes || {})) {
    if (!dropNodeIds.has(id)) nodes[id] = node;
  }
  return { nodes, conflicts, fixes };
}
