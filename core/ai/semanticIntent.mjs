/**
 * Semantic intent model: entities, tasks, interactions (not screen-centric).
 * Adapts legacy Bot Intent Plan v1 (screens/flows) into unified semantic shape.
 */

import { BOT_INTENT_PLAN_VERSION } from './botIntentPlan.mjs';
import { capabilitiesForGoal } from './capabilityRegistry.mjs';

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

function legacyStepToOp(step, index) {
  if (!isObject(step)) return null;
  const kind = str(step.kind);
  if (kind === 'message') return { kind: 'notify', text: step.text };
  if (kind === 'ask') return { kind: 'collect', field: step.field, prompt: step.question };
  if (kind === 'end') return { kind: 'end' };
  if (kind === 'remember') return { kind: 'remember', field: step.field, value: step.value };
  return { kind: 'notify', text: str(step.text, '...') };
}

function normalizeTrigger(trigger, fallback = 'start') {
  if (!isObject(trigger)) return { type: fallback, value: '' };
  const type = str(trigger.type, fallback);
  return { type, value: str(trigger.value || trigger.label) };
}

function normalizeOperation(op, index) {
  if (!isObject(op)) return null;
  const kind = str(op.kind || op.type);
  if (!kind) return null;
  const base = { id: str(op.id, `op_${index + 1}`), kind };
  if (kind === 'collect') {
    return { ...base, field: slug(op.field || op.varname, `field_${index + 1}`), prompt: str(op.prompt || op.question) };
  }
  if (kind === 'notify') return { ...base, text: str(op.text || op.message) };
  if (kind === 'remember') return { ...base, field: slug(op.field, `var_${index + 1}`), value: str(op.value, '{text}') };
  if (kind === 'persist') return { ...base, scope: str(op.scope, 'global'), key: str(op.key), value: str(op.value) };
  if (kind === 'load') return { ...base, key: str(op.key), field: slug(op.field, `loaded_${index + 1}`) };
  if (kind === 'branch') {
    return {
      ...base,
      expression: str(op.expression || op.when),
      ifTrue: asArray(op.ifTrue || op.then).map((s, i) => normalizeOperation(s, i)).filter(Boolean),
      ifFalse: asArray(op.ifFalse || op.else).map((s, i) => normalizeOperation(s, i)).filter(Boolean),
    };
  }
  if (kind === 'send_file') return { ...base, field: slug(op.field, 'file') };
  if (kind === 'end') return base;
  return base;
}

function normalizeEntity(entity, index) {
  if (!isObject(entity)) return null;
  const id = str(entity.id, `entity_${index + 1}`);
  const presentation = isObject(entity.presentation) ? {
    message: str(entity.presentation.message),
    buttons: asArray(entity.presentation.buttons),
    inlineCatalog: entity.presentation.inlineCatalog || null,
  } : null;
  return {
    id,
    kind: str(entity.kind, 'concept'),
    label: str(entity.label || entity.name, id),
    attributes: asArray(entity.attributes || entity.fields).map((a) => str(a)).filter(Boolean),
    ...(presentation ? { presentation } : {}),
  };
}

function normalizeTask(task, index) {
  if (!isObject(task)) return null;
  const id = str(task.id, `task_${index + 1}`);
  const operations = asArray(task.operations || task.steps)
    .map((op, i) => normalizeOperation(op, i))
    .filter(Boolean);
  if (!operations.length && isObject(task.collect)) {
    operations.push(...asArray(task.collect).map((c, i) => normalizeOperation({ kind: 'collect', ...c }, i)).filter(Boolean));
  }
  return {
    id,
    goal: str(task.goal || task.name, id),
    entityId: str(task.entityId || task.entity),
    operations,
  };
}

function normalizeInteraction(ix, index) {
  if (!isObject(ix)) return null;
  const id = str(ix.id, `ix_${index + 1}`);
  return {
    id,
    kind: str(ix.kind, 'engage'),
    trigger: normalizeTrigger(ix.trigger, index === 0 ? 'start' : 'button'),
    taskId: str(ix.taskId || ix.runsTask || ix.task),
    presentEntityId: str(ix.presentEntityId || ix.entityId),
    branch: isObject(ix.branch) ? {
      expression: str(ix.branch.expression || ix.branch.when),
      ifTrueTaskId: str(ix.branch.ifTrueTaskId || ix.branch.thenTask),
      ifFalseTaskId: str(ix.branch.ifFalseTaskId || ix.branch.elseTask),
    } : null,
    label: str(ix.label),
  };
}

/** Legacy v1 screens/flows → semantic entities/tasks/interactions */
function adaptLegacyPlan(plan) {
  const entities = [];
  const tasks = [];
  const interactions = [];

  for (const [si, screen] of asArray(plan.screens).entries()) {
    entities.push({
      id: str(screen.id, `ui_${si + 1}`),
      kind: 'presentation',
      label: str(screen.message).slice(0, 48) || `Screen ${si + 1}`,
      attributes: asArray(screen.buttons),
      presentation: {
        message: str(screen.message),
        buttons: asArray(screen.buttons),
        inlineCatalog: screen.inlineCatalog || null,
      },
    });
  }

  const flowById = new Map(asArray(plan.flows).map((f) => [str(f.id), f]));

  for (const [fi, flow] of asArray(plan.flows).entries()) {
    const taskId = str(flow.id, `task_${fi + 1}`);
    const operations = [];
    for (const [sti, step] of asArray(flow.steps).entries()) {
      const kind = str(step.kind);
      if (kind === 'show_screen') {
        operations.push({ id: `op_present_${sti}`, kind: 'present', entityId: str(step.screenId, 'ui_start') });
      } else if (kind === 'ask') {
        operations.push({ id: `op_${sti}`, kind: 'collect', field: step.field, prompt: step.question });
      } else if (kind === 'message') {
        operations.push({ id: `op_${sti}`, kind: 'notify', text: step.text });
      } else if (kind === 'remember') {
        operations.push({ id: `op_${sti}`, kind: 'remember', field: step.field, value: step.value });
      } else if (kind === 'get') {
        operations.push({ id: `op_${sti}`, kind: 'load', key: step.key, field: step.field });
      } else if (kind === 'save' || kind === 'save_global') {
        operations.push({ id: `op_${sti}`, kind: 'persist', scope: kind === 'save_global' ? 'global' : 'session', key: step.key, value: step.value });
      } else if (kind === 'condition') {
        operations.push({
          id: `op_${sti}`,
          kind: 'branch',
          expression: step.expression,
          ifTrue: asArray(step.ifTrue).map((s, i) => legacyStepToOp(s, i)).filter(Boolean),
          ifFalse: asArray(step.ifFalse).map((s, i) => legacyStepToOp(s, i)).filter(Boolean),
        });
      } else if (kind === 'send_file') {
        operations.push({ id: `op_${sti}`, kind: 'send_file', field: step.field });
      } else if (kind === 'end') {
        operations.push({ id: `op_${sti}`, kind: 'end' });
      } else if (kind === 'run_flow') {
        const target = flowById.get(str(step.flowId));
        if (target) operations.push({ id: `op_${sti}`, kind: 'delegate', taskId: str(target.id) });
      }
    }
    tasks.push({
      id: taskId,
      goal: str(flow.name, taskId),
      entityId: '',
      operations,
    });
    interactions.push({
      id: `ix_${taskId}`,
      kind: str(flow.trigger?.type) === 'start' ? 'entry' : 'engage',
      trigger: flow.trigger || { type: 'start' },
      taskId,
    });
  }

  for (const btn of asArray(plan.menuButtons)) {
    interactions.push({
      id: `ix_menu_${slug(btn.label, 'btn')}`,
      kind: 'engage',
      trigger: { type: 'button', value: btn.label },
      taskId: str(btn.flowId),
      label: btn.label,
    });
  }

  return { entities, tasks, interactions };
}

/**
 * @param {object} rawPlan — normalized BotIntentPlan from botIntentPlan.mjs
 */
export function normalizeSemanticIntent(rawPlan) {
  const plan = isObject(rawPlan) ? rawPlan : {};
  const hasSemantic = asArray(plan.entities).length || asArray(plan.tasks).length || asArray(plan.interactions).length;
  const legacy = !hasSemantic ? adaptLegacyPlan(plan) : null;

  const entities = (hasSemantic
    ? asArray(plan.entities).map((e, i) => normalizeEntity(e, i))
    : legacy.entities
  ).filter(Boolean);

  const tasks = (hasSemantic
    ? asArray(plan.tasks).map((t, i) => normalizeTask(t, i))
    : legacy.tasks
  ).filter(Boolean);

  const interactions = (hasSemantic
    ? asArray(plan.interactions).map((ix, i) => normalizeInteraction(ix, i))
    : legacy.interactions
  ).filter(Boolean);

  if (!interactions.length && tasks.length) {
    interactions.push({
      id: 'ix_entry',
      kind: 'entry',
      trigger: { type: 'start', value: '' },
      taskId: tasks[0].id,
    });
  }

  return {
    intentPlanVersion: plan.intentPlanVersion ?? BOT_INTENT_PLAN_VERSION,
    summary: str(plan.summary || plan.primaryGoal),
    primaryGoal: str(plan.primaryGoal || plan.summary),
    botType: str(plan.botType),
    templateHint: str(plan.templateHint),
    requestedCapabilities: asArray(plan.capabilities).map(String).filter(Boolean),
    entities,
    tasks,
    interactions,
    globals: asArray(plan.globals).map((g) => ({
      name: str(g?.name || g?.key),
      value: g?.value ?? '',
    })).filter((g) => g.name),
    constraints: isObject(plan.constraints) ? plan.constraints : {},
    legacy: Boolean(legacy),
  };
}

export function validateSemanticIntent(semantic) {
  const errors = [];
  const warnings = [];
  if (!str(semantic.summary) && !str(semantic.primaryGoal)) {
    errors.push('SemanticIntent: summary или primaryGoal обязателен');
  }
  if (!asArray(semantic.tasks).length) {
    errors.push('SemanticIntent: tasks[] не может быть пустым');
  }
  const taskIds = new Set(asArray(semantic.tasks).map((t) => t.id));
  for (const ix of asArray(semantic.interactions)) {
    if (ix.taskId && !taskIds.has(ix.taskId)) {
      warnings.push(`interaction ${ix.id}: taskId "${ix.taskId}" не найден`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function inferCapabilitiesFromSemanticIntent(semantic) {
  const explicit = asArray(semantic.requestedCapabilities);
  const fromOps = new Set();
  for (const task of asArray(semantic.tasks)) {
    for (const op of asArray(task.operations)) {
      if (op.kind === 'collect') fromOps.add('user_input');
      if (op.kind === 'branch') fromOps.add('conditional_branch');
      if (op.kind === 'persist' || op.kind === 'load') fromOps.add('state_persistence');
      if (op.kind === 'present') fromOps.add('menu_entrypoint');
      if (op.kind === 'send_file') fromOps.add('file_exchange');
    }
  }
  const fromGoal = capabilitiesForGoal(semantic.primaryGoal, semantic.botType);
  return [...new Set([...fromGoal, ...fromOps, ...explicit])];
}
