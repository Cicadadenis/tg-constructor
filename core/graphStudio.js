/**
 * Graph studio exports (IR, validation, manifests) — no DSL runtime.
 */
export {
  parseIfConditionFromDsl,
  negateConditionForDsl,
  balanceConditionParens,
  isConditionLikeType,
} from './dslCondition.js';

export { normalizeFlowNode } from './ir/normalizeFlowNode.js';
export { validateProjectIr, validateProjectIrStrict } from './ir/validateProjectIr.js';
export {
  assertCompilableFlow,
  IR_BUILD_COMPILE_STRICT,
  IR_BUILD_DEFAULTS,
  irBuildOptionsFromValidateMode,
} from './ir/compileGate.js';
export { migrateFlowToIrV2 } from './ir/migrateFlowToIrV2.js';
export { CompilationError } from './ir/CompilationError.js';
export { buildProjectIrV2, irNodeDslEmitName, getCompilerId } from './ir/buildProjectIrV2.js';
export { validateIrV2 } from './ir/validateIrV2.js';
export { IR_SCHEMA_VERSION_V1, IR_SCHEMA_VERSION_V2, IR_SCHEMA_VERSION_DEFAULT } from './ir/irSchema.js';
export { IR_NODE_REGISTRY } from './ir/nodeTypeRegistry.js';

export { validateFlow } from './graph/flowValidate.js';
export {
  SCHEMA_VERSIONS_FOR_UI,
  buildProjectManifestDraft,
  buildProjectManifestDraftFromStacks,
  buildProjectGraphDocumentFromFlow,
  buildProjectGraphDocumentFromFlowAsync,
  buildProjectGraphDocumentFromStacks,
  buildProjectGraphDocumentFromStacksAsync,
} from './graph/projectDocument.js';
export {
  inferRequiredFeaturesFromFlow,
  inferRequiredFeaturesFromStacks,
} from './graph/features.js';

export { canRenderUi } from './capabilityEngine.js';

export * from './codegen/index.js';
