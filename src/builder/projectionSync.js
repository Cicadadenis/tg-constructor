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
    d.visualType,
    d.runtimeType,
    d.previewEpoch,
    d.repairPulse ? 1 : 0,
    d.executionPath ? 1 : 0,
    n.className,
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
    e.className,
    e.data?.executionPath ? 1 : 0,
    e.data?.repairPath ? 1 : 0,
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
 * @param {{ repairIds?: Set<string>, executionIds?: Set<string> }} highlight
 * @param {number | string | undefined} previewEpoch
 */
/**
 * Fast path — selection change only (no structural projection rebuild).
 * @param {import('@xyflow/react').Node[]} current
 * @param {string | null} selectedBlockId
 */
export function mergeSelectionOnNodes(current, selectedBlockId) {
  if (!current?.length) return current;
  let changed = false;
  const next = current.map((n) => {
    const sel = n.id === selectedBlockId;
    if (Boolean(n.selected) === sel) return n;
    changed = true;
    return { ...n, selected: sel };
  });
  return changed ? next : current;
}

export function mergeProjectionNodes(current, projected, selectedBlockId, highlight, previewEpoch) {
  const repairIds = highlight?.repairIds || new Set();
  const executionIds = highlight?.executionIds || new Set();

  const next = projected.map((n) => {
    const classes = (n.className || 'cicada-node flow-node-card-projection').split(/\s+/).filter(Boolean);
    const base = classes.filter((c) => !c.startsWith('flow-node--'));
    if (executionIds.has(n.id)) base.push('flow-node--execution');
    if (repairIds.has(n.id)) base.push('flow-node--repair-pulse');

    return {
      ...n,
      className: [...new Set(base)].join(' '),
      selected: n.id === selectedBlockId,
      style: n.style,
      data: {
        ...n.data,
        previewEpoch,
        repairPulse: repairIds.has(n.id),
        executionPath: executionIds.has(n.id),
      },
    };
  });

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
