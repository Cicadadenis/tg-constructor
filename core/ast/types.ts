export type NodeType =
  | "command"
  | "message"
  | "callback"
  | "fsm"
  | "keyboard"
  | "condition"
  | "api"
  | "database";

export interface BaseNode {
  id: string;
  type: NodeType;
  data: Record<string, any>;
}
