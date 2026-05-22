import type { BaseNode, NodeType } from "./types";

export interface GraphNode extends BaseNode {
  type: NodeType;
}

export type GraphNodes = GraphNode[];
