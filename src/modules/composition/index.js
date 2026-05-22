export { composeModules, previewComposeModules, dedupeHandlersReport } from './module_compose.js';
export { mergeGraphs, mergeGraphFragment, graphSeedToDocument } from './graph_merge.js';
export {
  resolveModuleDependencies,
  validateComposedDocument,
  validateModuleManifest,
  validateModuleCompatibility,
} from './module_validation.js';
export {
  scopeCallback,
  namespaceModuleCallbacks,
  detectCallbackCollisions,
  buildCallbackRegistry,
} from './callback_namespace.js';
export { mergeGlobals, buildGlobalsRegistry } from './globals_merge.js';
