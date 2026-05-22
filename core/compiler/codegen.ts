import { parseGraph } from "./parser";
import { normalizeAst } from "./normalizer";
import { validateGraph } from "./validator";
import { buildExecutionGraph } from "../execution/buildExecutionGraph";
import { assertExecutionInvariants } from "../execution/assertExecutionInvariants";
import { buildFSM } from "../execution/buildFSM";
import { buildCallbackRoutes } from "../execution/buildCallbackRoutes";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot";
import { logStep } from "../debug/compilerLogger";
import type { ExecutionGraph } from "../execution/executionContract";

function compileGraphImpl(graph: any) {
  logStep("parse");

  const parsed = parseGraph(graph);

  logStep("normalize");

  const normalized = normalizeAst(parsed);

  logStep("validate");

  validateGraph(normalized);

  logStep("execution");

  const execution = buildExecutionGraph(
    normalized.nodes,
    normalized.edges,
    normalized.version ?? graph.version ?? "1.0",
  );

  assertExecutionInvariants(execution);

  const fsm = buildFSM(execution);
  const callbacks = buildCallbackRoutes(execution);

  logStep("generate aiogram");

  const python = generateAiogramBot(execution);

  return {
    success: true,
    python,
    execution,
    runtime: {
      execution,
      fsm,
      callbacks,
    },
  };
}

/** Sync compile for UI preview (useMemo). */
export function compileGraphSync(graph: any) {
  return compileGraphImpl(graph);
}

export async function compileGraph(graph: any) {
  return compileGraphImpl(graph);
}

export type { ExecutionGraph };
