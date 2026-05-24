import { INTENT_COMPLEXITY, SEMANTIC_TEMPLATE_IDS } from './intentPlanner.mjs';

export const SEMANTIC_TEMPLATE_APPLIED_REASON = 'SEMANTIC_TEMPLATE_APPLIED';

/** Diagnostics hidden when a known semantic template fully replaces failed AI output. */
export const TEMPLATE_RECOVERY_SUPPRESSED_DIAGNOSTIC_CODES = Object.freeze(
  new Set([
    'AI_API',
    'AI_NETWORK_ERROR',
    'AI_RATE_LIMIT',
    'AI_BAD_RESPONSE',
    'IR_PRUNER_FAILED',
    'INTENT_NOT_SATISFIED',
    'MISSING_REQUIRED_CAPABILITY',
    'NO_VALID_IR',
    'PRIMARY_NO_PARTIAL_IR',
    'PRIMARY_PARTIAL_IR_AVAILABLE',
    'PARTIAL_IR_SALVAGED',
  ]),
);

const DETERMINISTIC_TEMPLATE_IDS = Object.freeze(
  new Set([SEMANTIC_TEMPLATE_IDS.CALCULATOR]),
);

export function shouldUseDeterministicSemanticTemplate(intentPlan) {
  return canRecoverWithSemanticTemplate(intentPlan);
}

/** @deprecated use shouldUseDeterministicSemanticTemplate — kept for tests */
export function shouldUseDeterministicSemanticTemplateSimpleOnly(intentPlan) {
  const templateId = intentPlan?.knownCapabilityTemplate;
  if (!templateId || !DETERMINISTIC_TEMPLATE_IDS.has(templateId)) return false;
  return intentPlan.complexityScore === INTENT_COMPLEXITY.SIMPLE;
}

export function canRecoverWithSemanticTemplate(intentPlan) {
  const templateId = intentPlan?.knownCapabilityTemplate;
  return Boolean(templateId && DETERMINISTIC_TEMPLATE_IDS.has(templateId));
}

export function filterTemplateRecoveryDiagnostics(diagnostics = []) {
  return diagnostics.filter((item) => !TEMPLATE_RECOVERY_SUPPRESSED_DIAGNOSTIC_CODES.has(item?.code));
}

export function semanticTemplateReadyMessage(templateId, { recovery = false } = {}) {
  if (templateId === SEMANTIC_TEMPLATE_IDS.CALCULATOR) {
    return recovery
      ? 'Готовый шаблон калькулятора подставлен вместо неполной AI-схемы.'
      : 'Собран готовый шаблон калькулятора без вызова AI.';
  }
  return recovery
    ? `Готовый шаблон «${templateId}» подставлен вместо неполной AI-схемы.`
    : `Собран готовый шаблон «${templateId}» без вызова AI.`;
}

export function semanticTemplateUserLabel(templateId) {
  if (templateId === SEMANTIC_TEMPLATE_IDS.CALCULATOR) return 'Калькулятор';
  return String(templateId || 'шаблон');
}
