/**
 * UI composition compiler — COMPILE LAYER ONLY.
 * Output: [{ type, payload }] validated against GRAPH_OPERATION_TYPES + VM payload rules.
 * MUST NOT: dispatch, applyOperation, read GraphEditorStore, or import VM modules.
 */

import { AIOGRAM3_RUNTIME } from '../../../core/aiogram3Runtime.js';
import { GRAPH_OPERATION_TYPES, normalizeOperationType } from './graph_schema.js';
import {
  COMPILER_LAYER,
  validateCompositionOperations,
  validateCompositionOperationPayload,
} from './graph_compiler_vm_contract.js';
import { validateCompositionEdge } from './graph_composition_validate.js';
import { blockToNodePayload } from './graph_node_payload.js';

export { blockToNodePayload } from './graph_node_payload.js';

export {
  COMPILER_LAYER,
  validateCompositionOperations,
  validateCompositionOperationPayload,
} from './graph_compiler_vm_contract.js';

export const STACK_BLOCK_SPACING = 112;

export function blockPositionInStack(stackX, stackY, blockIndex) {
  return {
    x: stackX,
    y: stackY + blockIndex * STACK_BLOCK_SPACING,
  };
}

export function findStack(stacks, stackId) {
  return stacks?.find((s) => s.id === stackId) || null;
}

/** Frozen canonical op spec — compiler output cell. */
export function compositionOp(type, payload) {
  const canonical = normalizeOperationType(type);
  if (!GRAPH_OPERATION_TYPES.includes(canonical)) {
    throw new Error(`UI composition may not introduce operation type: ${type}`);
  }
  const payloadCheck = validateCompositionOperationPayload(canonical, payload || {});
  if (!payloadCheck.ok) {
    throw new Error(payloadCheck.error);
  }
  return Object.freeze({
    type: canonical,
    payload: Object.freeze({ ...payload }),
  });
}

/** @returns {{ ok: boolean, operations?: ReadonlyArray, error?: string }} */
export function compileMoveStack(stacks, stackId, x, y) {
  const stack = findStack(stacks, stackId);
  if (!stack) return { ok: false, error: 'Unknown stack' };
  const operations = stack.blocks.map((block, index) => compositionOp(
    'MoveNode',
    { nodeId: block.id, position: blockPositionInStack(x, y, index) },
  ));
  return validateCompositionOperations(operations);
}

function pushCompositionEdge(operations, stacks, edgePayload, meta = {}) {
  const gate = validateCompositionEdge(stacks, edgePayload, {
    composeFn: meta.composeFn || 'unknown',
    ...meta,
  });
  if (!gate.ok) {
    return { ok: false, error: gate.reason || 'Invalid programmatic edge' };
  }
  operations.push(compositionOp('AddEdge', edgePayload));
  return { ok: true };
}

/** @returns {{ ok: boolean, operations?: ReadonlyArray, error?: string }} */
export function compileAddBlockToStack(stacks, stackId, block) {
  const stack = findStack(stacks, stackId);
  if (!stack) return { ok: false, error: 'Unknown stack' };
  const index = stack.blocks.length;
  const position = blockPositionInStack(stack.x, stack.y, index);
  const operations = [compositionOp('AddNode', blockToNodePayload(block, position))];
  if (index > 0) {
    const prevId = stack.blocks[index - 1].id;
    const edgeGate = pushCompositionEdge(operations, stacks, {
      edgeId: `edge_${prevId}_${block.id}`,
      source: prevId,
      target: block.id,
    }, { composeFn: 'compileAddBlockToStack' });
    if (!edgeGate.ok) return edgeGate;
  }
  return validateCompositionOperations(operations);
}

/** @returns {{ ok: boolean, operations?: ReadonlyArray }} */
export function compileAddNewStack(x, y, block) {
  return validateCompositionOperations([
    compositionOp('AddNode', blockToNodePayload(block, blockPositionInStack(x, y, 0))),
  ]);
}

/** @returns {{ ok: boolean, operations?: ReadonlyArray }} */
export function compileAppendStacks(incomingStacks) {
  if (!Array.isArray(incomingStacks) || incomingStacks.length === 0) {
    return { ok: true, operations: [] };
  }
  const operations = [];
  for (const stack of incomingStacks) {
    const blocks = stack.blocks || [];
    blocks.forEach((block, index) => {
      const position = blockPositionInStack(stack.x ?? 120, stack.y ?? 120, index);
      operations.push(compositionOp('AddNode', blockToNodePayload(block, position)));
      if (index > 0) {
        const prevId = blocks[index - 1].id;
        const edgeGate = pushCompositionEdge(operations, incomingStacks, {
          edgeId: `edge_${prevId}_${block.id}`,
          source: prevId,
          target: block.id,
        }, { composeFn: 'compileAppendStacks' });
        if (!edgeGate.ok) return edgeGate;
      }
    });
  }
  return validateCompositionOperations(operations);
}

/**
 * @param {Set<string>|string[]} [options.existingEdgeIds]
 */
export function compileMergeStacks(stacks, dragStackId, targetStackId, options = {}) {
  const dragStack = findStack(stacks, dragStackId);
  const targetStack = findStack(stacks, targetStackId);
  if (!dragStack || !targetStack || dragStackId === targetStackId) {
    return { ok: false, error: 'Invalid merge targets' };
  }

  const existing = options.existingEdgeIds instanceof Set
    ? options.existingEdgeIds
    : new Set(options.existingEdgeIds || []);

  const operations = [];
  const targetLast = targetStack.blocks[targetStack.blocks.length - 1];
  const dragFirst = dragStack.blocks[0];
  if (targetLast && dragFirst) {
    const edgeId = `edge_${targetLast.id}_${dragFirst.id}`;
    if (!existing.has(edgeId)) {
      const edgeGate = pushCompositionEdge(operations, stacks, {
        edgeId,
        source: targetLast.id,
        target: dragFirst.id,
      }, { composeFn: 'compileMergeStacks' });
      if (!edgeGate.ok) return edgeGate;
    }
  }

  const targetLen = targetStack.blocks.length;
  dragStack.blocks.forEach((block, i) => {
    operations.push(compositionOp(
      'MoveNode',
      {
        nodeId: block.id,
        position: blockPositionInStack(targetStack.x, targetStack.y, targetLen + i),
      },
    ));
  });
  return validateCompositionOperations(operations);
}

/** @param {string[]} nodeIds */
export function compileClearGraph(nodeIds) {
  const operations = (nodeIds || []).map((nodeId) => compositionOp('RemoveNode', { nodeId }));
  return validateCompositionOperations(operations);
}

export function compileUpdateNodeData(nodeId, data, meta) {
  return validateCompositionOperations([
    compositionOp('UpdateNodeData', { nodeId, data, meta }),
  ]);
}

export function compileRemoveNode(nodeId) {
  return validateCompositionOperations([
    compositionOp('RemoveNode', { nodeId }),
  ]);
}

export const UI_COMPOSITION_COMPILE_FNS = Object.freeze([
  'compileMoveStack',
  'compileAddBlockToStack',
  'compileAddNewStack',
  'compileAppendStacks',
  'compileMergeStacks',
  'compileClearGraph',
  'compileUpdateNodeData',
  'compileRemoveNode',
]);

/**
 * UI metadata for graph operations — single source for graph_ui_palette derivation.
 * Palette visibility and compileFn mapping live here; not in DSL block registries.
 */
export const GRAPH_UI_OPERATION_METADATA = Object.freeze({
  AddNode: Object.freeze({
    runtime: AIOGRAM3_RUNTIME,
    categoryOrder: 7,
    priority: 0,
    showInPalette: true,
    paletteId: 'op-add-node',
    label: Object.freeze({ ru: 'Узел', en: 'Node', uk: 'Вузол' }),
    icon: '⊕',
    color: '#3ecf8e',
    category: 'graph',
    compileFn: 'compileAddNewStack',
    alternateCompileFn: 'compileAddBlockToStack',
    defaultNodeType: 'message',
    interaction: 'drag-drop',
  }),
  RemoveNode: Object.freeze({
    runtime: AIOGRAM3_RUNTIME,
    categoryOrder: 7,
    priority: 1,
    showInPalette: true,
    paletteId: 'op-remove-node',
    label: Object.freeze({ ru: 'Удалить', en: 'Remove', uk: 'Видалити' }),
    icon: '✕',
    color: '#ef4444',
    category: 'graph',
    compileFn: 'compileRemoveNode',
    interaction: 'selection',
  }),
  MoveNode: Object.freeze({
    runtime: AIOGRAM3_RUNTIME,
    categoryOrder: 7,
    priority: 99,
    showInPalette: false,
    interaction: 'drag-canvas',
  }),
  UpdateNodeData: Object.freeze({
    runtime: AIOGRAM3_RUNTIME,
    categoryOrder: 7,
    priority: 2,
    showInPalette: true,
    paletteId: 'op-edit',
    label: Object.freeze({ ru: 'Правка', en: 'Edit', uk: 'Правка' }),
    icon: '✎',
    color: '#60a5fa',
    category: 'data',
    compileFn: 'compileUpdateNodeData',
    interaction: 'selection',
  }),
  AddEdge: Object.freeze({
    runtime: AIOGRAM3_RUNTIME,
    categoryOrder: 7,
    priority: 3,
    showInPalette: true,
    paletteId: 'op-connect',
    label: Object.freeze({ ru: 'Связать', en: 'Connect', uk: "Зв'язати" }),
    icon: '⟷',
    color: '#a78bfa',
    category: 'relations',
    interaction: 'connect',
  }),
  RemoveEdge: Object.freeze({
    runtime: AIOGRAM3_RUNTIME,
    categoryOrder: 7,
    priority: 99,
    showInPalette: false,
    interaction: 'canvas',
  }),
  UpdateEdge: Object.freeze({
    runtime: AIOGRAM3_RUNTIME,
    categoryOrder: 7,
    priority: 99,
    showInPalette: false,
    interaction: 'canvas',
  }),
  UpdateViewport: Object.freeze({
    runtime: AIOGRAM3_RUNTIME,
    categoryOrder: 7,
    priority: 99,
    showInPalette: false,
    interaction: 'canvas',
  }),
  GroupSelection: Object.freeze({
    runtime: AIOGRAM3_RUNTIME,
    categoryOrder: 7,
    priority: 99,
    showInPalette: false,
    interaction: 'canvas',
  }),
});
