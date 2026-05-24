export interface FlowGraphNode {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
}

export interface FlowGraphEdge {
  from: string;
  to: string;
  kind?: string;
  condition?: string;
  label?: string;
}
