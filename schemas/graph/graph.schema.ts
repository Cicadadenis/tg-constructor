export interface GraphNode {
  id: string;
  type: string;
  position?: {
    x: number;
    y: number;
  };
  data: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface BotGraph {
  version: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
