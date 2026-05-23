/**
 * Apply / sync graph reference bindings on nodes (smart refs, not raw UX strings).
 */

import { graphResolveNodeType } from '../../app/graph/graphHelpers.js';
import { REF_CATEGORY } from './graph_reference_registry.js';

const GRAPH_REF_ID_KEY = '_graphRefId';

/**
 * Patch to apply on callback «При нажатии» node data from a graph reference.
 * @param {import('./graph_reference_registry.js').GraphReference} ref
 */
export function bindingPatchFromReference(ref) {
  if (!ref) return {};
  const patch = { [GRAPH_REF_ID_KEY]: ref.id };
  switch (ref.category) {
    case REF_CATEGORY.CALLBACK_REPLY:
      return { ...patch, label: ref.compileValue, data: '', callbackPrefix: '' };
    case REF_CATEGORY.COMMAND:
      return { ...patch, data: ref.compileValue, label: '', callbackPrefix: '' };
    case REF_CATEGORY.CALLBACK_PREFIX:
      return { ...patch, callbackPrefix: ref.compileValue, data: '', label: '' };
    case REF_CATEGORY.CALLBACK_INLINE:
    default:
      return { ...patch, data: ref.compileValue, label: '', callbackPrefix: '' };
  }
}

/**
 * @param {import('./graph_reference_registry.js').GraphReference} ref
 * @param {object} props
 */
export function propsMatchReference(ref, props = {}) {
  if (!ref) return false;
  const patch = bindingPatchFromReference(ref);
  if (String(props[GRAPH_REF_ID_KEY] || '') === ref.id) return true;
  if (ref.bindField === 'label') return String(props.label || '').trim() === ref.compileValue;
  if (ref.bindField === 'prefix') return String(props.callbackPrefix || '').trim() === ref.compileValue;
  return String(props.data || '').trim() === ref.compileValue;
}

/**
 * Sync callback handler nodes when a referenced button's compile value changed.
 * @param {object} document
 * @param {ReturnType<import('./graph_reference_registry.js').buildGraphReferenceIndex>} index
 * @returns {{ nodeId: string, patch: object }[]}
 */
export function collectCallbackBindingSyncPatches(document, index) {
  const updates = [];
  for (const node of Object.values(document?.nodes || {})) {
    if (graphResolveNodeType(node) !== 'callback') continue;
    const props = node.data || {};
    const refId = String(props[GRAPH_REF_ID_KEY] || node.meta?.graphRefId || '').trim();
    if (!refId) continue;
    const ref = index?.byId?.get(refId);
    if (!ref) {
      updates.push({
        nodeId: node.id,
        patch: { [GRAPH_REF_ID_KEY]: '', _bindingBroken: true },
      });
      continue;
    }
    const patch = bindingPatchFromReference(ref);
    const needs = Object.keys(patch).some((k) => String(props[k] || '') !== String(patch[k] || ''));
    if (needs) updates.push({ nodeId: node.id, patch });
  }
  return updates;
}

export { GRAPH_REF_ID_KEY };
