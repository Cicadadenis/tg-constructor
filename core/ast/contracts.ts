import type { BaseNode } from "./types";

export interface GraphDocument {
  version: string;
  nodes: BaseNode[];
  edges: Array<{ id: string; source: string; target: string }>;
}
