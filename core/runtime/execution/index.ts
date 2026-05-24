export {
  EXECUTION_IR_VERSION,
  freezeExecutionIrPlan,
  getExecutionStep,
  getJoinBarrier,
  type ExecutionIrPlan,
  type ExecutionIrStep,
  type ExecutionStepKind,
  type ExecutionStatus,
  type ForkBranch,
  type JoinBarrier,
  type RetryPolicy,
} from "./executionIr.js";

export {
  buildExecutionIrFromFlowGraph,
  buildExecutionIrFromBotIr,
  type FlowGraphInput,
} from "./buildExecutionIr.js";

export {
  EXECUTION_STATE_VERSION,
  createInitialExecutionState,
  cloneSnapshot,
  isJoinBarrierSatisfied,
  type ExecutionStateSnapshot,
  type BranchRuntimeState,
  type JoinProgress,
} from "./executionState.js";

export {
  InMemoryExecutionStateStore,
  getDefaultExecutionStateStore,
  type ExecutionStateStore,
} from "./executionStateStore.js";

export {
  EXECUTION_EVENT_VERSION,
  freezeExecutionEvent,
  buildSideEffectIdempotencyKey,
  hasAppliedIdempotencyKey,
  type ExecutionEvent,
  type ExecutionEventType,
  type ExecutionEventInput,
} from "./executionEvents.js";

export {
  reduceExecutionState,
  foldExecutionEvents,
  isJoinReadyFromState,
} from "./executionStateReducer.js";

export {
  replayExecutionEvents,
  replayToCheckpoint,
  diffStates,
  type ReplayOptions,
  type ReplayResult,
} from "./executionReplayEngine.js";

export {
  InMemoryExecutionEventStore,
  getDefaultExecutionEventStore,
  buildEventInput,
  type ExecutionEventStore,
} from "./executionEventStore.js";

export {
  ExecutionHistory,
  createExecutionHistory,
  buildTimeline,
  type TimelineEntry,
  type TimeTravelDebugSession,
} from "./executionHistory.js";

export { ExecutionEventJournal } from "./executionEventJournal.js";

export {
  ExecutionScheduler,
  createExecutionScheduler,
  type SchedulerRunOptions,
  type SchedulerRunResult,
} from "./executionScheduler.js";

export {
  runGraphExecutionIr,
  type RunGraphExecutionIrOptions,
  type RunGraphExecutionIrResult,
} from "./runGraphExecutionIr.js";

export {
  capabilityForFlowNode,
  payloadForFlowNode,
} from "./flowNodeCapabilities.mjs";

export {
  ExecutionContractEnforcementError,
  requireStepExecutionContract,
  resolveStepRetryPolicy,
  manifestBlockTypeFromStep,
} from "./executionContractEnforcement.js";
export type { FlowGraphNode, FlowGraphEdge } from "./flowNodeCapabilitiesTypes.js";

export {
  INTENT_ONLY_NODE_TYPES,
  ALLOWED_FLOW_GRAPH_NODE_TYPES,
  isIntentOnlyNodeType,
  isAllowedFlowGraphNodeType,
  validateNodeType,
  validateFlowGraphNodes,
} from "./executionNodeTypes.mjs";

export {
  ALLOWED_EXECUTION_IR_NODE_TYPES,
  ExecutionIRValidationError,
  validateExecutionIR,
  mapPlannerTypeToExecutionIR,
  normalizeFlowGraphForExecutionIR,
  STRUCTURAL_ACTION_TYPES,
} from "./validateExecutionIR.mjs";

export {
  runStrictExecutionCompilerGate,
  StrictExecutionCompilerError,
} from "../../compiler/strictExecutionCompilerGate.mjs";

export {
  ExecutionError,
  stepNodeId,
  stepNodeType,
} from "./executionErrors.mjs";

export {
  applyExecutionEffects,
  freezeEffects,
  effects,
  setStateEffect,
  sendMessageEffect,
  callAPIEffect,
  emitEventEffect,
} from "./executionEffects.mjs";

export {
  EXECUTION_TRACE_VERSION,
  buildTraceInputs,
  buildTraceOutputs,
  freezeTraceEvent,
  InMemoryExecutionTraceStore,
  getDefaultExecutionTraceStore,
  ExecutionTraceCollector,
  withNodeTrace,
} from "./executionTrace.mjs";

export {
  ExecutionTraceReplayer,
  replayTraceSteps,
} from "./executionTraceReplayer.mjs";

export type {
  ExecutionTraceEvent,
  ExecutionTraceEventType,
  ExecutionTraceRecord,
} from "./executionTrace.js";

export type {
  ExecutionEffect,
  ExecutionEffectType,
  SetStateEffect,
  SendMessageEffect,
  CallAPIEffect,
  EmitEventEffect,
  ApplyExecutionEffectsOptions,
} from "./executionEffects.js";

export {
  isRuntimeExecutionBlockType,
  assertNotIntentOnlyRuntimeType,
  listAllowedFlowGraphTypes,
  listIntentOnlyTypes,
} from "./runtimeNodeRegistry.mjs";
