export {
  StrictValidationError,
  type StrictValidationIssue,
  type StrictValidationStage,
} from "./strictValidationError.js";

export {
  validateGraph,
  validateBotIR,
  validateCompile,
  assertCompileReady,
  type StrictValidationOptions,
  type StrictValidationResult,
} from "./strictPipeline.js";

export {
  collectRegistryViolations,
  enforceRegistryNodeTypes,
} from "./registryEnforce.js";
