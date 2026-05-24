/**
 * Bot IR → Execution Graph (capability-based edge triggers).
 */

import {
  assertBlockCapabilitiesRegistered,
  executionTriggerForSource,
} from "../registry/blockCapabilities.js";
import { assertRegisteredBlockType } from "../../src/constructor/graph_document/graph_node_payload.js";
import { CURRENT_VERSION } from "../execution/version.js";
import type {
  ExecutionEdge,
  ExecutionGraph,
  ExecutionNode,
} from "../execution/executionContract.js";
import type { BotIRGraph, BotIRNode } from "./bot_ir.js";
import { isIntentOnlyNodeType } from "../runtime/execution/executionNodeTypes.mjs";

function botIrNodeToExecution(node: BotIRNode): ExecutionNode {
  if (isIntentOnlyNodeType(node.type)) {
    throw new Error(
      `Bot IR node "${node.id}": type "${node.type}" is intent-only and cannot reach execution graph`,
    );
  }
  const type = assertRegisteredBlockType(node.type, { nodeId: node.id });
  assertBlockCapabilitiesRegistered(type);
  return {
    id: node.id,
    type,
    data: { ...node.payload },
  };
}

function conditionFromSource(
  source: ExecutionNode,
  trigger: ExecutionEdge["trigger"],
): string | undefined {
  const data =
    source.data && typeof source.data === "object" ? source.data : {};

  if (trigger === "callback") {
    const callback = String(
      (data as Record<string, unknown>).callback
        ?? (data as Record<string, unknown>).data
        ?? (data as Record<string, unknown>).dataPrefix
        ?? "",
    );
    return callback || undefined;
  }

  if (trigger === "state") {
    const state = String(
      (data as Record<string, unknown>).name
        ?? (data as Record<string, unknown>).state
        ?? (data as Record<string, unknown>).event
        ?? "",
    );
    return state || undefined;
  }

  return undefined;
}

/**
 * Lower capability-enriched Bot IR to Execution Graph.
 */
export function botIrToExecutionGraph(
  botIr: BotIRGraph,
  version: string = CURRENT_VERSION,
): ExecutionGraph {
  const executionNodes = botIr.nodes.map(botIrNodeToExecution);
  const nodeById = new Map(executionNodes.map((n) => [n.id, n]));
  const executionEdges: ExecutionEdge[] = [];

  for (const edge of botIr.edges) {
    const source = nodeById.get(edge.source);
    if (!source) {
      throw new Error(
        `Bot IR edge "${edge.id}": unknown source node "${edge.source}"`,
      );
    }
    const target = nodeById.get(edge.target);
    if (!target) {
      throw new Error(
        `Bot IR edge "${edge.id}": unknown target node "${edge.target}"`,
      );
    }

    const trigger = executionTriggerForSource(
      source.type,
      edge.sourcePort ?? "flow",
    );
    const executionEdge: ExecutionEdge = {
      from: edge.source,
      to: edge.target,
      trigger,
    };

    const condition = conditionFromSource(source, trigger);
    if (condition) executionEdge.condition = condition;

    executionEdges.push(executionEdge);
  }

  return {
    version,
    nodes: executionNodes,
    edges: executionEdges,
  };
}
