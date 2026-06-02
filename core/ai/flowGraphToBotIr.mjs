/**
 * Compile non-linear flow graph → Canonical AI IR (executable Bot IR).
 */

import { AI_TARGET_CORE_EXACT, normalizeAiCanonicalIr } from './aiCanonicalIr.mjs';
import { CAPABILITY_IDS } from './capabilityRegistry.mjs';
import { buildCapabilityPlanFromBotIntent } from './capabilityPlanner.mjs';
import { synthesizeFlowGraph } from './flowSynthesizer.mjs';
import { SEMANTIC_TEMPLATE_IDS, buildSemanticTemplateIr } from './intentPlanner.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

let handlerSeq = 0;
let scenarioSeq = 0;
let uiSeq = 0;

function resetIrIds() {
  handlerSeq = 0;
  scenarioSeq = 0;
  uiSeq = 0;
}

function nextHandlerId(prefix = 'h') {
  handlerSeq += 1;
  return `${prefix}_${handlerSeq}`;
}

function nextScenarioId(name) {
  scenarioSeq += 1;
  return `sc_${slug(name, `scenario_${scenarioSeq}`)}`;
}

function nextUiId(label = 'ui') {
  uiSeq += 1;
  return `${slug(label, 'ui')}_${uiSeq}`;
}

function scenarioStepName(task, fallback = 'step') {
  const goalSlug = slug(task?.goal, '');
  if (!goalSlug) return fallback;
  return goalSlug === 'main' ? 'entry' : goalSlug;
}

function nodeToActions(node, uiStateIds) {
  if (!node) return [];
  const type = node.type;
  const p = node.payload || {};

  if (type === 'present') {
    const uiId = uiStateIds.get(node.id) || str(p.entityId, nextUiId('screen'));
    return [{ type: 'ui_state', uiStateId: uiId }, { type: 'stop' }];
  }
  if (type === 'collect') {
    return [{ type: 'ask', question: str(p.prompt, 'Введите значение:'), varname: slug(p.field, 'value') }];
  }
  if (type === 'notify') {
    return [{ type: 'message', text: str(p.text, '...') }];
  }
  if (type === 'remember') {
    return [{ type: 'remember', varname: slug(p.field, 'var'), value: str(p.value, '{text}') }];
  }
  if (type === 'persist') {
    const actionType = p.scope === 'session' ? 'save' : 'save_global';
    return [{ type: actionType, key: str(p.key), value: str(p.value) }];
  }
  if (type === 'load') {
    return [{ type: 'get', key: str(p.key), varname: slug(p.field, 'loaded') }];
  }
  if (type === 'send_file') {
    return [{ type: 'send_file', file: `{${slug(p.field, 'file')}}` }];
  }
  if (type === 'terminal') {
    return [{ type: 'stop' }];
  }
  if (type === 'branch') {
    return [{
      type: 'condition',
      cond: str(p.expression, 'true'),
      then: [],
      else: [],
    }];
  }
  return [];
}

function linearizeSubgraph(nodes, edges, startId, uiStateIds) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outEdges = new Map();
  for (const e of edges) {
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from).push(e);
  }

  const actions = [];
  const scenarioSteps = [];
  const visited = new Set();
  let current = startId;

  while (current && !visited.has(current)) {
    visited.add(current);
    const node = byId.get(current);
    if (!node) break;

    if (node.type === 'branch') {
      const outs = asArray(outEdges.get(current));
      const trueEdge = outs.find((e) => e.kind === 'true');
      const falseEdge = outs.find((e) => e.kind === 'false');
      const thenActions = trueEdge ? linearizeSubgraph(nodes, edges, trueEdge.to, uiStateIds).actions : [];
      const elseActions = falseEdge ? linearizeSubgraph(nodes, edges, falseEdge.to, uiStateIds).actions : [];
      actions.push({
        type: 'condition',
        cond: str(node.payload?.expression, 'true'),
        then: thenActions.length ? thenActions : [{ type: 'message', text: 'OK' }],
        ...(elseActions.length ? { else: elseActions } : {}),
      });
      break;
    }

    if (node.type === 'branch_arm') {
      const outs = asArray(outEdges.get(current));
      current = outs[0]?.to;
      continue;
    }

    if (node.type === 'merge') break;

    if (node.type === 'task_entry') {
      const outs = asArray(outEdges.get(current));
      current = outs[0]?.to;
      continue;
    }

    if (node.type === 'interaction' || node.type === 'entry' || node.type === 'delegate') {
      const outs = asArray(outEdges.get(current));
      current = outs[0]?.to;
      continue;
    }

    const nodeActions = nodeToActions(node, uiStateIds);
    if (node.type === 'collect') {
      scenarioSteps.push({
        id: `step_${slug(node.payload?.field, scenarioSteps.length + 1)}`,
        name: slug(node.payload?.field, `шаг_${scenarioSteps.length + 1}`),
        actions: [...nodeActions, { type: 'stop' }],
      });
    } else {
      actions.push(...nodeActions);
    }

    const outs = asArray(outEdges.get(current)).filter((e) => e.kind === 'flow' || !e.kind);
    if (node.type === 'terminal' || !outs.length) break;
    current = outs[0].to;
  }

  return { actions, scenarioSteps };
}

function buildUiStatesFromGraph(flowGraph, semantic) {
  const uiStates = [];
  const uiStateIds = new Map();

  for (const node of asArray(flowGraph.nodes)) {
    if (node.type !== 'present') continue;
    const p = node.payload || {};
    const uiId = str(p.entityId, nextUiId('screen'));
    uiStateIds.set(node.id, uiId);
    const state = {
      id: uiId,
      message: str(p.message),
      ...(asArray(p.buttons).length ? { buttons: asArray(p.buttons).join(', ') } : {}),
    };
    if (p.inlineCatalog?.key) {
      state.inlineDb = {
        key: str(p.inlineCatalog.key),
        callbackPrefix: str(p.inlineCatalog.callbackPrefix, 'item:'),
        backText: str(p.inlineCatalog.backText, 'Назад'),
        backCallback: str(p.inlineCatalog.backCallback, 'back'),
        columns: String(p.inlineCatalog.columns || '1'),
      };
    }
    uiStates.push(state);
  }

  for (const entity of asArray(semantic.entities)) {
    if (entity.kind !== 'presentation' || !entity.presentation) continue;
    if (uiStates.some((u) => u.id === entity.id)) continue;
    uiStateIds.set(entity.id, entity.id);
    uiStates.push({
      id: entity.id,
      message: str(entity.presentation.message),
      ...(asArray(entity.presentation.buttons).length
        ? { buttons: asArray(entity.presentation.buttons).join(', ') }
        : {}),
    });
  }

  return { uiStates, uiStateIds };
}

/**
 * @param {object} flowGraph
 * @param {object} semantic
 * @param {object} capabilityPlan
 * @param {object} [deterministicPlan]
 */
export function compileFlowGraphToBotIr(flowGraph, semantic, capabilityPlan, deterministicPlan = {}) {
  resetIrIds();
  const { uiStates, uiStateIds } = buildUiStatesFromGraph(flowGraph, semantic);
  const handlers = [];
  const scenarios = [];
  const transitions = [];

  const capabilitySet = new Set(asArray(capabilityPlan.capabilities));

  if (capabilitySet.has(CAPABILITY_IDS.INLINE_CALLBACK_ROUTER) || capabilitySet.has(CAPABILITY_IDS.INLINE_SELECTION)) {
    const hasInline = uiStates.some((u) => u.inlineDb);
    if (hasInline && !handlers.some((h) => h.type === 'callback' && h.trigger === '')) {
      handlers.push({
        id: nextHandlerId('inline'),
        type: 'callback',
        trigger: '',
        actions: [
          { type: 'remember', varname: 'выбор', value: 'callback_data' },
          { type: 'message', text: 'Вы выбрали: {выбор}' },
          { type: 'stop' },
        ],
      });
    }
  }

  for (const ix of asArray(semantic.interactions)) {
    const trigger = ix.trigger || { type: 'start' };
    const task = asArray(semantic.tasks).find((t) => t.id === ix.taskId);
    if (!task) continue;

    const subStart = flowGraph.taskSubgraphs?.[task.id]?.entryId;
    const subNodes = asArray(flowGraph.nodes);
    const subEdges = asArray(flowGraph.edges);
    const linear = linearizeSubgraph(subNodes, subEdges, subStart, uiStateIds);

    if (linear.scenarioSteps.length || linear.actions.some((a) => a.type === 'ask')) {
      const scenarioName = slug(task.goal, task.id);
      const scenario = {
        id: nextScenarioId(task.goal),
        name: scenarioName,
        steps: linear.scenarioSteps.length
          ? linear.scenarioSteps
          : [{
            id: 'step_1',
            name: scenarioStepName(task, scenarioName === 'main' ? 'entry' : 'step'),
            actions: [...linear.actions, { type: 'stop' }],
          }],
      };
      scenarios.push(scenario);

      if (trigger.type === 'start') {
        const startActions = [];
        const present = task.operations.find((o) => o.kind === 'present');
        if (present) {
          const uiId = uiStateIds.get(present.entityId) || present.entityId;
          startActions.push({ type: 'ui_state', uiStateId: uiId });
        } else if (uiStates.length) {
          startActions.push({ type: 'ui_state', uiStateId: uiStates[0].id });
        } else {
          startActions.push({ type: 'message', text: str(semantic.summary, 'Привет!') });
        }
        startActions.push({ type: 'run_scenario', target: scenario.name });
        handlers.push({
          id: nextHandlerId('start'),
          type: 'start',
          trigger: '',
          actions: startActions,
        });
        transitions.push({ from: handlers[handlers.length - 1].id, to: scenario.id, type: 'run_scenario' });
      } else if (trigger.type === 'button' || trigger.type === 'callback') {
        const hId = nextHandlerId('cb');
        handlers.push({
          id: hId,
          type: 'callback',
          trigger: str(trigger.value || ix.label),
          actions: [{ type: 'run_scenario', target: scenario.name }],
        });
        transitions.push({ from: hId, to: scenario.id, type: 'run_scenario' });
      } else if (trigger.type === 'command') {
        handlers.push({
          id: nextHandlerId('cmd'),
          type: 'command',
          trigger: str(trigger.value).replace(/^\/+/, '') || 'help',
          actions: [{ type: 'run_scenario', target: scenario.name }],
        });
      } else if (trigger.type === 'text') {
        handlers.push({
          id: nextHandlerId('text'),
          type: 'text',
          trigger: '',
          actions: [{ type: 'run_scenario', target: scenario.name }],
        });
      }
    } else {
      const actions = [...linear.actions];
      if (!actions.some((a) => a.type === 'stop')) actions.push({ type: 'stop' });
      if (trigger.type === 'start') {
        handlers.push({ id: nextHandlerId('start'), type: 'start', trigger: '', actions });
      } else if (trigger.type === 'button' || trigger.type === 'callback') {
        handlers.push({
          id: nextHandlerId('cb'),
          type: 'callback',
          trigger: str(trigger.value || ix.label),
          actions,
        });
      }
    }
  }

  if (!handlers.some((h) => h.type === 'start')) {
    handlers.unshift({
      id: nextHandlerId('start'),
      type: 'start',
      trigger: '',
      actions: [
        { type: 'message', text: str(semantic.summary, 'Привет!') },
        { type: 'stop' },
      ],
    });
  }

  return normalizeAiCanonicalIr({
    irVersion: 1,
    targetCore: AI_TARGET_CORE_EXACT,
    compatibilityMode: `${AI_TARGET_CORE_EXACT} exact`,
    intent: {
      primary: str(semantic.primaryGoal, semantic.summary),
      botType: str(semantic.botType || deterministicPlan?.botType),
      semanticTemplate: str(semantic.templateHint || deterministicPlan?.knownCapabilityTemplate),
      plannedFrom: 'capability_flow_graph',
      capabilities: [...capabilitySet],
      flowGraphNonLinear: Boolean(flowGraph.nonLinear),
    },
    state: { globals: asArray(semantic.globals).map((g) => ({ name: g.name, value: g.value })) },
    handlers,
    blocks: [],
    scenarios,
    transitions,
    uiStates,
    meta: {
      compiledFrom: 'semantic_capability_planner',
      capabilityPlan: capabilityPlan.capabilities,
      injectedCapabilities: capabilityPlan.injected,
    },
  });
}

/**
 * Full deterministic path: Bot Intent Plan → capability plan → flow graph → Bot IR.
 */
export function compileSemanticIntentToBotIr(botIntentPlan, deterministicPlan = {}) {
  const templateHint = str(botIntentPlan?.templateHint || deterministicPlan?.knownCapabilityTemplate);
  if (
    templateHint &&
    Object.values(SEMANTIC_TEMPLATE_IDS).includes(templateHint) &&
    !asArray(botIntentPlan?.tasks).length &&
    !asArray(botIntentPlan?.flows).length &&
    !asArray(botIntentPlan?.interactions).length
  ) {
    return buildSemanticTemplateIr(
      { ...deterministicPlan, knownCapabilityTemplate: templateHint },
      { prompt: botIntentPlan?.summary },
    );
  }

  const capabilityPlan = buildCapabilityPlanFromBotIntent(botIntentPlan, deterministicPlan);
  if (!capabilityPlan.ok) {
    const fallback = buildSemanticTemplateIr(deterministicPlan, { prompt: botIntentPlan?.summary });
    fallback.meta = { ...(fallback.meta || {}), capabilityPlanFailed: true };
    return fallback;
  }

  const flowGraph = synthesizeFlowGraph(capabilityPlan);
  return compileFlowGraphToBotIr(flowGraph, capabilityPlan.semantic, capabilityPlan, deterministicPlan);
}
