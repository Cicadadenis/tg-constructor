/**
 * Runtime mutation client — RUNTIME CLIENT LAYER ONLY.
 * Accepts pre-validated composition IR via applyComposition; no compiler imports.
 */

import { GRAPH_OPERATION_TYPES } from './graph_schema.js';
import {
  RUNTIME_CLIENT_LAYER,
  STRICT_VM_SEMANTICS_MODE,
  validateCompiledComposition,
  validateStrictDispatch,
} from './graph_compiler_vm_contract.js';

export { RUNTIME_CLIENT_LAYER, STRICT_VM_SEMANTICS_MODE } from './graph_compiler_vm_contract.js';

export function dispatchOp(graph, type, payload) {
  const gate = validateStrictDispatch(type, payload);
  if (!gate.ok) {
    console.warn('[graph_operation_client] validateStrictDispatch failed', { type, payload, error: gate.error });
    return { ok: false, error: gate.error };
  }
  return graph.dispatch(gate.type, gate.payload);
}

/**
 * Apply pre-validated composition IR — strict schema gate before any dispatch.
 * @param {{ ok: boolean, operations?: ReadonlyArray, error?: string }} compiled
 */
export function applyComposition(graph, compiled) {
  const validated = validateCompiledComposition(compiled);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }
  let last = { ok: true };
  for (const op of validated.operations) {
    last = dispatchOp(graph, op.type, op.payload);
    if (!last?.ok) return last;
  }
  return last;
}

/** Direct dispatch of validated canonical ops (equivalent to applyComposition). */
export function dispatchValidatedOperations(graph, operations) {
  return applyComposition(graph, { ok: true, operations });
}

function singleOpComposition(type, payload) {
  return { ok: true, operations: [{ type, payload }] };
}

/** Primitive runtime surface — GraphOperations VM entry points. */
export function removeNode(graph, nodeId) {
  return applyComposition(graph, singleOpComposition('RemoveNode', { nodeId }));
}

export function patchNodeData(graph, nodeId, patch) {
  return dispatchOp(graph, 'UpdateNodeData', { nodeId, patch });
}

export function setNodeData(graph, nodeId, data, meta) {
  return dispatchOp(graph, 'UpdateNodeData', { nodeId, data, meta });
}

export function moveNode(graph, nodeId, position) {
  return dispatchOp(graph, 'MoveNode', { nodeId, position });
}

export function addNode(graph, payload) {
  return dispatchOp(graph, 'AddNode', payload);
}

export function addEdge(graph, payload) {
  return dispatchOp(graph, 'AddEdge', payload);
}

export const GraphOperations = {
  TYPES: GRAPH_OPERATION_TYPES,
  LAYER: RUNTIME_CLIENT_LAYER,
  STRICT: STRICT_VM_SEMANTICS_MODE,
  dispatch: dispatchOp,
  applyComposition,
  dispatchValidatedOperations,
  removeNode,
  patchNodeData,
  setNodeData,
  moveNode,
  addNode,
  addEdge,
};
