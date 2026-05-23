import { compilePreview } from "./previewCompiler.mjs";

export async function buildBot(graph, options = {}) {
  return await compilePreview(graph, options);
}
