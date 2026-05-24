/**
 * Planner entry: Bot Intent Plan → capability plan → flow graph → Bot IR (deterministic).
 */

import { normalizeBotIntentPlan } from './botIntentPlan.mjs';
import { compileSemanticIntentToBotIr } from './flowGraphToBotIr.mjs';

/**
 * @param {object} botIntentPlan
 * @param {object} [deterministicPlan]
 */
export function compileIntentPlanToBotIr(botIntentPlan, deterministicPlan = {}) {
  const plan = normalizeBotIntentPlan(botIntentPlan);
  return compileSemanticIntentToBotIr(plan, deterministicPlan);
}
