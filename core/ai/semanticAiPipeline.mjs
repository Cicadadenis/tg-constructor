/**
 * Semantic AI planning pipeline:
 *   AI → Semantic Intent (entities/tasks/interactions)
 *   → Capability Planner → Flow Synthesizer → Bot IR → Compiler → stacks
 */

import { applyIntentBudgetToIr, buildSemanticTemplateIr } from './intentPlanner.mjs';
import { normalizeBotIntentPlan, validateBotIntentPlan } from './botIntentPlan.mjs';
import { compileIntentPlanToBotIr } from './intentToBotIr.mjs';
import { compileBotIrToExecutableGraph } from './graphCompiler.mjs';
import { resolveFeatureDependencies } from './featureDependencyResolver.mjs';
import { repairIntentSatisfaction } from './intentSatisfactionValidator.mjs';
import { runDeterministicIrRepairLoop } from './irRepairEngine.mjs';
import { buildCapabilityPlanFromBotIntent } from './capabilityPlanner.mjs';
import { buildExecutionIrFromSemanticFlowGraph } from './executionIrBridge.mjs';
import { synthesizeFlowGraph } from './flowSynthesizer.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Full semantic planning: Bot Intent Plan → Bot IR → stacks.
 */
export function runSemanticPlanningPipeline(botIntentPlan, deterministicPlan, options = {}) {
  return runSemanticAiPipeline(botIntentPlan, deterministicPlan, options);
}

/**
 * Template-based generation: deterministic IntentPlan → IR → executable graph.
 */
export function runTemplateGraphPipeline(intentPlan, options = {}) {
  const templateIr = buildSemanticTemplateIr(intentPlan, { prompt: options.prompt });
  const budgeted = applyIntentBudgetToIr(templateIr, intentPlan);
  let ir = budgeted.ir;
  const diagnostics = [];
  const repairActions = [];

  if (budgeted.changed) {
    repairActions.push(...budgeted.notes.map((n) => `INTENT_BUDGET: ${n}`));
  }

  const featureResolution = resolveFeatureDependencies(ir, {
    intentPlan,
    astMode: options.astMode,
    allowedMemoryKeys: options.allowedMemoryKeys,
  });
  ir = featureResolution.ir;
  diagnostics.push(...asArray(featureResolution.diagnostics));
  repairActions.push(...asArray(featureResolution.repairActions).map((a) => `FDR: ${a}`));

  const compiled = compileBotIrToExecutableGraph(ir, options);
  return {
    ok: compiled.ok,
    canonicalIr: compiled.ir,
    stacks: compiled.stacks,
    diagnostics: [...diagnostics, ...asArray(compiled.diagnostics)],
    repairActions,
    errors: compiled.errors,
    pipeline: 'TEMPLATE',
  };
}

/**
 * AI semantic path: Semantic Intent → capability plan → Bot IR → executable graph.
 */
export function runSemanticAiPipeline(botIntentPlan, deterministicPlan, options = {}) {
  const normalizedPlan = normalizeBotIntentPlan(botIntentPlan);
  const validation = validateBotIntentPlan(normalizedPlan);
  const diagnostics = [...asArray(validation.warnings).map((message) => ({
    code: 'INTENT_PLAN_WARNING',
    severity: 'warning',
    message,
  }))];
  const repairActions = [];

  if (!validation.ok) {
    return {
      ok: false,
      canonicalIr: null,
      stacks: null,
      diagnostics: [
        ...diagnostics,
        ...validation.errors.map((message) => ({
          code: 'INTENT_PLAN_INVALID',
          severity: 'error',
          message,
        })),
      ],
      repairActions,
      errors: validation.errors,
      pipeline: 'SEMANTIC_AI',
    };
  }

  const capabilityPlan = buildCapabilityPlanFromBotIntent(normalizedPlan, deterministicPlan);
  diagnostics.push({
    code: 'CAPABILITY_PLAN_CREATED',
    severity: 'info',
    message: `Capabilities: ${capabilityPlan.capabilities.join(', ')}${capabilityPlan.injected.length ? ` (injected: ${capabilityPlan.injected.join(', ')})` : ''}`,
    details: { capabilities: capabilityPlan.capabilities, injected: capabilityPlan.injected },
  });
  if (capabilityPlan.notes.length) {
    repairActions.push(...capabilityPlan.notes.map((n) => `CAPABILITY: ${n}`));
  }

  diagnostics.push({
    code: 'INTENT_PLAN_ACCEPTED',
    severity: 'info',
    message: `Semantic intent: ${capabilityPlan.semantic.tasks.length} tasks, ${capabilityPlan.semantic.interactions.length} interactions, ${capabilityPlan.semantic.entities.length} entities.`,
  });

  const flowGraph = synthesizeFlowGraph(capabilityPlan);
  let executionIr = null;
  try {
    executionIr = buildExecutionIrFromSemanticFlowGraph(flowGraph);
    diagnostics.push({
      code: 'EXECUTION_IR_BUILT',
      severity: 'info',
      message: `Execution IR: ${executionIr.steps.length} steps, ${executionIr.barriers.length} join barriers, nonLinear=${Boolean(flowGraph.nonLinear)}.`,
      details: {
        planId: executionIr.planId,
        entryStepId: executionIr.entryStepId,
        nonLinear: flowGraph.nonLinear,
      },
    });
  } catch (e) {
    diagnostics.push({
      code: 'EXECUTION_IR_BUILD_SKIPPED',
      severity: 'warning',
      message: String(e?.message || e),
    });
  }

  let ir = compileIntentPlanToBotIr(normalizedPlan, deterministicPlan);
  if (executionIr) {
    ir = {
      ...ir,
      meta: {
        ...(ir.meta || {}),
        executionIrPlanId: executionIr.planId,
        executionIrEntryStepId: executionIr.entryStepId,
        executionIrStepCount: executionIr.steps.length,
      },
    };
  }

  const budgeted = applyIntentBudgetToIr(ir, deterministicPlan);
  ir = budgeted.ir;
  if (budgeted.changed) {
    repairActions.push(...budgeted.notes.map((n) => `INTENT_BUDGET: ${n}`));
    diagnostics.push({
      code: 'COMPLEXITY_REDUCED',
      severity: 'info',
      message: budgeted.notes.join('; ') || 'budget enforced',
    });
  }

  const intentRepair = repairIntentSatisfaction(ir, {
    prompt: options.prompt,
    intentPlan: deterministicPlan,
  });
  if (intentRepair.changed) {
    ir = applyIntentBudgetToIr(intentRepair.ir, deterministicPlan).ir;
    diagnostics.push(...asArray(intentRepair.diagnostics));
    repairActions.push(...asArray(intentRepair.repairNotes));
  }

  const featureResolution = resolveFeatureDependencies(ir, {
    intentPlan: deterministicPlan,
    astMode: options.astMode,
    allowedMemoryKeys: options.allowedMemoryKeys,
  });
  ir = featureResolution.ir;
  diagnostics.push(...asArray(featureResolution.diagnostics));
  repairActions.push(...asArray(featureResolution.repairActions).map((a) => `FDR: ${a}`));

  const repaired = runDeterministicIrRepairLoop(ir, {
    astMode: options.astMode,
    allowedMemoryKeys: options.allowedMemoryKeys,
    deadline: options.deadline,
    maxRepairPasses: options.maxRepairPasses ?? 2,
  });
  ir = repaired.ir;
  diagnostics.push(...asArray(repaired.validation?.diagnostics));
  repairActions.push(...asArray(repaired.repairNotes));

  if (!repaired.ok) {
    return {
      ok: false,
      canonicalIr: ir,
      stacks: null,
      diagnostics,
      repairActions,
      errors: ['IR semantic repair failed after capability planning'],
      pipeline: 'SEMANTIC_AI',
    };
  }

  const compiled = compileBotIrToExecutableGraph(ir, options);
  return {
    ok: compiled.ok,
    canonicalIr: compiled.ir,
    stacks: compiled.stacks,
    executionIr,
    flowGraph,
    diagnostics: [...diagnostics, ...asArray(compiled.diagnostics)],
    repairActions,
    errors: compiled.errors,
    pipeline: 'SEMANTIC_AI',
  };
}
