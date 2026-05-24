/**
 * React Flow edge styling for graph canvas projection.
 */

/**
 * Edges whose endpoints are both on the active execution path.
 * @param {object} document
 * @param {Iterable<string>} activeNodeIds
 */
export function resolveExecutionPathEdgeIds(document, activeNodeIds) {
  const active = new Set(activeNodeIds);
  const ids = [];
  for (const edge of Object.values(document?.edges || {})) {
    if (active.has(edge.source) && active.has(edge.target)) {
      ids.push(edge.id);
    }
  }
  return ids;
}

/** @typedef {'repair' | 'execution' | 'compile' | null} HighlightKind */

/**
 * @param {object} edge
 * @param {object} document
 * @param {object} highlight
 * @param {Set<string>} highlight.repairedEdgeIds
 * @param {Set<string>} highlight.executionEdgeIds
 * @param {HighlightKind} highlight.kind
 * @param {boolean} splittable
 * @param {boolean} valid
 */
export function buildCanvasEdgePresentation(edge, document, highlight, splittable, valid) {
  const repairedIds = highlight.repairedEdgeIds || new Set();
  const executionIds = highlight.executionEdgeIds || new Set();
  const isRepair = repairedIds.has(edge.id);
  const isExecution = executionIds.has(edge.id);
  const kind = highlight.kind || null;

  if (isRepair) {
    return {
      type: splittable ? 'flowAdd' : 'flowBezier',
      className: splittable ? 'flow-add-step-edge-rf flow-edge--repair' : 'flow-bezier-edge-rf flow-edge--repair',
      animated: true,
      style: { stroke: 'var(--color-success)', strokeWidth: 2.5 },
      markerEnd: { type: 'arrowclosed', color: 'var(--color-success)', width: 16, height: 16 },
      data: {
        ...(edge.data || {}),
        repairPath: true,
        splittable,
        invalid: false,
      },
    };
  }

  if (isExecution) {
    return {
      type: splittable ? 'flowAdd' : 'flowBezier',
      className: splittable
        ? 'flow-add-step-edge-rf flow-edge--execution'
        : 'flow-bezier-edge-rf flow-edge--execution',
      animated: true,
      style: { stroke: 'var(--color-primary)', strokeWidth: 2.5 },
      markerEnd: { type: 'arrowclosed', color: 'var(--color-primary)', width: 16, height: 16 },
      data: {
        ...(edge.data || {}),
        executionPath: true,
        splittable,
        invalid: false,
      },
    };
  }

  if (!valid) {
    return {
      type: 'flowBezier',
      className: 'flow-bezier-edge-rf',
      animated: false,
      style: { stroke: 'var(--color-danger)', strokeWidth: 1.5, strokeDasharray: '5 4' },
      markerEnd: undefined,
      data: { ...(edge.data || {}), invalid: true, splittable: false },
    };
  }

  if (splittable) {
    return {
      type: 'flowAdd',
      className: 'flow-add-step-edge-rf',
      style: { stroke: 'transparent', strokeWidth: 0 },
      markerEnd: undefined,
      animated: false,
      data: { ...(edge.data || {}), splittable: true, invalid: false },
    };
  }

  return {
    type: 'flowBezier',
    className: 'flow-bezier-edge-rf',
    style: { stroke: 'var(--color-border-strong)', strokeWidth: 1.5 },
    markerEnd: { type: 'arrowclosed', color: 'var(--color-border-strong)', width: 14, height: 14 },
    animated: false,
    data: { ...(edge.data || {}), splittable: false, invalid: false },
  };
}
