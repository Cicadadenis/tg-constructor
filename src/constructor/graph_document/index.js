/**
 * GraphDocument model — canonical constructor graph + operation-based editing.
 */

export {
  GRAPH_DOCUMENT_SCHEMA_VERSION,
  GRAPH_OPERATION_TYPES,
  isGraphDocumentShape,
} from './graph_schema.js';

export {
  createGraphDocument,
  cloneGraphDocument,
  isGraphDocument,
  withGraphDocumentRevision,
} from './graph_document.js';

export {
  createOperation,
  applyOperation,
  applyOperationWithRestores,
} from './graph_operations.js';

export {
  createGraphHistory,
  applyOperation as applyHistoryOperation,
  rollbackOperation,
  redoOperation,
  replayOperations,
  mergeOperationStreams,
  exportOperationStream,
} from './graph_history.js';

export {
  exportGraphDocument,
  importGraphDocument,
  migrateSchema,
  GRAPH_DOCUMENT_MIGRATIONS,
} from './graph_serializer.js';

export {
  GraphDocumentValidator,
  validateGraphDocument,
} from './graph_validator.js';

export {
  projectGraphDocumentToCanvas,
  canvasEventToOperation,
} from './graph_projection.js';

export {
  FORBIDDEN_MUTATION_PATTERNS,
  scanSourceForForbiddenGraphMutations,
  assertNoDirectGraphMutation,
  assertNoCanvasOwnedGraphState,
  markCanvasProjection,
} from './graph_mutation_guard.js';

export { GraphEditorStore, createGraphEditorStore } from './graph_editor_store.js';

/**
 * @internal Stack import utilities — used by validation pipeline and AI import only.
 * Not part of UI rendering path (UI uses direct GraphDocument → ReactFlow projection).
 */
export {
  stacksToGraphDocument,
  graphDocumentToStacks,
} from './stacks_bridge.js';
export {
  migrateUiAttachmentsToKeyboardNodes,
  validateReplyChain,
  collectKeyboardButtonDiagnostics,
  findKeyboardNodeForOwner,
  generateCallbackId,
} from './graph_keyboard_nodes.js';
export {
  ensureKeyboardNodeForOwner,
  addInlineButtonToOwner,
  addReplyButtonToOwner,
} from './graph_keyboard_operations.js';
export {
  projectGraphToGraphDocument,
  graphDocumentToProjectGraph,
  resolveCanvasBlockType,
  resolveCanvasBlockProps,
} from './graph_project_bridge.js';
export { graphDocumentToGraphIR } from './graph_ir_bridge.js';
export { loadPersistedCanvasBlob, persistCanvasBlob } from './persist_bridge.js';
export { validateGraph } from './validate_graph.js';
export {
  validateGraphDocumentForEditor,
  collectEditorCallbackDiagnostics,
} from './graph_validate.js';
export {
  runGraphValidationPipeline,
  strictCompileValidation,
  formatDiagnosticsReport,
  VALIDATION_STAGES,
} from './graph_validation_pipeline.js';
export {
  repairDanglingEdges,
  listDanglingEdges,
  graphHasDanglingEdges,
  markDanglingEdgesInMap,
} from './graph_edge_repair.js';
export {
  auditGraphCorruption,
  sanitizeGraphSeed,
  purgeInvalidEdgesFromDocument,
  compilePurgeInvalidEdges,
  buildEmptyGraphDocument,
} from './graph_state_repair.js';
export {
  buildGraphReferenceIndex,
  listCallbackButtonRefs,
  getRefsByCategories,
  resolveCallbackBindingRef,
  REF_CATEGORY,
} from './graph_reference_registry.js';
export {
  bindingPatchFromReference,
  GRAPH_REF_ID_KEY,
  collectCallbackBindingSyncPatches,
} from './graph_reference_bindings.js';
export { createCallbackHandlerForReference } from './graph_reference_actions.js';
export {
  repairBrokenCallbacksInDocument,
  repairBrokenCallbacks,
} from './graph_callback_repair.js';
export {
  repairGraphIssues,
  getRepairCapabilities,
  suggestRepairStrategy,
  REPAIR_ACTION_REGISTRY,
  MANUAL_REPAIR_STRATEGIES,
} from './graph_auto_repair.js';
export {
  beginRepairTransaction,
  commitRepairTransaction,
  rollbackRepair,
  dryRunRepairOperations,
} from './graph_repair_transaction.js';
export {
  repairDuplicateEdges,
  repairSelfLoopEdges,
  repairInvalidConnectionEdges,
} from './graph_edge_repair.js';
export { logGraphTelemetry, subscribeGraphTelemetry } from './graph_telemetry.js';
export { validateCompositionEdge, stacksToValidationDocument } from './graph_composition_validate.js';
export { mergeAndValidateOperationStreams } from './graph_history.js';
export {
  runGraphStructuralAudit,
  validateGraphConnections,
  validateNodeCompatibility,
  validateRequiredHandlers,
  detectOrphanNodes,
  detectUnreachableChains,
  detectBrokenCallbacks,
  validateConnectionRequest,
  auditPreHydrationEdges,
} from './graph_structural_audit.js';
export {
  GraphDocumentRecordSchema,
  GraphDocumentExportSchema,
  GraphOperationSchema,
  NormalizedAstNodeSchema,
  CodegenSnapshotSchema,
  validateGraphDocumentContract,
  validateGraphExportContract,
  validateGraphOperationContract,
  validateAstContract,
  validateCodegenContract,
} from './contracts.js';
export {
  documentToBootstrapOperations,
} from './graph_import.js';
export {
  migrateGraphDocument,
  replayBootstrapOperations,
} from './graph_migration.js';
export { importGraphFragment, importComposedGraph } from './graph_fragment_import.js';
export {
  beginNodeEdit,
  beginKeyboardInsertion,
  commitKeyboardInsertion,
  rollbackKeyboardInsertion,
  endNodeEdit,
  markDraftField,
  commitNodeEdit,
  isGraphInEditMode,
  isNodeInEditMode,
  isKeyboardInsertionActive,
  isCallbackValidationDeferred,
  resolveSessionValidationStage,
  VALIDATION_STAGE,
} from './graph_edit_session.js';
export {
  filterErrorsForStage,
  filterBlockingOverlayErrors,
  extractCallbackHints,
  resolveValidationStage,
  shouldShowCompileOverlay,
  shouldAbortCompile,
  softenDiagnosticsForStage,
} from './validation_stages.js';
export { projectionNodesSignature } from './projection_signature.js';
export { repairCallbackHandlersInStacks } from './repair_callback_handlers.js';
export {
  applyComposition,
  GraphOperations,
  dispatchOp,
  dispatchValidatedOperations,
} from './graph_operation_client.js';
export {
  ORCHESTRATOR_LAYER,
  appendStacks,
  addBlockToStack,
  addNewStack,
  clearGraph,
  resetCorruptedGraphState,
  mergeStacks,
  moveStack,
  patchNodeData,
  removeNode,
  updateBlockUiAttachments,
  addNode,
  addEdge,
  moveNode,
  setNodeData,
} from './graph_ui_orchestrator.js';
export {
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
  GRAPH_UI_OPERATION_METADATA,
} from './graph_ui_compositions.js';
export {
  GRAPH_UI_NODE_METADATA,
  listGraphUiNodeCatalogRows,
  getGraphUiNodeMetadata,
} from './graph_ui_node_metadata.js';
export {
  createPaletteEntryV2,
  getPaletteEntryDisplay,
  isPaletteEntryDraggable,
  isPaletteInteractionDraggable,
  paletteSidebarSectionOrder,
  validatePaletteEntryV2,
} from './palette_core.js';
export {
  EVENT_TRIGGER_PALETTE_IDS,
  EVENT_ACTION_PALETTE_IDS,
  LEGACY_EVENT_STRING_RULES,
  warnLegacyEventDsl,
  matchLegacyEventStringRule,
  normalizeInboundEvent,
  paletteEntryIdForInboundEvent,
  resolveEventToPaletteEntry,
  resolvePaletteEntryById,
  resolveStickerActionEntry,
  buildTelegramUpdateFromInboundEvent,
  applyPaletteEntryViaComposition,
  applyInboundEventViaPalette,
} from './palette_event_resolver.js';
export {
  buildLocalizedBlockCatalog,
  buildDefaultPropsMap,
  buildCatalogFromPalette,
  resolveBuilderCatalog,
  findPaletteEntryForBlockType,
  getBlockDef,
  getPaletteBlockTypes,
  CAN_STACK_BELOW,
} from '../block_catalog.js';
export {
  buildGraphUiPalette,
  getPaletteEntry,
  compilePaletteAction,
  GRAPH_PALETTE_CATEGORY_ORDER,
  PALETTE_TOOLS_CATEGORIES,
  PALETTE_NODE_CATEGORIES,
  PALETTE_SIDEBAR_CATEGORY_ORDER,
  PALETTE_SIDEBAR_CATEGORY_IDS,
  PALETTE_MAIN_EXTRA_SECTION,
  PALETTE_CATEGORY_FALLBACK,
  CATEGORY_MAP,
  normalizePaletteCategory,
  resolvePaletteCategory,
  buildPaletteDebugInfo,
  isPaletteDebugEnabled,
  logPaletteDebugEntry,
  paletteEntryDedupeKey,
  groupPaletteForSidebar,
  assertPaletteContract,
  assertPaletteFlowOrder,
  assertPaletteIntegrity,
} from './graph_ui_palette.js';
export {
  scanSourceForHiddenCompositionDSL,
  scanLayerDependencyViolations,
  isCompositionGuardAllowlisted,
  scanCompilerLayerSource,
  scanRuntimeClientSource,
  scanVmLayerSource,
} from './graph_composition_guard.js';
export {
  COMPILER_LAYER,
  RUNTIME_CLIENT_LAYER,
  VM_LAYER,
  STRICT_VM_SEMANTICS_MODE,
  validateCompositionOperationPayload,
  validateCompiledComposition,
  validateStrictDispatch,
  analyzeLayerDependencyGraph,
} from './graph_compiler_vm_contract.js';
export { useGraphEditor, useGraphEditorStore } from './useGraphEditor.js';
export {
  PORT_DIRECTIONS,
  PORT_KINDS,
  canConnect,
  describeAllowedConnections,
  getNodePortDescriptors,
  getOperationContract,
  listOperationContracts,
  validateConnection,
  validateGraph as validateGraphSemantics,
  validateNodeProps,
} from './operation_registry.js';
