export {
  RUNTIME_CTX_VERSION,
  type BotRuntimeContext,
  type RuntimeContextNodeSource,
} from "./runtimeContext.js";

export {
  EXECUTION_PLAN_VERSION,
  buildExecutionPlan,
  getPlanStep,
  getPlanStepByNodeId,
  type BotExecutionPlan,
  type CapabilityPlanStep,
  type PlanEdgeRef,
} from "./executionPlan.js";

export {
  registerCapabilityExecutor,
  executeCapability,
  ensureCapabilityExecutorsRegistered,
  hasCapabilityExecutor,
  listCapabilityExecutors,
  UnknownCapabilityExecutorError,
  type CapabilityExecuteContext,
  type CapabilityExecuteResult,
} from "./capabilityExecutors.js";

export {
  createRuntimeEngine,
  execute,
  type RuntimeEngine,
  type RuntimeExecuteOptions,
} from "./runtimeEngine.js";

export {
  EXECUTION_IR_VERSION,
  EXECUTION_STATE_VERSION,
  buildExecutionIrFromFlowGraph,
  buildExecutionIrFromBotIr,
  createExecutionScheduler,
  ExecutionScheduler,
  InMemoryExecutionStateStore,
  getDefaultExecutionStateStore,
  freezeExecutionIrPlan,
  type ExecutionIrPlan,
  type ExecutionStateSnapshot,
  type SchedulerRunResult,
  type FlowGraphInput,
} from "./execution/index.js";
