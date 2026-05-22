import { compilePreview } from "./previewCompiler.mjs";

export async function buildBot(graph) {
  return await compilePreview(graph);
}
