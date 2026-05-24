import {
  INTENT_COMPLEXITY,
  SEMANTIC_TEMPLATE_IDS,
} from './intentPlanner.mjs';

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
    'INTENT_PLAN_INVALID',
    'IR_EXTRACTION_FAILED',
  ]),
);

/** Templates compiled deterministically without LLM (template-based graph generation). */
const DETERMINISTIC_TEMPLATE_IDS = Object.freeze(
  new Set(Object.values(SEMANTIC_TEMPLATE_IDS)),
);

const ALWAYS_DETERMINISTIC_TEMPLATE_IDS = Object.freeze(
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
  if (!templateId || !DETERMINISTIC_TEMPLATE_IDS.has(templateId)) return false;
  if (ALWAYS_DETERMINISTIC_TEMPLATE_IDS.has(templateId)) return true;
  return intentPlan.complexityScore === INTENT_COMPLEXITY.SIMPLE;
}

export function shouldUseTemplateGraphGeneration(intentPlan) {
  return shouldUseDeterministicSemanticTemplate(intentPlan);
}

export function filterTemplateRecoveryDiagnostics(diagnostics = []) {
  return diagnostics.filter((item) => !TEMPLATE_RECOVERY_SUPPRESSED_DIAGNOSTIC_CODES.has(item?.code));
}

export function semanticTemplateReadyMessage(templateId, { recovery = false } = {}) {
  const labels = {
    [SEMANTIC_TEMPLATE_IDS.CALCULATOR]: 'калькулятора',
    [SEMANTIC_TEMPLATE_IDS.CATALOG]: 'каталога',
    [SEMANTIC_TEMPLATE_IDS.SUBSCRIPTION]: 'подписки',
    [SEMANTIC_TEMPLATE_IDS.FORM_COLLECTION]: 'сбора формы',
    [SEMANTIC_TEMPLATE_IDS.MENU_BOT]: 'меню-бота',
  };
  const label = labels[templateId] || templateId;
  return recovery
    ? `Готовый шаблон ${label} подставлен вместо неполной AI-схемы.`
    : `Собран готовый шаблон ${label} без вызова AI.`;
}

export function semanticTemplateUserLabel(templateId) {
  const labels = {
    [SEMANTIC_TEMPLATE_IDS.CALCULATOR]: 'Калькулятор',
    [SEMANTIC_TEMPLATE_IDS.CATALOG]: 'Каталог',
    [SEMANTIC_TEMPLATE_IDS.SUBSCRIPTION]: 'Подписка',
    [SEMANTIC_TEMPLATE_IDS.FORM_COLLECTION]: 'Форма',
    [SEMANTIC_TEMPLATE_IDS.MENU_BOT]: 'Меню',
  };
  return labels[templateId] || String(templateId || 'шаблон');
}
