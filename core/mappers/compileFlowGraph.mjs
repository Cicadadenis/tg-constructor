import { reactFlowToGraph } from "./reactFlowToGraph.ts";
import { compileGraphSync } from "../compiler/codegen.ts";
import { isFlowEmptyForCodegen } from "../codegen/emptyGraph.js";
import { isGraphEffectivelyEmpty } from "../../src/constructor/graph_document/graph_canvas_state.js";
import {
  ExecutionGraphMigrationError,
  ExecutionGraphValidationError,
  MigrationChainError,
} from "../execution/prepareExecutionGraph.ts";

const PREVIEW_INCOMPLETE_CODES = new Set(["MISSING_EDGES", "ORPHAN_NODES"]);

function emptyCompileMeta(overrides = {}) {
  return {
    code: "",
    python: "",
    compileErrors: [],
    compileWarnings: [],
    transpileTrace: [],
    empty: true,
    success: false,
    ...overrides,
  };
}

function executionErrorToCompileError(err) {
  return {
    code: err.code || "EXECUTION_GRAPH",
    message: err.message,
    severity: "error",
    details: err.details ?? null,
  };
}

function isExecutionGraphValidationError(err) {
  return (
    err instanceof ExecutionGraphValidationError
    || err?.name === "ExecutionGraphValidationError"
    || (typeof err?.code === "string" && err.code.length > 0)
  );
}

function isMigrationError(err) {
  return (
    err instanceof MigrationChainError
    || err instanceof ExecutionGraphMigrationError
    || err?.name === "MigrationChainError"
    || err?.name === "ExecutionGraphMigrationError"
  );
}

/**
 * React Flow / project flow → Python via graph compiler (sync, for UI preview).
 * Never throws — returns compileErrors for UI instead of crashing React.
 *
 * @param {{ nodes: any[], edges: any[] }} flow
 * @param {{ graphDocument?: object, strict?: boolean }} [options]
 */
export function compileFlowToPython(flow, options = {}) {
  if (isFlowEmptyForCodegen(flow)) {
    return emptyCompileMeta();
  }

  if (options.graphDocument && isGraphEffectivelyEmpty(options.graphDocument)) {
    return emptyCompileMeta();
  }

  const flowEdges = flow?.edges || [];
  if (!options.strict && flowEdges.length === 0) {
    return emptyCompileMeta();
  }

  try {
    const botGraph = reactFlowToGraph(flow?.nodes || [], flow?.edges || []);
    const result = compileGraphSync(botGraph, {
      allowIncomplete: !options.strict,
    });

    if (result.empty || !result.python) {
      return emptyCompileMeta({
        execution: result.execution,
        runtime: result.runtime,
      });
    }

    return {
      code: result.python || "",
      python: result.python || "",
      compileErrors: [],
      compileWarnings: [],
      transpileTrace: [],
      empty: false,
      execution: result.execution,
      runtime: result.runtime,
      success: result.success,
    };
  } catch (err) {
    if (
      isExecutionGraphValidationError(err)
      && !options.strict
      && PREVIEW_INCOMPLETE_CODES.has(err.code)
    ) {
      return emptyCompileMeta();
    }

    if (isExecutionGraphValidationError(err) || isMigrationError(err)) {
      return emptyCompileMeta({
        compileErrors: [executionErrorToCompileError(err)],
        aborted: true,
      });
    }

    return emptyCompileMeta({
      compileErrors: [{
        code: "COMPILE_ERROR",
        message: err instanceof Error ? err.message : String(err),
        severity: "error",
      }],
      aborted: true,
    });
  }
}
