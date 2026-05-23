/**
 * @deprecated Legacy shim — use graph_ui_orchestrator.js. Re-exports only.
 */

export {
  STACK_BLOCK_SPACING,
  blockPositionInStack,
  findStack,
  blockToNodePayload,
  compositionOp,
  validateCompositionOperations,
  compileMoveStack,
  compileAddBlockToStack,
  compileAddNewStack,
  compileAppendStacks,
  compileMergeStacks,
  compileClearGraph,
  compileUpdateNodeData,
  compileRemoveNode,
  UI_COMPOSITION_COMPILE_FNS,
} from './graph_ui_compositions.js';

export {
  ORCHESTRATOR_LAYER,
  moveStack,
  addBlockToStack,
  addNewStack,
  appendStacks,
  mergeStacks,
  clearGraph,
  updateBlockUiAttachments,
  applyComposition,
  dispatchOp,
  GraphOperations,
  removeNode,
  patchNodeData,
  setNodeData,
  moveNode,
  addNode,
  addEdge,
} from './graph_ui_orchestrator.js';
