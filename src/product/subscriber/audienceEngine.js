/**
 * Client audience helpers — expression builders for segment filters (UI).
 * Server evaluation uses core/product/subscriber/audienceEngine.ts
 */

/** @typedef {{ op: string, [key: string]: unknown }} SegmentFilter */

export const AudienceExpressions = Object.freeze({
  hasTag: (tag) => `tag:${tag}`,
  missingTag: (tag) => `!tag:${tag}`,
  fieldEq: (field, value) => `field:${field}=${value}`,
  inSegment: (segmentId) => `segment:${segmentId}`,
  event: (type) => `event:${type}`,
});

/**
 * @param {string} expression
 * @returns {SegmentFilter|null}
 */
export function parseAudienceExpression(expression) {
  const raw = String(expression || '').trim();
  if (!raw) return null;

  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (raw.startsWith('tag:')) {
    const tag = raw.slice(4).trim();
    return tag.startsWith('!') || tag.startsWith('not:')
      ? { op: 'missingTag', tag: tag.replace(/^!|^not:/, '').trim() }
      : { op: 'hasTag', tag };
  }

  if (raw.startsWith('field:')) {
    const rest = raw.slice(6);
    const eq = rest.indexOf('=');
    if (eq < 0) return null;
    return {
      op: 'fieldEq',
      field: rest.slice(0, eq).trim(),
      value: rest.slice(eq + 1).trim(),
    };
  }

  if (raw.startsWith('segment:')) {
    return { op: 'inSegment', segmentId: raw.slice(8).trim() };
  }

  return { op: 'dynamicExpr', expression: raw };
}

/**
 * Build a composite AND filter from multiple conditions.
 * @param {SegmentFilter[]} filters
 * @returns {SegmentFilter}
 */
export function andFilters(filters) {
  const items = filters.filter(Boolean);
  if (items.length === 0) return { op: 'and', filters: [] };
  if (items.length === 1) return items[0];
  return { op: 'and', filters: items };
}
