/**
 * Graph state — single source of truth entry point.
 * All UI state derives from GraphDocument via getCanvasProjection().
 * No derived stack models, no ad-hoc canvas transformations.
 */

export { useGraphEditor } from '../../constructor/graph_document/useGraphEditor.js';
export {
  addNode,
  addEdge,
  moveNode,
  removeNode,
  patchNodeData,
  setNodeData,
  applyComposition,
  dispatchOp,
} from '../../constructor/graph_document/graph_operation_client.js';
export {
  clearGraph,
  appendStacks,
  updateBlockUiAttachments,
} from '../../constructor/graph_document/graph_ui_orchestrator.js';
