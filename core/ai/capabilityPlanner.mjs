/**
 * Intent → capability planning layer with dependency injection.
 */

import {
  CAPABILITY_IDS,
  CAPABILITY_REGISTRY,
  capabilitiesForGoal,
  expandCapabilityDependencies,
} from './capabilityRegistry.mjs';
import { normalizeSemanticIntent, validateSemanticIntent } from './semanticIntent.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function str(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function unique(values) {
  return [...new Set(asArray(values).filter(Boolean).map(String))];
}

function inferCapabilitiesFromOperations(semantic) {
  const caps = new Set();
  for (const task of asArray(semantic.tasks)) {
    for (const op of asArray(task.operations)) {
      if (op.kind === 'collect') caps.add(CAPABILITY_IDS.USER_INPUT);
      if (op.kind === 'branch') caps.add(CAPABILITY_IDS.CONDITIONAL_BRANCH);
      if (op.kind === 'persist' || op.kind === 'load') caps.add(CAPABILITY_IDS.STATE_PERSISTENCE);
      if (op.kind === 'present') caps.add(CAPABILITY_IDS.MENU_ENTRYPOINT);
      if (op.kind === 'send_file') caps.add(CAPABILITY_IDS.FILE_EXCHANGE);
      if (op.kind === 'notify') caps.add(CAPABILITY_IDS.MENU_ENTRYPOINT);
    }
    if (asArray(task.operations).filter((o) => o.kind === 'collect').length > 1) {
      caps.add(CAPABILITY_IDS.INPUT_COLLECTION);
    }
    if (asArray(task.operations).some((o) => o.kind === 'notify' && o.kind !== 'end')) {
      caps.add(CAPABILITY_IDS.CONFIRMATION);
    }
  }
  for (const entity of asArray(semantic.entities)) {
    if (entity.kind === 'presentation' && entity.presentation?.inlineCatalog) {
      caps.add(CAPABILITY_IDS.CATALOG_NAVIGATION);
      caps.add(CAPABILITY_IDS.INLINE_SELECTION);
      caps.add(CAPABILITY_IDS.INLINE_CALLBACK_ROUTER);
    }
  }
  for (const ix of asArray(semantic.interactions)) {
    if (ix.trigger?.type === 'button' || ix.trigger?.type === 'callback') {
      caps.add(CAPABILITY_IDS.BUTTON_NAVIGATION);
    }
    if (ix.branch?.expression) caps.add(CAPABILITY_IDS.CONDITIONAL_BRANCH);
  }
  return [...caps];
}

function templateCapabilities(templateHint) {
  const map = {
    calculator: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.ARITHMETIC_EVAL, CAPABILITY_IDS.USER_INPUT],
    catalog: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.CATALOG_NAVIGATION, CAPABILITY_IDS.INLINE_SELECTION],
    subscription: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.SUBSCRIPTION_GATE],
    form_collection: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.INPUT_COLLECTION, CAPABILITY_IDS.CONFIRMATION],
    menu_bot: [CAPABILITY_IDS.MENU_ENTRYPOINT, CAPABILITY_IDS.BUTTON_NAVIGATION],
  };
  return map[str(templateHint)] || [];
}

/**
 * @param {object} semanticIntent — from normalizeSemanticIntent
 * @param {object} [deterministicPlan]
 */
export function planCapabilities(semanticIntent, deterministicPlan = {}) {
  const semantic = semanticIntent;
  const validation = validateSemanticIntent(semantic);
  const requested = unique([
    ...asArray(semantic.requestedCapabilities),
    ...capabilitiesForGoal(semantic.primaryGoal, semantic.botType),
    ...templateCapabilities(semantic.templateHint || deterministicPlan?.knownCapabilityTemplate),
    ...asArray(deterministicPlan?.requiredCapabilities),
    ...inferCapabilitiesFromOperations(semantic),
  ]);

  const expanded = expandCapabilityDependencies(requested);
  const notes = [];
  if (expanded.injected.length) {
    notes.push(`injected dependencies: ${expanded.injected.join(', ')}`);
  }

  return {
    ok: validation.ok,
    validation,
    requested,
    capabilities: expanded.capabilities,
    injected: expanded.injected,
    notes,
    semantic,
  };
}

export function buildCapabilityPlanFromBotIntent(botIntentPlan, deterministicPlan = {}) {
  const semantic = normalizeSemanticIntent(botIntentPlan);
  return planCapabilities(semantic, deterministicPlan);
}
