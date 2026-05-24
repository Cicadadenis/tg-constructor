/**
 * Execution-graph error taxonomy — shared by compile mappers and UI.
 */

/** @type {ReadonlySet<string>} */
export const EXECUTION_GRAPH_VALIDATION_CODES = new Set([
  "INVALID_SCHEMA",
  "INCOMPATIBLE_VERSION",
  "MISSING_EDGES",
  "ORPHAN_NODES",
  "CYCLE_DETECTED",
  "UNKNOWN_EDGE_NODE",
]);

const MIGRATION_ERROR_NAMES = new Set([
  "MigrationChainError",
  "ExecutionGraphMigrationError",
]);

/**
 * True only for ExecutionGraphValidationError with a known validation code.
 * Arbitrary errors with a `code` field are NOT treated as validation errors.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isExecutionGraphValidationError(err) {
  if (!err || typeof err !== "object") return false;
  const { name, code } = /** @type {{ name?: string, code?: string }} */ (err);
  return (
    name === "ExecutionGraphValidationError"
    && typeof code === "string"
    && EXECUTION_GRAPH_VALIDATION_CODES.has(code)
  );
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isMigrationError(err) {
  if (!err || typeof err !== "object") return false;
  const name = /** @type {{ name?: string }} */ (err).name;
  return typeof name === "string" && MIGRATION_ERROR_NAMES.has(name);
}
