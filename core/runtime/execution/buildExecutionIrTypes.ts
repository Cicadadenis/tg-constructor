import type { FlowGraphEdge, FlowGraphNode } from "./flowNodeCapabilities.js";

export interface FlowGraphInput {
  version?: number;
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
  capabilities?: string[];
  nonLinear?: boolean;
  metadata?: Record<string, unknown>;
}
