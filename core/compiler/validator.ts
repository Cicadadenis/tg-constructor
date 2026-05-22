import type { GraphDocument } from "../ast/contracts";

export function validateGraph(doc: GraphDocument): void {
  if (!doc?.version) {
    throw new Error("Graph document missing version");
  }
}
