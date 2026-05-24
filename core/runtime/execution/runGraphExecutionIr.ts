/**
 * Production graph execution entry — Flow Graph → validated Execution IR → scheduler.
 */

import { compileFlowGraphToExecutionIr } from "../../ai/executionGraphCompiler.mjs";
import type { FlowGraphInput } from "./buildExecutionIr.js";
import {
  createExecutionScheduler,
  type ExecutionScheduler,
  type SchedulerRunOptions,
  type SchedulerRunResult,
} from "./executionScheduler.js";
import type { ExecutionIrPlan } from "./executionIr.js";

export interface RunGraphExecutionIrOptions extends SchedulerRunOptions {
  /** When true, return the frozen plan without running the scheduler. */
  planOnly?: boolean;
}

export interface RunGraphExecutionIrResult {
  plan: ExecutionIrPlan;
  scheduler: ExecutionScheduler;
  run?: SchedulerRunResult;
}

/**
 * Compile a flow graph to Execution IR and run the event-sourced scheduler.
 * This is the only supported production execution path when LEGACY_EXECUTION_ENABLED=false.
 */
export async function runGraphExecutionIr(
  flowGraph: FlowGraphInput,
  options: RunGraphExecutionIrOptions = {},
): Promise<RunGraphExecutionIrResult> {
  const plan = compileFlowGraphToExecutionIr(flowGraph);
  const scheduler = createExecutionScheduler(plan);
  if (options.planOnly) {
    return { plan, scheduler };
  }
  const run = await scheduler.start(options);
  return { plan, scheduler, run };
}
