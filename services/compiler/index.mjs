import { compilePreview } from "./previewCompiler.mjs";

export function buildBot(graph) {
  return compilePreview(graph);
}
