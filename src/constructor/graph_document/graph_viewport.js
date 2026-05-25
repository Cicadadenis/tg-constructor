/**
 * Fit canvas viewport to visible graph nodes.
 */

const STACK_WIDTH = 220;
const BLOCK_H = 112;
const ROOT_PAD = 48;
const NODE_W = 300;
const NODE_H = 160;

/** @param {object} stack */
export function estimateStackHeight(stack) {
  const n = stack?.blocks?.length || 0;
  if (!n) return 80;
  const first = stack.blocks[0]?.type;
  const head = first === 'bot' ? 56 : 40;
  return head + n * BLOCK_H + 24;
}

/**
 * @param {object[]} stacks
 * @param {{ width?: number, height?: number, padding?: number, minZoom?: number, maxZoom?: number }} [opts]
 * @returns {{ x: number, y: number, zoom: number }}
 */
export function computeViewportForStacks(stacks, opts = {}) {
  const padding = opts.padding ?? ROOT_PAD;
  const minZoom = opts.minZoom ?? 0.35;
  const maxZoom = opts.maxZoom ?? 1;
  const vw = opts.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const vh = opts.height ?? (typeof window !== 'undefined' ? window.innerHeight : 700);

  if (!stacks?.length) {
    return { x: padding, y: padding, zoom: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stack of stacks) {
    const x = Number(stack.x) || 0;
    const y = Number(stack.y) || 0;
    const h = estimateStackHeight(stack);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + STACK_WIDTH);
    maxY = Math.max(maxY, y + h);
  }

  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  const availW = Math.max(200, vw - padding * 2);
  const availH = Math.max(200, vh - padding * 2);
  const zoom = Math.min(
    maxZoom,
    Math.max(minZoom, Math.min(availW / contentW, availH / contentH)),
  );
  const x = padding - minX * zoom;
  const y = padding - minY * zoom;

  return { x, y, zoom };
}

/**
 * Compute fit viewport for a list of GraphDocument nodes (position-based).
 * @param {object[]} nodes — array of { position: { x, y } }
 * @param {{ width?: number, height?: number, padding?: number, minZoom?: number, maxZoom?: number }} [opts]
 * @returns {{ x: number, y: number, zoom: number }}
 */
export function computeViewportForNodes(nodes, opts = {}) {
  const padding = opts.padding ?? ROOT_PAD;
  const minZoom = opts.minZoom ?? 0.35;
  const maxZoom = opts.maxZoom ?? 1;
  const vw = opts.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const vh = opts.height ?? (typeof window !== 'undefined' ? window.innerHeight : 700);

  const validNodes = (nodes || []).filter((n) => n?.position);
  if (!validNodes.length) {
    return { x: padding, y: padding, zoom: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of validNodes) {
    const x = Number(node.position?.x) || 0;
    const y = Number(node.position?.y) || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + NODE_W);
    maxY = Math.max(maxY, y + NODE_H);
  }

  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  const availW = Math.max(200, vw - padding * 2);
  const availH = Math.max(200, vh - padding * 2);
  const zoom = Math.min(
    maxZoom,
    Math.max(minZoom, Math.min(availW / contentW, availH / contentH)),
  );
  const x = padding - minX * zoom;
  const y = padding - minY * zoom;

  return { x, y, zoom };
}
