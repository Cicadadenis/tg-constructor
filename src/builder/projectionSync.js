/**
 * Incremental React Flow state sync from GraphDocument projection.
 */

const TYPE_MIRROR_KEYS = new Set(['type', 'blockType', 'canvasBlockType', 'props']);

function nodeVisualKey(n) {
  const d = n?.data || {};
  return [
    n.id,
    n.position?.x,
    n.position?.y,
    n.width,
    n.height,
    n.selected ? 1 : 0,
    d.label,
    d.canvasBlockType,
    d.previewEpoch,
    d.repairPulse ? 1 : 0,
    d.isChainRoot ? 1 : 0,
    JSON.stringify(d.props ?? {}),
  ].join('|');
}

function edgeVisualKey(e) {
  return [
    e.id,
    e.source,
    e.target,
    e.sourceHandle,
    e.targetHandle,
    e.animated ? 1 : 0,
    e.style ? JSON.stringify(e.style) : '',
  ].join('|');
}

/**
 * @param {import('@xyflow/react').Node[]} current
 * @param {import('@xyflow/react').Node[]} next
 */
export function flowNodesNeedUpdate(current, next) {
  if (!current || current.length !== next.length) return true;
  for (let i = 0; i < next.length; i += 1) {
    if (nodeVisualKey(current[i]) !== nodeVisualKey(next[i])) return true;
  }
  return false;
}

/**
 * @param {import('@xyflow/react').Edge[]} current
 * @param {import('@xyflow/react').Edge[]} next
 */
export function flowEdgesNeedUpdate(current, next) {
  if (!current || current.length !== next.length) return true;
  for (let i = 0; i < next.length; i += 1) {
    if (edgeVisualKey(current[i]) !== edgeVisualKey(next[i])) return true;
  }
  return false;
}

/**
 * Build next RF nodes from projection; preserves object refs when unchanged.
 * @param {import('@xyflow/react').Node[]} current
 * @param {import('@xyflow/react').Node[]} projected
 * @param {string | null} selectedBlockId
 * @param {Set<string>} pulseIds
 * @param {number | string | undefined} previewEpoch
 */
export function mergeProjectionNodes(current, projected, selectedBlockId, pulseIds, previewEpoch) {
  const next = projected.map((n) => ({
    ...n,
    selected: n.id === selectedBlockId,
    style: pulseIds.has(n.id)
      ? {
        ...(n.style || {}),
        boxShadow: '0 0 0 2px rgba(62,207,142,0.85), 0 0 24px rgba(62,207,142,0.45)',
        borderRadius: 12,
      }
      : n.style,
    data: {
      ...n.data,
      previewEpoch,
      repairPulse: pulseIds.has(n.id),
    },
  }));

  if (!flowNodesNeedUpdate(current, next)) {
    return current;
  }
  return next;
}

/**
 * @param {import('@xyflow/react').Edge[]} current
 * @param {import('@xyflow/react').Edge[]} next
 */
export function mergeProjectionEdges(current, next) {
  if (!flowEdgesNeedUpdate(current, next)) {
    return current;
  }
  return next;
}

export { TYPE_MIRROR_KEYS };
