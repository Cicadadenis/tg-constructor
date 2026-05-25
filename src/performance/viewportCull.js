/**
 * Viewport culling helpers — reduce work for edges outside visible bounds.
 */

/**
 * @param {{ x: number, y: number, zoom: number }} viewport
 * @param {{ width: number, height: number }} size
 * @param {number} [padding=240]
 */
export function getVisibleFlowBounds(viewport, size, padding = 240) {
  const z = Math.max(viewport.zoom, 0.08);
  const minX = (-viewport.x - padding) / z;
  const minY = (-viewport.y - padding) / z;
  const maxX = (-viewport.x + size.width + padding) / z;
  const maxY = (-viewport.y + size.height + padding) / z;
  return { minX, minY, maxX, maxY };
}

/**
 * @param {{ position?: { x: number, y: number }, width?: number, height?: number }} node
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 */
export function nodeIntersectsBounds(node, bounds) {
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;
  const w = node.width ?? 280;
  const h = node.height ?? 120;
  return x + w >= bounds.minX && x <= bounds.maxX && y + h >= bounds.minY && y <= bounds.maxY;
}

/**
 * Mark nodes outside viewport for lazy render (still in RF graph for edges).
 * @param {import('@xyflow/react').Node[]} nodes
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 */
export function applyLazyRenderFlags(nodes, bounds, zoomTier = 'full') {
  return nodes.map((n) => {
    const visible = nodeIntersectsBounds(n, bounds);
    const lazyRender = !visible;
    if (
      n.data?.lazyRender === lazyRender
      && n.data?.inViewport === visible
      && n.data?.zoomTier === zoomTier
    ) return n;
    return {
      ...n,
      data: {
        ...n.data,
        lazyRender,
        inViewport: visible,
        zoomTier,
      },
    };
  });
}
