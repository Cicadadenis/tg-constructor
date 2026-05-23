/**
 * Legacy adapter — prefer buildGraphReferenceIndex / listCallbackButtonRefs.
 */

import {
  buildGraphReferenceIndex,
  listCallbackButtonRefs,
  REF_CATEGORY,
} from '../constructor/graph_document/graph_reference_registry.js';

export function collectCallbackButtonOptionsFromDocument(document, blockTypes = []) {
  const index = buildGraphReferenceIndex(document, blockTypes);
  return listCallbackButtonRefs(index).map((ref) => ({
    value: ref.compileValue,
    label: ref.ownerLabel ? `${ref.displayLabel} · ${ref.ownerLabel}` : ref.displayLabel,
    kind: ref.category === REF_CATEGORY.CALLBACK_REPLY
      ? 'reply'
      : ref.category === REF_CATEGORY.COMMAND
        ? 'command'
        : 'inline',
    nodeId: ref.ownerNodeId,
    refId: ref.id,
    ref,
  }));
}
