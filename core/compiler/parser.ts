import type { GraphDocument } from "../ast/contracts";

export function parseGraph(input: unknown): GraphDocument {
  return input as GraphDocument;
}
