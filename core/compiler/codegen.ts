import { parseGraph } from "./parser";
import { normalizeAst } from "./normalizer";
import { validateGraph } from "./validator";
import { resolveDependencies } from "./dependencyResolver";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";
import { logStep } from "../debug/compilerLogger";

export function compileGraph(graph: any) {
  logStep("parse");
  const parsed = parseGraph(graph);

  logStep("normalize");
  const normalized = normalizeAst(parsed);

  logStep("validate");
  validateGraph(normalized);

  logStep("resolve dependencies");
  const resolved = resolveDependencies(normalized);

  logStep("generate aiogram");
  const python = generateAiogramBot(resolved);

  return {
    success: true,
    python,
    resolved,
  };
}
