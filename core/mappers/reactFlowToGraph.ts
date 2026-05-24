import type { BotGraph, GraphNode } from "../../schemas/graph/graph.schema";
import { normalizeFlowNode } from "../ir/normalizeFlowNode.js";
import {
  buildCanonicalFlowEdgeId,
  sanitizeFlowPosition,
  type FlowEdgeInput,
  type FlowNodeInput,
} from "./flowMapperUtils.ts";

function toCompilerNodeType(blockType: string): string {
  if (blockType === "start") return "command";
  if (blockType === "state") return "fsm.state";
  if (blockType.startsWith("fsm.") || blockType.startsWith("db.")) return blockType;
  return blockType;
}

function resolveBlockData(
  blockType: string,
  props: Record<string, unknown>,
  nodeId: string,
): Record<string, unknown> {
  if (blockType === "start" || blockType === "command") {
    return {
      command: props.cmd || props.command || "start",
      ...props,
    };
  }

  if (blockType === "message") {
    return {
      text: props.text || "",
      ...props,
    };
  }

  if (blockType === "callback") {
    return {
      callback: props.data || props.callback || props.label || "",
      ...props,
    };
  }

  if (blockType === "fsm.state" || blockType === "fsm" || blockType === "state") {
    return {
      group: props.group || props.scenario || "Form",
      name: props.name || props.state || props.step || nodeId,
      ...props,
    };
  }

  if (blockType === "fsm.input") {
    return {
      group: props.group || props.scenario || "Form",
      field: props.field || props.varname || "field",
      prompt: props.prompt || props.question || props.text || "",
      ...props,
    };
  }

  if (blockType === "fsm.transition") {
    return {
      from: props.from || props.source || "",
      to: props.to || props.target || "",
      event: props.event || props.label || "",
      condition: props.condition || props.guard || "",
      ...props,
    };
  }

  if (blockType === "require_role") {
    return {
      role: props.role || "user",
      roles: props.roles || "",
      message: props.message || props.deny_message || "Недостаточно прав",
      ...props,
    };
  }

  if (blockType === "set_variable") {
    return {
      name: props.name || props.varname || props.key || nodeId,
      value: props.value ?? "",
      ...props,
    };
  }

  if (blockType === "get_variable") {
    return {
      name: props.name || props.key || props.varname || nodeId,
      varname: props.varname || props.name || "var",
      ...props,
    };
  }

  if (blockType === "foreach") {
    return {
      list: props.list || props.collection || "products",
      var: props.var || props.item || "product",
      output: props.output || props.mode || "body",
      labelField: props.labelField || "name",
      idField: props.idField || "id",
      callbackPrefix: props.callbackPrefix || "prod:",
      columns: props.columns ?? 2,
      ...props,
    };
  }

  if (blockType === "db.get") {
    return {
      key: props.key || props.name || nodeId,
      varname: props.varname || props.var || "value",
      table: props.table || "kv_store",
      ...props,
    };
  }

  if (blockType === "db.set") {
    return {
      key: props.key || props.name || nodeId,
      value: props.value ?? "",
      table: props.table || "kv_store",
      ...props,
    };
  }

  if (blockType === "db.query") {
    return {
      sql: props.sql || props.query || "SELECT 1",
      varname: props.varname || props.var || "rows",
      ...props,
    };
  }

  if (blockType === "db.insert") {
    return {
      table: props.table || "records",
      values: props.values || props.row || props,
      ...props,
    };
  }

  if (blockType === "db.update") {
    return {
      table: props.table || "records",
      where: props.where || props.condition || "1=1",
      values: props.values || props.set || props,
      ...props,
    };
  }

  return { ...props };
}

function mapFlowNode(node: FlowNodeInput): GraphNode | null {
  if (!node?.id) return null;
  const norm = normalizeFlowNode(node);
  const compilerType = toCompilerNodeType(norm.type);

  return {
    id: norm.id,
    type: compilerType,
    position: sanitizeFlowPosition(node.position),
    data: resolveBlockData(norm.type, norm.props, norm.id),
  };
}

function mapFlowEdge(edge: FlowEdgeInput) {
  if (!edge?.source || !edge?.target) return null;
  return {
    id: buildCanonicalFlowEdgeId(edge),
    source: String(edge.source),
    target: String(edge.target),
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
  };
}

export function reactFlowToGraph(
  nodes: FlowNodeInput[],
  edges: FlowEdgeInput[],
): BotGraph {
  const compilerNodes = (nodes || [])
    .map(mapFlowNode)
    .filter((node): node is GraphNode => node != null);
  const compilerEdges = (edges || [])
    .map(mapFlowEdge)
    .filter((edge): edge is NonNullable<ReturnType<typeof mapFlowEdge>> => edge != null);

  return {
    version: "1.0",
    nodes: compilerNodes,
    edges: compilerEdges,
  };
}
