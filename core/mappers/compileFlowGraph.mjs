import { reactFlowToGraph } from "./reactFlowToGraph.ts";
import { compileGraphSync } from "../compiler/codegen.ts";
import { isFlowEmptyForCodegen } from "../codegen/emptyGraph.js";
import { isGraphEffectivelyEmpty } from "../../src/constructor/graph_document/graph_canvas_state.js";
import {
  isExecutionGraphValidationError,
  isMigrationError,
} from "./executionGraphErrors.mjs";

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

function missingEdgesWarning() {
  return {
    code: "MISSING_EDGES",
    message: "Graph has blocks but no connections — connect blocks to generate bot code",
    severity: "warning",
  };
}

/**
 * React Flow / project flow → Python via graph compiler (sync, for UI preview).
 * Never throws — returns compileErrors for UI instead of crashing React.
 *
 * @param {{ nodes: any[], edges: any[] }} flow
 * @param {{ graphDocument?: object, strict?: boolean }} [options]
 */
export function compileFlowToPython(flow, options = {}) {
  const sanitizedFlow = {
    nodes: (flow?.nodes || []).filter((n) => n && n.id),
    edges: (flow?.edges || []).filter((e) => e && e.source && e.target),
  };

  if (isFlowEmptyForCodegen(sanitizedFlow)) {
    return emptyCompileMeta();
  }

  if (options.graphDocument && isGraphEffectivelyEmpty(options.graphDocument)) {
    return emptyCompileMeta();
  }

  const flowEdges = sanitizedFlow.edges;
  const nodeCount = sanitizedFlow.nodes.length;

  if (flowEdges.length === 0 && nodeCount > 0) {
    if (options.strict) {
      return emptyCompileMeta({
        compileErrors: [{
          code: "MISSING_EDGES",
          message: "ExecutionGraph must contain at least one edge",
          severity: "error",
        }],
        aborted: true,
      });
    }
    return emptyCompileMeta({
      compileWarnings: [missingEdgesWarning()],
    });
  }

  try {
    const botGraph = reactFlowToGraph(sanitizedFlow.nodes, sanitizedFlow.edges);
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
      return emptyCompileMeta({
        compileWarnings: err.code === "MISSING_EDGES"
          ? [missingEdgesWarning()]
          : [{
            code: err.code,
            message: err.message,
            severity: "warning",
          }],
      });
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
