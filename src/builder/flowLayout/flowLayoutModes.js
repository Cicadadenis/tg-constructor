/**
 * Deterministic flow builder layout modes and spacing grid.
 */

/** @typedef {'AUTO' | 'COMPACT' | 'EXPANDED'} FlowLayoutMode */

export const FLOW_LAYOUT_MODES = Object.freeze(['AUTO', 'COMPACT', 'EXPANDED']);

export const DEFAULT_FLOW_LAYOUT_MODE = 'AUTO';

const LAYOUT_MODE_SET = new Set(FLOW_LAYOUT_MODES);

/**
 * @param {string} [value]
 * @returns {FlowLayoutMode}
 */
export function normalizeFlowLayoutMode(value) {
  const key = String(value || DEFAULT_FLOW_LAYOUT_MODE).toUpperCase();
  return LAYOUT_MODE_SET.has(key) ? /** @type {FlowLayoutMode} */ (key) : DEFAULT_FLOW_LAYOUT_MODE;
}

/**
 * @param {FlowLayoutMode} mode
 */
export function getFlowLayoutSpacing(mode) {
  const m = normalizeFlowLayoutMode(mode);
  switch (m) {
    case 'COMPACT':
      return {
        originX: 96,
        originY: 64,
        rowGapY: 12,
        branchGapX: 24,
        rootGapX: 40,
      };
    case 'EXPANDED':
      return {
        originX: 160,
        originY: 120,
        rowGapY: 40,
        branchGapX: 56,
        rootGapX: 88,
      };
    case 'AUTO':
    default:
      return {
        originX: 120,
        originY: 80,
        rowGapY: 24,
        branchGapX: 32,
        rootGapX: 56,
      };
  }
}

/**
 * @param {object} [metadata]
 * @returns {FlowLayoutMode}
 */
export function readLayoutModeFromMetadata(metadata) {
  return normalizeFlowLayoutMode(metadata?.layoutMode);
}
