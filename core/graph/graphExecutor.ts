import { buildExecutionGraphFromBotIR } from "../execution/buildExecutionGraph";
import { graphToBotIR } from "../ir/bot_ir";
import type { GraphDocumentInput } from "../ir/bot_ir";
import { isGraphDocumentShape } from "../../src/constructor/graph_document/graph_schema.js";
import { assertExecutionInvariants } from "../execution/assertExecutionInvariants";
import {
  DEFAULT_EXECUTION_POLICY,
  prepareExecutionGraph,
  resolveExecutionPolicy,
  type ExecutionPolicy,
  type PreparedExecutionGraphResult,
} from "../execution/prepareExecutionGraph";
import { buildFSM, buildFsmGraph } from "../execution/buildFSM";
import { buildCallbackRoutes } from "../execution/buildCallbackRoutes";
import type { ExecutionGraph } from "../execution/executionContract";
import { CURRENT_VERSION } from "../execution/version";

export interface GraphExecutionResult {
  execution: ExecutionGraph;
  policy: ExecutionPolicy;
  compatibilityWarnings: string[];
  migration: PreparedExecutionGraphResult["migration"];
  fsm: ReturnType<typeof buildFSM>;
  fsmGraph: ReturnType<typeof buildFsmGraph>;
  callbacks: ReturnType<typeof buildCallbackRoutes>;
}

export interface ExecuteGraphOptions {
  policy?: ExecutionPolicy;
}

function toBotIr(graph: {
  nodes: any[];
  edges: any[];
  version?: string;
  schema_version?: number;
  metadata?: Record<string, unknown>;
}) {
  if (isGraphDocumentShape(graph)) {
    return graphToBotIR(graph as GraphDocumentInput);
  }
  return graphToBotIR({
    schema_version: graph.schema_version ?? 2,
    nodes: graph.nodes,
    edges: graph.edges,
    metadata: graph.metadata ?? { generatedFrom: "flow" },
  });
}

export function executeGraph(
  graph: {
    nodes: any[];
    edges: any[];
    version?: string;
    schema_version?: number;
    metadata?: Record<string, unknown>;
  },
  options: ExecuteGraphOptions = {},
): GraphExecutionResult {
  const policy = resolveExecutionPolicy(options.policy ?? DEFAULT_EXECUTION_POLICY);
  const botIr = toBotIr(graph);
  const prepared = prepareExecutionGraph(
    buildExecutionGraphFromBotIR(
      botIr,
      graph.version ?? CURRENT_VERSION,
    ),
    CURRENT_VERSION,
    policy,
  );

  assertExecutionInvariants(prepared.execution);

  return {
    execution: prepared.execution,
    policy: prepared.policy,
    compatibilityWarnings: prepared.compatibilityWarnings,
    migration: prepared.migration,
    fsm: buildFSM(prepared.execution),
    fsmGraph: buildFsmGraph(prepared.execution),
    callbacks: buildCallbackRoutes(prepared.execution),
  };
}
