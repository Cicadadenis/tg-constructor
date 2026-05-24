/**
 * Unified compile pipeline:
 *   Visual Graph (GraphDocument) → Bot IR → Execution Graph → aiogram3 Python
 */

import { graphToBotIR, type BotIRGraph, type GraphDocumentInput } from "../ir/bot_ir.js";
import { botIrToExecutionGraph } from "../ir/botIrToExecutionGraph.js";
import {
  buildExecutionPlan,
  type BotExecutionPlan,
} from "../runtime/executionPlan.js";
import { registerAllCapabilityEmitters } from "../codegen/capabilityEmitters/registerAll.js";
import {
  assertCompileReady,
  validateBotIR,
  validateCompile,
  type StrictValidationOptions,
} from "../validation/strictPipeline.js";
import { assertExecutionInvariants } from "../execution/assertExecutionInvariants.js";
import {
  DEFAULT_EXECUTION_POLICY,
  prepareExecutionGraph,
  resolveExecutionPolicy,
  type ExecutionPolicy,
  type PreparedExecutionGraphResult,
} from "../execution/prepareExecutionGraph.js";
import { buildFSM, buildFsmGraph } from "../execution/buildFSM.js";
import { buildCallbackRoutes } from "../execution/buildCallbackRoutes.js";
import { generateAiogramBot } from "../../generators/python_aiogram/generateBot.js";
import { CURRENT_VERSION } from "../execution/version.js";
import type { ExecutionGraph } from "../execution/executionContract.js";
import { logStep } from "../debug/compilerLogger.js";
import type { VisualDbGraph } from "../db/visual_db_ir.js";

export interface UnifiedCompileOptions extends StrictValidationOptions {
  policy?: ExecutionPolicy;
  /** UI preview: allow empty / edge-less graphs. */
  allowIncomplete?: boolean;
  /** Skip validateCompile gate (tests only). */
  skipValidation?: boolean;
  prepared?: PreparedExecutionGraphResult;
}

export interface UnifiedCompileResult {
  success: boolean;
  python: string;
  botIr: BotIRGraph;
  executionPlan: BotExecutionPlan;
  execution: ExecutionGraph;
  policy: ExecutionPolicy;
  compatibilityWarnings: string[];
  migration: PreparedExecutionGraphResult["migration"];
  runtime: {
    execution: ExecutionGraph;
    fsm: ReturnType<typeof buildFSM>;
    fsmGraph: ReturnType<typeof buildFsmGraph>;
    callbacks: ReturnType<typeof buildCallbackRoutes>;
    visualDb: VisualDbGraph;
  };
  empty?: boolean;
}

/**
 * Visual Graph → Bot IR → Execution Graph (validated).
 */
export function lowerGraphDocumentToExecution(
  graphDocument: GraphDocumentInput,
  options: UnifiedCompileOptions = {},
): { botIr: BotIRGraph; execution: ExecutionGraph; prepared: PreparedExecutionGraphResult } {
  const policy = resolveExecutionPolicy(
    options.prepared?.policy ?? options.policy ?? DEFAULT_EXECUTION_POLICY,
  );

  logStep("bot_ir");
  const botIr = graphToBotIR(graphDocument);

  if (options.skipValidation !== true) {
    logStep("validate_bot_ir");
    const irGate = validateBotIR(botIr, {
      failFast: options.failFast !== false,
    });
    if (!irGate.ok) {
      const first = irGate.errors[0];
      throw new Error(first?.message || "Bot IR validation failed");
    }
  }

  logStep("execution_graph");
  const built = botIrToExecutionGraph(botIr, CURRENT_VERSION);

  if (options.allowIncomplete && built.edges.length === 0) {
    return {
      botIr,
      execution: built,
      prepared: {
        execution: built,
        policy,
        compatibilityWarnings: [],
        migration: {
          migratedFrom: built.version,
          migratedTo: built.version,
          stepsApplied: [],
        },
      },
    };
  }

  const prepared =
    options.prepared ?? prepareExecutionGraph(built, CURRENT_VERSION, policy);

  assertExecutionInvariants(prepared.execution);

  return { botIr, execution: prepared.execution, prepared };
}

/**
 * Full pipeline through aiogram3 codegen.
 */
export function compileGraphDocumentToPython(
  graphDocument: GraphDocumentInput,
  options: UnifiedCompileOptions = {},
): UnifiedCompileResult {
  registerAllCapabilityEmitters();

  if (options.skipValidation !== true) {
    logStep("validate_compile");
    if (options.failFast !== false) {
      assertCompileReady(graphDocument, options);
    } else {
      const gate = validateCompile(graphDocument, options);
      if (!gate.ok) {
        const first = gate.errors[0];
        throw new Error(first?.message || "Compile validation failed");
      }
    }
  }

  const { botIr, execution, prepared } = lowerGraphDocumentToExecution(
    graphDocument,
    options,
  );
  const executionPlan = buildExecutionPlan(botIr);

  if (options.allowIncomplete && execution.edges.length === 0) {
    return {
      success: false,
      python: "",
      botIr,
      executionPlan,
      execution,
      policy: prepared.policy,
      compatibilityWarnings: prepared.compatibilityWarnings,
      migration: prepared.migration,
      runtime: {
        execution,
        fsm: {},
        fsmGraph: buildFsmGraph(execution),
        callbacks: {},
        visualDb: botIr.visualDb,
      },
      empty: true,
    };
  }

  logStep("generate aiogram");
  const fsmGraph = buildFsmGraph(execution);
  const fsm = buildFSM(execution);
  const callbacks = buildCallbackRoutes(execution);
  const python = generateAiogramBot(execution, prepared.policy);

  return {
    success: true,
    python,
    botIr,
    executionPlan,
    execution,
    policy: prepared.policy,
    compatibilityWarnings: prepared.compatibilityWarnings,
    migration: prepared.migration,
    runtime: {
      execution,
      fsm,
      fsmGraph,
      callbacks,
      visualDb: botIr.visualDb,
    },
  };
}
