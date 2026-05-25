/**
 * Bot Intent layer node / action registry.
 * Scenario is an intent-level container — never a runtime flow or execution node.
 */

import { INTENT_ONLY_NODE_TYPES } from '../runtime/execution/executionNodeTypes.mjs';

export { INTENT_ONLY_NODE_TYPES };

/** Canonical IR fields that belong to intent layer only. */
export const INTENT_IR_COLLECTIONS = Object.freeze([
  'scenarios',
  'handlers',
  'uiStates',
  'blocks',
  'transitions',
]);

/** Action types that reference scenarios (stay in Bot IR, not Execution IR). */
export const INTENT_SCENARIO_ACTION_TYPES = Object.freeze([
  'run_scenario',
  'goto_scenario',
]);

export function isIntentOnlyBlockType(type) {
  return INTENT_ONLY_NODE_TYPES.has(String(type || '').trim());
}

export function isIntentScenarioAction(action) {
  const t = String(action?.type || '').trim();
  return INTENT_SCENARIO_ACTION_TYPES.includes(t);
}

/**
 * Runtime/editor registry must NOT treat scenario as executable block.
 */
export const RUNTIME_EXCLUDED_BLOCK_TYPES = INTENT_ONLY_NODE_TYPES;
