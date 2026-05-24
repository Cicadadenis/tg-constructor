/**
 * Bot Intent Plan — semantic contract for AI output (no graph nodes, stacks, or Canonical IR).
 */

import { stripThinkingFromAiRaw } from './llmOutput.js';

export const BOT_INTENT_PLAN_VERSION = 2;
export const BOT_INTENT_PLAN_VERSION_LEGACY = 1;

const FLOW_STEP_KINDS = new Set([
  'show_screen',
  'ask',
  'message',
  'remember',
  'get',
  'condition',
  'save',
  'save_global',
  'send_file',
  'run_flow',
  'end',
]);

const TRIGGER_TYPES = new Set(['start', 'button', 'command', 'text', 'inline']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function str(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function slug(raw, fallback) {
  const cleaned = str(raw)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9_]+/giu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function normalizeFencedJsonText(raw) {
  return stripThinkingFromAiRaw(raw)
    .replace(/```(?:json|javascript|js)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

function parseJsonMaybeLenient(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function findBalancedJsonCandidates(text) {
  const out = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        out.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

function isLegacyStacksPayload(value) {
  if (!Array.isArray(value)) return false;
  return value.some((item) => isObject(item) && (Array.isArray(item.blocks) || Number.isFinite(item.x)));
}

function isCanonicalIrPayload(value) {
  if (!isObject(value)) return false;
  return (
    Array.isArray(value.handlers) ||
    Array.isArray(value.scenarios) ||
    Array.isArray(value.uiStates) ||
    Number(value.irVersion) === 1
  );
}

function unwrapBotIntentPlan(value) {
  if (!isObject(value)) return null;
  if (isLegacyStacksPayload(value)) return null;
  if (isCanonicalIrPayload(value) && !Number(value.intentPlanVersion)) return null;
  if (Number(value.intentPlanVersion) === BOT_INTENT_PLAN_VERSION ||
    Number(value.intentPlanVersion) === BOT_INTENT_PLAN_VERSION_LEGACY) return value;
  if (isObject(value.botIntentPlan)) return unwrapBotIntentPlan(value.botIntentPlan);
  if (isObject(value.intentPlan) && [BOT_INTENT_PLAN_VERSION, BOT_INTENT_PLAN_VERSION_LEGACY].includes(Number(value.intentPlan.intentPlanVersion))) {
    return value.intentPlan;
  }
  if (isObject(value.plan) && [BOT_INTENT_PLAN_VERSION, BOT_INTENT_PLAN_VERSION_LEGACY].includes(Number(value.plan.intentPlanVersion))) {
    return value.plan;
  }
  return null;
}

function normalizeButtons(value) {
  if (Array.isArray(value)) return value.map((v) => str(v)).filter(Boolean);
  const text = str(value);
  if (!text) return [];
  return text.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean);
}

function normalizeTrigger(trigger, fallbackType = 'start') {
  if (!isObject(trigger)) return { type: fallbackType, value: '' };
  const type = TRIGGER_TYPES.has(str(trigger.type)) ? str(trigger.type) : fallbackType;
  return { type, value: str(trigger.value || trigger.label || trigger.trigger) };
}

function normalizeFlowStep(step, index) {
  if (!isObject(step)) return null;
  const kind = str(step.kind || step.type);
  if (!FLOW_STEP_KINDS.has(kind)) return null;
  const base = {
    id: str(step.id, `step_${index + 1}`),
    kind,
  };
  if (kind === 'show_screen') return { ...base, screenId: str(step.screenId || step.screen) };
  if (kind === 'ask') {
    return {
      ...base,
      question: str(step.question || step.prompt),
      field: slug(step.field || step.varname, `field_${index + 1}`),
    };
  }
  if (kind === 'message') return { ...base, text: str(step.text || step.message) };
  if (kind === 'remember') {
    return {
      ...base,
      field: slug(step.field || step.varname, `var_${index + 1}`),
      value: str(step.value, '{text}'),
    };
  }
  if (kind === 'get') {
    return {
      ...base,
      key: str(step.key),
      field: slug(step.field || step.varname, `loaded_${index + 1}`),
    };
  }
  if (kind === 'condition') {
    return {
      ...base,
      expression: str(step.expression || step.cond),
      ifTrue: asArray(step.ifTrue || step.then).map((s, i) => normalizeFlowStep(s, i)).filter(Boolean),
      ifFalse: asArray(step.ifFalse || step.else).map((s, i) => normalizeFlowStep(s, i)).filter(Boolean),
    };
  }
  if (kind === 'save' || kind === 'save_global') {
    return { ...base, key: str(step.key), value: str(step.value) };
  }
  if (kind === 'send_file') return { ...base, field: slug(step.field || step.varname, 'file') };
  if (kind === 'run_flow') return { ...base, flowId: str(step.flowId || step.flow) };
  return base;
}

function normalizeScreen(screen, index) {
  if (!isObject(screen)) return null;
  const id = str(screen.id, `ui_${index + 1}`);
  const message = str(screen.message || screen.text);
  if (!message) return null;
  return {
    id,
    message,
    buttons: normalizeButtons(screen.buttons || screen.buttonLabels),
    ...(isObject(screen.inlineCatalog) ? { inlineCatalog: screen.inlineCatalog } : {}),
  };
}

function normalizeFlow(flow, index) {
  if (!isObject(flow)) return null;
  const id = str(flow.id, `flow_${index + 1}`);
  const name = str(flow.name, id);
  const steps = asArray(flow.steps).map((s, i) => normalizeFlowStep(s, i)).filter(Boolean);
  if (!steps.length) return null;
  return {
    id,
    name: slug(name, id),
    trigger: normalizeTrigger(flow.trigger, index === 0 ? 'start' : 'button'),
    steps,
  };
}

function normalizeEntity(entity, index) {
  if (!isObject(entity)) return null;
  return {
    id: str(entity.id, `entity_${index + 1}`),
    kind: str(entity.kind, 'concept'),
    label: str(entity.label || entity.name),
    attributes: asArray(entity.attributes || entity.fields).map((a) => str(a)).filter(Boolean),
  };
}

function normalizeTaskOp(op, index) {
  if (!isObject(op)) return null;
  const kind = str(op.kind || op.type);
  const base = { id: str(op.id, `op_${index + 1}`), kind };
  if (kind === 'collect' || kind === 'ask') {
    return { ...base, kind: 'collect', field: slug(op.field || op.varname, `field_${index + 1}`), prompt: str(op.prompt || op.question) };
  }
  if (kind === 'notify' || kind === 'message') return { ...base, kind: 'notify', text: str(op.text || op.message) };
  if (kind === 'remember') return { ...base, field: slug(op.field, `var_${index + 1}`), value: str(op.value, '{text}') };
  if (kind === 'persist' || kind === 'save' || kind === 'save_global') {
    return { ...base, kind: 'persist', scope: kind === 'save' ? 'session' : 'global', key: str(op.key), value: str(op.value) };
  }
  if (kind === 'load' || kind === 'get') return { ...base, kind: 'load', key: str(op.key), field: slug(op.field, `loaded_${index + 1}`) };
  if (kind === 'branch' || kind === 'condition') {
    return {
      ...base,
      kind: 'branch',
      expression: str(op.expression || op.cond),
      ifTrue: asArray(op.ifTrue || op.then),
      ifFalse: asArray(op.ifFalse || op.else),
    };
  }
  if (kind === 'present' || kind === 'show_screen') return { ...base, kind: 'present', entityId: str(op.entityId || op.screenId) };
  if (kind === 'send_file') return { ...base, field: slug(op.field, 'file') };
  if (kind === 'end') return { ...base, kind: 'end' };
  if (kind === 'delegate' || kind === 'run_flow') return { ...base, kind: 'delegate', taskId: str(op.taskId || op.flowId) };
  return null;
}

function normalizeTask(task, index) {
  if (!isObject(task)) return null;
  const id = str(task.id, `task_${index + 1}`);
  return {
    id,
    goal: str(task.goal || task.name, id),
    entityId: str(task.entityId || task.entity),
    operations: asArray(task.operations).map((op, i) => normalizeTaskOp(op, i)).filter(Boolean),
  };
}

function normalizeInteraction(ix, index) {
  if (!isObject(ix)) return null;
  return {
    id: str(ix.id, `ix_${index + 1}`),
    kind: str(ix.kind, 'engage'),
    trigger: normalizeTrigger(ix.trigger, index === 0 ? 'start' : 'button'),
    taskId: str(ix.taskId || ix.runsTask || ix.task),
    label: str(ix.label),
    branch: isObject(ix.branch) ? {
      expression: str(ix.branch.expression || ix.branch.when),
      ifTrueTaskId: str(ix.branch.ifTrueTaskId || ix.branch.thenTask),
      ifFalseTaskId: str(ix.branch.ifFalseTaskId || ix.branch.elseTask),
    } : null,
  };
}

export function normalizeBotIntentPlan(plan) {
  const src = isObject(plan) ? plan : {};
  const version = Number(src.intentPlanVersion) || BOT_INTENT_PLAN_VERSION;
  return {
    intentPlanVersion: version,
    summary: str(src.summary || src.primaryGoal || src.intent?.primary),
    primaryGoal: str(src.primaryGoal || src.summary || src.intent?.primary),
    botType: str(src.botType),
    templateHint: str(src.templateHint || src.semanticTemplate),
    capabilities: asArray(src.capabilities).map(String).filter(Boolean),
    entities: asArray(src.entities).map((e, i) => normalizeEntity(e, i)).filter(Boolean),
    tasks: asArray(src.tasks).map((t, i) => normalizeTask(t, i)).filter(Boolean),
    interactions: asArray(src.interactions).map((ix, i) => normalizeInteraction(ix, i)).filter(Boolean),
    screens: asArray(src.screens).map((s, i) => normalizeScreen(s, i)).filter(Boolean),
    flows: asArray(src.flows).map((f, i) => normalizeFlow(f, i)).filter(Boolean),
    menuButtons: asArray(src.menuButtons).map((btn) => ({
      label: str(btn.label || btn.text),
      flowId: str(btn.flowId || btn.flow),
    })).filter((btn) => btn.label && btn.flowId),
    globals: asArray(src.globals || src.state?.globals).map((g) => ({
      name: str(g?.name || g?.varname || g?.key),
      value: g?.value ?? '',
    })).filter((g) => g.name),
    constraints: isObject(src.constraints) ? src.constraints : {},
  };
}

export function validateBotIntentPlan(plan) {
  const errors = [];
  const warnings = [];
  if (!isObject(plan)) return { ok: false, errors: ['BotIntentPlan: ожидался объект'], warnings };
  if (![BOT_INTENT_PLAN_VERSION, BOT_INTENT_PLAN_VERSION_LEGACY].includes(Number(plan.intentPlanVersion))) {
    errors.push(`BotIntentPlan: intentPlanVersion должен быть ${BOT_INTENT_PLAN_VERSION} или ${BOT_INTENT_PLAN_VERSION_LEGACY}`);
  }
  if (!str(plan.summary) && !str(plan.primaryGoal)) {
    errors.push('BotIntentPlan: summary или primaryGoal обязателен');
  }
  const hasSemantic = asArray(plan.tasks).length > 0;
  const hasLegacy = asArray(plan.flows).length > 0;
  if (!hasSemantic && !hasLegacy) {
    errors.push('BotIntentPlan: tasks[] или flows[] обязателен');
  }
  const screenIds = new Set(asArray(plan.screens).map((s) => str(s.id)));
  for (const [fi, flow] of asArray(plan.flows).entries()) {
    if (!str(flow.name)) errors.push(`flows[${fi}]: name обязателен`);
    if (!asArray(flow.steps).length) errors.push(`flows[${fi}]: steps[] не может быть пустым`);
    for (const [si, step] of asArray(flow.steps).entries()) {
      if (step.kind === 'show_screen' && step.screenId && !screenIds.has(step.screenId)) {
        warnings.push(`flows[${fi}].steps[${si}]: screenId "${step.screenId}" не объявлен в screens[]`);
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function extractBotIntentPlanFromRaw(raw) {
  const cleaned = normalizeFencedJsonText(raw);
  if (/\[\s*\{[^}]*"blocks"\s*:/.test(cleaned) || /\[\s*\{[^}]*"x"\s*:/.test(cleaned)) {
    return null;
  }
  const direct = unwrapBotIntentPlan(parseJsonMaybeLenient(cleaned));
  if (direct) return { plan: normalizeBotIntentPlan(direct), jsonText: cleaned };

  for (const candidate of findBalancedJsonCandidates(cleaned)) {
    const plan = unwrapBotIntentPlan(parseJsonMaybeLenient(candidate));
    if (plan) return { plan: normalizeBotIntentPlan(plan), jsonText: candidate };
  }
  return null;
}

export function buildBotIntentPlanPromptContext(deterministicPlan) {
  const plan = isObject(deterministicPlan) ? deterministicPlan : {};
  return [
    '',
    '═══ DETERMINISTIC INTENT PLAN (сервер, обязателен к учёту) ═══',
    'Сервер уже классифицировал запрос. Твой BotIntentPlan должен укладываться в budget и requiredFeatures.',
    `botType: ${plan.botType || 'informational'}`,
    `complexityScore: ${plan.complexityScore || 'SIMPLE'}`,
    `knownCapabilityTemplate: ${plan.knownCapabilityTemplate || 'menu_bot'}`,
    `requiredFeatures: ${JSON.stringify(plan.requiredFeatures || [])}`,
    `budget: ${JSON.stringify(plan.budget || {})}`,
    'Используй entities/tasks/interactions (v2), не screens/flows. Не возвращай Canonical IR, stacks, nodes, edges, x/y.',
  ].join('\n');
}

export function buildBotIntentPlanUserPrompt(prompt, deterministicPlan) {
  return [
    'Создай Semantic Bot Intent (JSON v2): entities, tasks, interactions — без screens/flows/handlers.',
    'Учти Deterministic Intent Plan ниже — не расширяй функциональность сверх budget.',
    '',
    'User prompt:',
    prompt,
    '',
    'Deterministic Intent Plan:',
    JSON.stringify({
      botType: deterministicPlan?.botType,
      requiredFeatures: deterministicPlan?.requiredFeatures,
      complexityScore: deterministicPlan?.complexityScore,
      budget: deterministicPlan?.budget,
      knownCapabilityTemplate: deterministicPlan?.knownCapabilityTemplate,
      minimalFlows: deterministicPlan?.minimalFlows,
    }, null, 2),
  ].join('\n');
}
