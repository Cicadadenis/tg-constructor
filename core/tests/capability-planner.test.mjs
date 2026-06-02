import assert from 'node:assert/strict';
import test from 'node:test';
import { expandCapabilityDependencies, CAPABILITY_IDS } from '../ai/capabilityRegistry.mjs';
import { normalizeSemanticIntent } from '../ai/semanticIntent.mjs';
import { planCapabilities } from '../ai/capabilityPlanner.mjs';
import { synthesizeFlowGraph } from '../ai/flowSynthesizer.mjs';
import { compileSemanticIntentToBotIr } from '../ai/flowGraphToBotIr.mjs';
import { intentPlanner } from '../ai/intentPlanner.mjs';

test('expandCapabilityDependencies injects menu_entrypoint before button_navigation', () => {
  const expanded = expandCapabilityDependencies([CAPABILITY_IDS.BUTTON_NAVIGATION]);
  assert.ok(expanded.capabilities.includes(CAPABILITY_IDS.MENU_ENTRYPOINT));
  assert.ok(expanded.injected.includes(CAPABILITY_IDS.MENU_ENTRYPOINT));
});

test('semantic intent v2 normalizes entities tasks interactions', () => {
  const semantic = normalizeSemanticIntent({
    intentPlanVersion: 2,
    summary: 'Order bot',
    primaryGoal: 'order_form',
    entities: [{ id: 'e1', kind: 'person', attributes: ['имя'] }],
    tasks: [{
      id: 't1',
      goal: 'order',
      operations: [{ kind: 'collect', field: 'имя', prompt: 'Имя?' }, { kind: 'end' }],
    }],
    interactions: [{ id: 'ix1', trigger: { type: 'start' }, taskId: 't1' }],
  });
  assert.equal(semantic.tasks.length, 1);
  assert.equal(semantic.interactions.length, 1);
  assert.equal(semantic.entities.length, 1);
});

test('legacy v1 screens/flows adapt to semantic model', () => {
  const semantic = normalizeSemanticIntent({
    intentPlanVersion: 1,
    summary: 'Legacy',
    flows: [{
      id: 'f1',
      name: 'main',
      trigger: { type: 'start' },
      steps: [{ kind: 'message', text: 'Hi' }, { kind: 'end' }],
    }],
  });
  assert.equal(semantic.legacy, true);
  assert.ok(semantic.tasks.length >= 1);
});

test('capability planner creates plan with injected deps', () => {
  const plan = planCapabilities(normalizeSemanticIntent({
    summary: 'Catalog',
    primaryGoal: 'catalog',
    botType: 'commerce',
    tasks: [{
      id: 't_cat',
      goal: 'browse',
      operations: [{ kind: 'present', entityId: 'e_menu' }, { kind: 'end' }],
    }],
    entities: [{
      id: 'e_menu',
      kind: 'presentation',
      presentation: { message: 'Каталог', buttons: ['Каталог'], inlineCatalog: { key: 'items' } },
    }],
    interactions: [{ id: 'ix', trigger: { type: 'start' }, taskId: 't_cat' }],
  }));
  assert.equal(plan.ok, true);
  assert.ok(plan.capabilities.includes(CAPABILITY_IDS.INLINE_SELECTION) || plan.capabilities.includes(CAPABILITY_IDS.CATALOG_NAVIGATION));
});

test('flow synthesizer produces non-linear graph for branch task', () => {
  const semantic = normalizeSemanticIntent({
    summary: 'Age',
    primaryGoal: 'age_gate',
    tasks: [{
      id: 't_age',
      goal: 'age',
      operations: [
        { kind: 'collect', field: 'возраст', prompt: 'Возраст?' },
        {
          kind: 'branch',
          expression: 'возраст >= 18',
          ifTrue: [{ kind: 'notify', text: 'OK' }, { kind: 'end' }],
          ifFalse: [{ kind: 'notify', text: 'No' }, { kind: 'end' }],
        },
      ],
    }],
    interactions: [{ id: 'ix', trigger: { type: 'start' }, taskId: 't_age' }],
  });
  const capPlan = planCapabilities(semantic);
  const graph = synthesizeFlowGraph(capPlan);
  assert.equal(graph.nonLinear, true);
  assert.ok(graph.edges.some((e) => e.kind === 'true' || e.kind === 'false'));
});

test('compileSemanticIntentToBotIr is deterministic from semantic intent', () => {
  const intent = {
    intentPlanVersion: 2,
    summary: 'Echo',
    primaryGoal: 'echo',
    tasks: [{
      id: 't1',
      goal: 'echo',
      operations: [{ kind: 'notify', text: 'Привет!' }, { kind: 'end' }],
    }],
    interactions: [{ id: 'ix', trigger: { type: 'start' }, taskId: 't1' }],
  };
  const det = intentPlanner('привет');
  const ir = compileSemanticIntentToBotIr(intent, det);
  assert.ok(ir.handlers?.length);
  assert.equal(ir.intent?.plannedFrom, 'capability_flow_graph');
});

test('compileSemanticIntentToBotIr avoids generic main step names for simple scenarios', () => {
  const intent = {
    intentPlanVersion: 2,
    summary: 'Dual menu',
    primaryGoal: 'menu',
    tasks: [
      {
        id: 't_catalog',
        goal: 'catalog',
        operations: [{ kind: 'notify', text: 'Каталог' }, { kind: 'end' }],
      },
      {
        id: 't_help',
        goal: 'help',
        operations: [{ kind: 'notify', text: 'Помощь' }, { kind: 'end' }],
      },
    ],
    interactions: [
      { id: 'ix_catalog', trigger: { type: 'button', value: 'Каталог' }, taskId: 't_catalog' },
      { id: 'ix_help', trigger: { type: 'button', value: 'Помощь' }, taskId: 't_help' },
    ],
  };
  const ir = compileSemanticIntentToBotIr(intent, intentPlanner('бот меню'));
  const stepNames = ir.scenarios.flatMap((scenario) => scenario.steps.map((step) => step.name));
  assert.deepEqual(stepNames, ['catalog', 'help']);
  assert.equal(stepNames.includes('main'), false);
});
