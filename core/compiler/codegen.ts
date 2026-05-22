import { parseGraph } from "./parser";
import { normalizeAst } from "./normalizer";
import { validateGraph } from "./validator";
import { resolveDependencies } from "./dependencyResolver";
import { executeGraph } from "../graph/graphExecutor";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";
import { logStep } from "../debug/compilerLogger";

function compileGraphImpl(graph: any) {
  logStep("parse");

  const parsed = parseGraph(graph);

  logStep("normalize");

  const normalized = normalizeAst(parsed);

  logStep("validate");

  validateGraph(normalized);

  logStep("dependencies");

  const resolved = resolveDependencies(normalized);

  logStep("execution");

  const runtime = executeGraph(normalized);

  logStep("generate aiogram");

  const python = generateAiogramBot(resolved, runtime);

  return {
    success: true,
    python,
    runtime,
    resolved,
  };
}

/** Sync compile for UI preview (useMemo). */
export function compileGraphSync(graph: any) {
  return compileGraphImpl(graph);
}

export async function compileGraph(graph: any) {
  return compileGraphImpl(graph);
}
