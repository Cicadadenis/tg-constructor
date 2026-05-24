import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractBotIntentPlanFromRaw,
  normalizeBotIntentPlan,
  validateBotIntentPlan,
} from '../ai/botIntentPlan.mjs';
import { compileIntentPlanToBotIr } from '../ai/intentToBotIr.mjs';
import { compileBotIrToExecutableGraph } from '../ai/graphCompiler.mjs';
import { intentPlanner } from '../ai/intentPlanner.mjs';
import {
  runSemanticAiPipeline,
  runSemanticPlanningPipeline,
  runTemplateGraphPipeline,
} from '../ai/semanticAiPipeline.mjs';
import { extractPartialBotIrFromLlmStream } from '../ai/intentPlanLlm.mjs';
import {
  shouldUseDeterministicSemanticTemplate,
} from '../ai/deterministicSemanticTemplate.mjs';

test('extractBotIntentPlanFromRaw rejects legacy stacks output', () => {
  const raw = '[{"id":"s0","x":40,"y":0,"blocks":[{"type":"bot","props":{"token":"x"}}]}]';
  assert.equal(extractBotIntentPlanFromRaw(raw), null);
});

test('extractBotIntentPlanFromRaw rejects Canonical IR from AI', () => {
  const raw = '{"irVersion":1,"handlers":[{"id":"h1","type":"start","trigger":"","actions":[]}],"scenarios":[]}';
  assert.equal(extractBotIntentPlanFromRaw(raw), null);
});

test('planner compiles intent plan to Bot IR with handlers', () => {
  const plan = normalizeBotIntentPlan({
    intentPlanVersion: 1,
    summary: 'Test bot',
    primaryGoal: 'test',
    screens: [{ id: 'ui_start', message: 'Hi', buttons: ['Go'] }],
    flows: [{
      id: 'flow_main',
      name: 'main',
      trigger: { type: 'start' },
      steps: [
        { kind: 'show_screen', screenId: 'ui_start' },
        { kind: 'end' },
      ],
    }],
  });
  const ir = compileIntentPlanToBotIr(plan, intentPlanner('привет'));
  assert.ok(Array.isArray(ir.handlers) && ir.handlers.length > 0);
  assert.ok(Array.isArray(ir.uiStates) && ir.uiStates.length > 0);
});

test('compiler builds executable stacks only from valid Bot IR', () => {
  const deterministic = intentPlanner('бот калькулятор');
  const templateResult = runTemplateGraphPipeline(deterministic, { prompt: 'бот калькулятор' });
  assert.equal(templateResult.ok, true);
  assert.ok(Array.isArray(templateResult.stacks) && templateResult.stacks.length > 0);
  assert.ok(templateResult.canonicalIr);
});

test('semantic pipeline end-to-end from Bot Intent Plan JSON', () => {
  const raw = `{
    "intentPlanVersion": 2,
    "summary": "Echo bot",
    "primaryGoal": "echo",
    "tasks": [{
      "id": "t_echo",
      "goal": "echo",
      "operations": [
        {"kind": "notify", "text": "Привет!"},
        {"kind": "end"}
      ]
    }],
    "interactions": [{"id": "ix", "trigger": {"type": "start"}, "taskId": "t_echo"}]
  }`;
  const extracted = extractBotIntentPlanFromRaw(raw);
  assert.ok(extracted?.plan);
  const validation = validateBotIntentPlan(extracted.plan);
  assert.equal(validation.ok, true);
  const deterministic = intentPlanner('эхо бот');
  const result = runSemanticAiPipeline(extracted.plan, deterministic, { prompt: 'эхо бот' });
  assert.equal(result.ok, true);
  assert.ok(result.stacks?.length > 0);
});

test('simple menu bot uses deterministic template path', () => {
  const plan = intentPlanner('бот меню с кнопками помощь');
  assert.equal(plan.knownCapabilityTemplate, 'menu_bot');
  assert.equal(shouldUseDeterministicSemanticTemplate(plan), true);
});

test('compiler rejects empty invalid IR', () => {
  const compiled = compileBotIrToExecutableGraph({ irVersion: 2, handlers: [], scenarios: [], uiStates: [] });
  assert.equal(compiled.ok, false);
});

test('partial stream compiles Bot Intent Plan only, rejects Canonical IR', () => {
  const irFromPlan = extractPartialBotIrFromLlmStream(
    '{"intentPlanVersion":2,"summary":"x","tasks":[{"id":"t","goal":"m","operations":[{"kind":"notify","text":"hi"},{"kind":"end"}]}],"interactions":[{"id":"ix","trigger":{"type":"start"},"taskId":"t"}]}',
    intentPlanner('привет'),
  );
  assert.ok(irFromPlan?.handlers?.length);
  const irFromLegacy = extractPartialBotIrFromLlmStream(
    '{"irVersion":1,"handlers":[{"id":"h1","type":"start","trigger":"","actions":[]}]}',
  );
  assert.equal(irFromLegacy, null);
});

test('runSemanticPlanningPipeline alias matches semantic pipeline', () => {
  const plan = {
    intentPlanVersion: 2,
    summary: 'Menu',
    tasks: [{
      id: 't_main',
      goal: 'main',
      operations: [{ kind: 'notify', text: 'OK' }, { kind: 'end' }],
    }],
    interactions: [{ id: 'ix', trigger: { type: 'start' }, taskId: 't_main' }],
  };
  const det = intentPlanner('меню');
  const a = runSemanticAiPipeline(plan, det, { prompt: 'меню' });
  const b = runSemanticPlanningPipeline(plan, det, { prompt: 'меню' });
  assert.equal(a.ok, b.ok);
  assert.equal(a.pipeline, b.pipeline);
});
