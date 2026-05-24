/**
 * Capability-based compile pipeline:
 *   Visual Graph → Bot IR → Execution Plan → Execution Graph → aiogram3
 */

import type { GraphDocumentInput } from "../ir/bot_ir.js";
import { graphToBotIR } from "../ir/bot_ir.js";
import { buildExecutionPlan, type BotExecutionPlan } from "../runtime/executionPlan.js";
import {
  compileGraphDocumentToPython,
  type UnifiedCompileOptions,
  type UnifiedCompileResult,
} from "./unifiedCompilePipeline.js";
import { registerAllCapabilityEmitters } from "../codegen/capabilityEmitters/registerAll.js";

let emittersReady = false;

function ensureCapabilityCodegen(): void {
  if (emittersReady) return;
  registerAllCapabilityEmitters();
  emittersReady = true;
}

export interface CapabilityCompileResult extends UnifiedCompileResult {
  executionPlan: BotExecutionPlan;
}

/**
 * Full capability compile: validates, builds immutable plan, emits Python.
 */
export function compileViaCapabilities(
  graphDocument: GraphDocumentInput,
  options: UnifiedCompileOptions = {},
): CapabilityCompileResult {
  ensureCapabilityCodegen();
  const result = compileGraphDocumentToPython(graphDocument, options);
  const botIr = result.botIr;
  const executionPlan = buildExecutionPlan(botIr);
  return {
    ...result,
    executionPlan,
  };
}

export { buildExecutionPlan, type BotExecutionPlan };
