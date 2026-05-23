export type MigrationValidateMode = "each-step" | "final-only";

export interface ExecutionPolicy {
  migration: {
    strict: boolean;
    validateMode: MigrationValidateMode;
  };
}

export const DEFAULT_EXECUTION_POLICY: ExecutionPolicy = {
  migration: {
    strict: true,
    validateMode: "each-step",
  },
};

export function resolveExecutionPolicy(
  policy?: Partial<ExecutionPolicy>,
): ExecutionPolicy {
  return {
    migration: {
      strict:
        policy?.migration?.strict ??
        DEFAULT_EXECUTION_POLICY.migration.strict,
      validateMode:
        policy?.migration?.validateMode ??
        DEFAULT_EXECUTION_POLICY.migration.validateMode,
    },
  };
}
