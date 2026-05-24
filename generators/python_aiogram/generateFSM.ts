import type { FsmGraph } from "../../core/execution/fsmGraph";
import { emitFsmPythonFromGraph } from "../../core/codegen/fsmCodegen.js";

/**
 * Generate aiogram 3 FSM section from graph-based FsmGraph (not StatesGroup-primary).
 */
export function generateFsmPython(fsmGraph: FsmGraph): string {
  return emitFsmPythonFromGraph(fsmGraph);
}

/** @deprecated Use generateFsmPython — kept for transitional imports */
export function generateFSMNode(_node: unknown): string {
  return "";
}
