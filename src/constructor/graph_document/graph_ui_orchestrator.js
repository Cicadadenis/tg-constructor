/**
 * UI orchestrator — wires compiler output into runtime client (only layer that imports both).
 */

import { ORCHESTRATOR_LAYER } from './graph_compiler_vm_contract.js';
import { applyComposition } from './graph_operation_client.js';
import { buildEmptyGraphDocument } from './graph_state_repair.js';
import { compilePurgeInvalidEdges } from './graph_state_repair.js';
import {
  compileMoveStack,
  compileAddBlockToStack,
  compileAddNewStack,
  compileAppendStacks,
  compileMergeStacks,
  compileClearGraph,
  compileUpdateNodeData,
} from './graph_ui_compositions.js';

export { ORCHESTRATOR_LAYER };

export function moveStack(graph, stacks, stackId, x, y) {
  return applyComposition(graph, compileMoveStack(stacks, stackId, x, y));
}

export function addBlockToStack(graph, stacks, stackId, block) {
  return applyComposition(graph, compileAddBlockToStack(stacks, stackId, block));
}

export function addNewStack(graph, x, y, block) {
  return applyComposition(graph, compileAddNewStack(x, y, block));
}

const STACK_PLACEMENT_GAP_X = 280;
const STACK_PLACEMENT_BASE = 120;

/** Spread incoming stacks so AI/import does not pile every block at (120,120). */
function placeIncomingStacks(graph, incomingStacks) {
  const existing = Object.values(graph.getGraphDocument().nodes || {});
  let cursorX = STACK_PLACEMENT_BASE;
  if (existing.length) {
    const maxX = existing.reduce((m, n) => Math.max(m, Number(n.position?.x) || 0), 0);
    cursorX = maxX + STACK_PLACEMENT_GAP_X;
  }
  return (incomingStacks || []).map((stack, index) => {
    const hasXY = Number.isFinite(Number(stack?.x)) && Number.isFinite(Number(stack?.y));
    if (hasXY) return stack;
    return {
      ...stack,
      x: cursorX + index * STACK_PLACEMENT_GAP_X,
      y: STACK_PLACEMENT_BASE,
    };
  });
}

export function appendStacks(graph, _stacks, incomingStacks) {
  const placed = placeIncomingStacks(graph, incomingStacks);
  return applyComposition(graph, compileAppendStacks(placed));
}

export function mergeStacks(graph, stacks, dragStackId, targetStackId) {
  const doc = graph.getGraphDocument();
  const existingEdgeIds = new Set(Object.keys(doc?.edges || {}));
  return applyComposition(
    graph,
    compileMergeStacks(stacks, dragStackId, targetStackId, { existingEdgeIds }),
  );
}

export function clearGraph(graph) {
  const doc = graph.getGraphDocument();
  const nodeIds = Object.keys(doc?.nodes || {});
  const ops = compileClearGraph(nodeIds);
  if (!ops.ok) return ops;
  const purge = compilePurgeInvalidEdges(doc);
  const operations = [...(ops.operations || []), ...(purge.ok ? purge.operations || [] : [])];
  return applyComposition(graph, { ok: true, operations });
}

/**
 * Hard reset: empty GraphDocument, no undo history, no invalid edges.
 * @param {object} graph — editor API (must expose resetGraphDocument)
 */
export function resetCorruptedGraphState(graph) {
  if (typeof graph.resetGraphDocument === 'function') {
    return graph.resetGraphDocument(buildEmptyGraphDocument());
  }
  const cleared = clearGraph(graph);
  if (!cleared?.ok) return cleared;
  const purge = applyComposition(graph, compilePurgeInvalidEdges(graph.getGraphDocument()));
  return purge?.ok ? purge : cleared;
}

export function updateBlockUiAttachments(graph, nodeId, updater) {
  const node = graph.getGraphDocument().nodes[nodeId];
  if (!node) return { ok: false };
  const prev = node.meta?.uiAttachments || {};
  const next = typeof updater === 'function' ? updater({ ...prev }) : updater;
  return applyComposition(
    graph,
    compileUpdateNodeData(nodeId, { ...node.data }, { uiAttachments: next }),
  );
}

export {
  applyComposition,
  dispatchOp,
  dispatchValidatedOperations,
  GraphOperations,
  removeNode,
  patchNodeData,
  setNodeData,
  moveNode,
  addNode,
  addEdge,
} from './graph_operation_client.js';
