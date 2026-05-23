/**
 * Cicada Studio — app domain modules.
 *
 * Architecture invariant: GraphDocument is the ONLY source of truth.
 * All rendering goes through: GraphDocument → canvasProjection → ReactFlow.
 * No stack-based intermediate models in the UI layer.
 *
 * Domain modules:
 *   graph/       — graph-native helper functions (node lookups, validation)
 *   canvas/      — ReactFlow canvas renderer
 *   hydration/   — document loading, migration, viewport fitting
 *   examples/    — example graph loading
 *   viewport/    — viewport fit utilities
 *   palette/     — block palette, drag-drop to canvas
 *   autosave/    — localStorage persistence
 *   validation/  — UI validation hooks
 *   codegen/     — codegen snapshot bridge
 *   state/       — graph state entry points (useGraphEditor, operations)
 */

export * from './graph/graphHelpers.js';
export * from './canvas/index.js';
export * from './hydration/graphHydration.js';
export * from './viewport/viewportUtils.js';
export * from './autosave/canvasStorage.js';
export * from './state/graphState.js';
