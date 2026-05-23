/**
 * Immutable merge helpers for GraphDocument node.data patches.
 */

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep-merge plain objects; arrays and scalars from patch replace target.
 * @param {object} target
 * @param {object} patch
 * @returns {object}
 */
export function deepMergePlainObjects(target, patch) {
  const base = isPlainObject(target) ? { ...target } : {};
  if (!isPlainObject(patch)) return base;
  const out = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(patchValue)) {
      out[key] = deepMergePlainObjects(existing, patchValue);
    } else {
      out[key] = patchValue;
    }
  }
  return out;
}

/**
 * @param {object} existingData
 * @param {object} [patch]
 * @param {object} [fullData]
 * @returns {object}
 */
export function mergeNodeDataUpdate(existingData, { patch, data } = {}) {
  if (data != null && isPlainObject(data)) {
    return { ...data };
  }
  if (!isPlainObject(patch) || Object.keys(patch).length === 0) {
    return { ...(existingData || {}) };
  }
  return deepMergePlainObjects(existingData || {}, patch);
}
