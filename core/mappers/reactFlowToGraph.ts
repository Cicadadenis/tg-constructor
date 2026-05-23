import type { BotGraph, GraphNode } from "../../schemas/graph/graph.schema";

function resolveBlockType(node: any): string {
  const raw = String(node?.type || "").trim();
  const data = node?.data && typeof node.data === "object" ? node.data : {};
  if (raw && raw !== "cicada" && raw !== "unknown") return raw;
  return String(data.type || data.blockType || "message").trim() || "message";
}

function resolveBlockData(node: any, blockType: string): Record<string, any> {
  const data = node?.data && typeof node.data === "object" ? node.data : {};
  const props =
    data.props && typeof data.props === "object" && !Array.isArray(data.props)
      ? { ...data.props }
      : { ...data };

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

  if (blockType === "fsm" || blockType === "state") {
    return {
      state: props.state || props.name || node.id,
      ...props,
    };
  }

  return props;
}

function toCompilerNodeType(blockType: string): string {
  if (blockType === "start") return "command";
  if (blockType === "state") return "fsm";
  return blockType;
}

function mapFlowNode(node: any): GraphNode | null {
  if (!node?.id) return null;
  const blockType = resolveBlockType(node);
  const compilerType = toCompilerNodeType(blockType);

  return {
    id: String(node.id),
    type: compilerType,
    position: node.position,
    data: resolveBlockData(node, blockType),
  };
}

function mapFlowEdge(edge: any) {
  if (!edge?.source || !edge?.target) return null;
  return {
    id: edge.id || `${edge.source}->${edge.target}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  };
}

export function reactFlowToGraph(nodes: any[], edges: any[]): BotGraph {
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
