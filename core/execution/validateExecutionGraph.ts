export {
  DEFAULT_EXECUTION_POLICY,
  resolveExecutionPolicy,
  type ExecutionPolicy,
  type MigrationValidateMode,
} from "./executionPolicy";

export {
  ExecutionGraphValidationError,
  type ExecutionGraphValidationCode,
  type ExecutionGraphValidationResult,
  parseExecutionGraph,
  validateExecutionGraphCore,
} from "./validateExecutionGraphCore";

export {
  CURRENT_VERSION,
  checkVersionCompatibility,
  isCompatible,
} from "./version";

export {
  prepareExecutionGraph,
  type PreparedExecutionGraph,
  type PreparedExecutionGraphResult,
} from "./prepareExecutionGraph";

import { prepareExecutionGraph } from "./prepareExecutionGraph";

/** @deprecated Prefer prepareExecutionGraph — kept for existing imports. */
export function validateExecutionGraph(input: unknown) {
  return prepareExecutionGraph(input as Parameters<typeof prepareExecutionGraph>[0])
    .execution;
}
