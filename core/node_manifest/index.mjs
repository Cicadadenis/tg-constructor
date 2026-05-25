export {
  NodeManifestRegistry,
  NodeManifestRegistryModificationError,
  NodeManifestNotFoundError,
  getNodeManifestRegistry,
  __resetNodeManifestRegistryForTests,
  __setNodeManifestRegistryForTests,
} from './nodeManifestRegistry.mjs';

export {
  buildAllNodeManifests,
  createNodeInputSchema,
} from './buildNodeManifests.mjs';

export {
  validateNodeExecution,
  assertNodeExecutionAllowed,
  validateGraphNodeForExecution,
  NodeManifestValidationError,
} from './validateNodeExecution.mjs';

export { manifestToOperationContract } from './manifestToOperationContract.mjs';

export { PAYLOAD_VALIDATION_RULES } from './payloadValidationRules.mjs';

export {
  RETRY_POLICY_NONE,
  RETRY_POLICY_SIMPLE,
  RETRY_POLICY_DURABLE,
  RETRY_POLICY_KINDS,
  ExecutionContractSchema,
  ExecutionContractValidationError,
  assertValidExecutionContract,
  executionContractToRetryPolicy,
  buildExecutionContractFromCapabilities,
  freezeExecutionContract,
} from './executionContract.mjs';

export {
  resolveManifestBlockTypeForFlowNode,
  isNonExecutableFlowNode,
} from './resolveManifestForFlowNode.mjs';

export {
  resolveExecutionContractForFlowNode,
} from './validateFlowGraphExecutionContracts.mjs';

export {
  runStrictExecutionCompilerGate,
  StrictExecutionCompilerError,
} from '../compiler/strictExecutionCompilerGate.mjs';

/** @deprecated Use runStrictExecutionCompilerGate */
export { validateFlowGraphExecutionContracts } from './validateFlowGraphExecutionContracts.mjs';

/** @deprecated No-op — gate validates before IR build */
export { validateExecutionIrPlanContracts } from './validateFlowGraphExecutionContracts.mjs';

export {
  PORT_KINDS,
  PORT_DIRECTIONS,
  buildManifestInputPorts,
  buildManifestOutputPorts,
  capabilityOutputsFromPorts,
} from './manifestPorts.mjs';
