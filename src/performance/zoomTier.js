/**
 * Level-of-detail tiers for lazy node rendering during zoom/pan.
 */

/** @typedef {'full' | 'compact' | 'minimal'} ZoomTier */

/**
 * @param {number} zoom
 * @returns {ZoomTier}
 */
export function zoomToTier(zoom) {
  const z = Number(zoom) || 1;
  if (z < 0.35) return 'minimal';
  if (z < 0.65) return 'compact';
  return 'full';
}

/**
 * @param {ZoomTier} tier
 */
export function tierAllowsMotion(tier) {
  return tier === 'full';
}

/**
 * @param {ZoomTier} tier
 */
export function tierAllowsRichPreview(tier) {
  return tier !== 'minimal';
}
