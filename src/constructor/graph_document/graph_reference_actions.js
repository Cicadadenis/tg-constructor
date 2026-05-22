/**
 * Smart graph actions — create handlers, link branches from references.
 */

import { createOperation, applyOperation } from './graph_operations.js';

function uid(prefix = 'n') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(2, 6)}`;
}
import { createGraphDocument } from './graph_document.js';
import { bindingPatchFromReference } from './graph_reference_bindings.js';
import { repairBrokenCallbacksInDocument } from './graph_callback_repair.js';
import { generateCallbackId } from './graph_keyboard_nodes.js';

/**
 * Create «При нажатии» handler for an inline/reply reference near the source button owner.
 * @param {object} document
 * @param {import('./graph_reference_registry.js').GraphReference} ref
 * @param {{ blockTypes?: ReadonlyArray }} [options]
 * @returns {{ document: object, handlerNodeId: string|null, operations: object[] }}
 */
export function createCallbackHandlerForReference(document, ref, options = {}) {
  const compileValue = String(ref?.compileValue || '').trim()
    || generateCallbackId(ref?.displayLabel || 'button');
  if (!compileValue) {
    return { document: createGraphDocument(document), handlerNodeId: null, operations: [], modified: false };
  }
  const refWithValue = { ...ref, compileValue };

  const doc = createGraphDocument(document);
  const owner = doc.nodes[ref.ownerNodeId];
  const baseX = Number(owner?.position?.x ?? 120) + 220;
  const baseY = Number(owner?.position?.y ?? 120);
  const handlerNodeId = uid('cb');
  const messageNodeId = uid('msg');

  const patch = bindingPatchFromReference(ref);
  let next = doc;
  const operations = [];

  const addOp = (type, payload) => {
    const op = createOperation(type, payload);
    const result = applyOperation(next, op);
    if (result.ok) {
      next = result.document;
      operations.push(op);
      return true;
    }
    return false;
  };

  addOp('AddNode', {
    nodeId: handlerNodeId,
    type: 'callback',
    position: { x: baseX, y: baseY },
    data: { label: refWithValue.displayLabel || '', ...patch },
    meta: { graphRefId: refWithValue.id },
  });

  addOp('AddNode', {
    nodeId: messageNodeId,
    type: 'message',
    position: { x: baseX, y: baseY + 112 },
    data: { text: `Вы нажали: ${refWithValue.displayLabel}` },
  });

  if (owner) {
    addOp('AddEdge', {
      edgeId: uid('edge'),
      source: handlerNodeId,
      target: messageNodeId,
      sourcePort: 'flow',
      targetPort: 'flow',
    });
  }

  const repaired = repairBrokenCallbacksInDocument(next);
  return {
    document: repaired.document,
    handlerNodeId,
    messageNodeId,
    operations: [...operations, ...(repaired.operations || [])],
    modified: operations.length > 0 || repaired.modified,
  };
}
