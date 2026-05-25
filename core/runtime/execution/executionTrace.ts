export const EXECUTION_TRACE_VERSION = "1.0";

export type ExecutionTraceEventType =
  | "nodeStart"
  | "nodeComplete"
  | "nodeError"
  | "edgeTraversal";

export interface ExecutionTraceEvent {
  readonly traceEventVersion: string;
  readonly sequence: number;
  readonly traceId: string;
  readonly executionId: string;
  readonly type: ExecutionTraceEventType;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly durationMs: number;
  readonly timestamp: string;
}

export interface ExecutionTraceRecord {
  readonly traceId: string;
  readonly executionId: string;
  readonly events: readonly ExecutionTraceEvent[];
}

export {
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
