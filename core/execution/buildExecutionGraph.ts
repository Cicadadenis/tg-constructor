import { CURRENT_VERSION } from "./version";
import { executionTriggerForSource } from "../registry/blockCapabilities.js";
import { assertRegisteredBlockType } from "../../src/constructor/graph_document/graph_node_payload.js";
import { validateGraphNodeForExecution } from "../node_manifest/validateNodeExecution.mjs";
import { resolveFlowNodeType, resolveFlowNodeProps } from "../ir/resolveFlowNodeType.js";
import type { BotIRGraph } from "../ir/bot_ir.js";
import { botIrToExecutionGraph } from "../ir/botIrToExecutionGraph.js";
import type {
  ExecutionEdge,
  ExecutionGraph,
  ExecutionNode,
  ExecutionTrigger,
} from "./executionContract";

function inferTrigger(
  source: ExecutionNode,
  sourcePortId?: string | null,
): ExecutionTrigger {
  return executionTriggerForSource(source.type, sourcePortId);
}

function toExecutionNode(node: any): ExecutionNode {
  const nodeId = String(node?.id ?? "").trim();
  const type = assertRegisteredBlockType(resolveFlowNodeType(node), {
    nodeId: nodeId || undefined,
  });
  validateGraphNodeForExecution({ id: nodeId, type, data: resolveFlowNodeProps(node) });
  const props = resolveFlowNodeProps(node);
  return {
    id: nodeId,
    type,
    data: props as Record<string, unknown>,
  };
}

/**
 * Lower Bot IR → Execution Graph (canonical path).
 */
export function buildExecutionGraphFromBotIR(
  botIr: BotIRGraph,
  version = CURRENT_VERSION,
): ExecutionGraph {
  return botIrToExecutionGraph(botIr, version);
}

export function buildExecutionGraph(
  nodes: any[],
  edges: any[],
  version = CURRENT_VERSION,
): ExecutionGraph {
  const executionNodes = nodes.map(toExecutionNode);
  const nodeById = new Map(executionNodes.map((n) => [n.id, n]));

  const executionEdges: ExecutionEdge[] = [];

  for (const edge of edges) {
    const source = nodeById.get(edge.source);
    if (!source) continue;

    const trigger = inferTrigger(
      source,
      edge.sourceHandle ?? edge.sourcePort ?? null,
    );
    const executionEdge: ExecutionEdge = {
      from: edge.source,
      to: edge.target,
      trigger,
    };

    if (trigger === "callback") {
      const callback = String(source.data?.callback ?? source.data?.data ?? "");
      if (callback) executionEdge.condition = callback;
    }

    if (trigger === "state") {
      const data = source.data && typeof source.data === "object" ? source.data : {};
      const state = String(
        (data as Record<string, unknown>).name
          ?? (data as Record<string, unknown>).state
          ?? (data as Record<string, unknown>).event
          ?? "",
      );
      if (state) executionEdge.condition = state;
    }

    executionEdges.push(executionEdge);
  }

  return {
    version,
    nodes: executionNodes,
    edges: executionEdges,
  };
}
