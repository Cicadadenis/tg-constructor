import assert from 'node:assert/strict';
import test from 'node:test';
import { intentPlanner } from '../ai/intentPlanner.mjs';
import {
  canRecoverWithSemanticTemplate,
  filterTemplateRecoveryDiagnostics,
  shouldUseDeterministicSemanticTemplate,
  shouldUseDeterministicSemanticTemplateSimpleOnly,
} from '../ai/deterministicSemanticTemplate.mjs';

test('бот калькулятор uses deterministic template path', () => {
  const plan = intentPlanner('бот калькулятор');
  assert.equal(plan.botType, 'calculator');
  assert.equal(plan.knownCapabilityTemplate, 'calculator');
  assert.equal(plan.complexityScore, 'SIMPLE');
  assert.equal(shouldUseDeterministicSemanticTemplate(plan), true);
  assert.equal(canRecoverWithSemanticTemplate(plan), true);
});

test('complex calculator prompt still uses deterministic template path', () => {
  const plan = intentPlanner(
    'калькулятор с интеграцией оплаты, админкой, ролями, webhook api и рассылкой для сегментов пользователей',
  );
  assert.equal(plan.botType, 'calculator');
  assert.equal(shouldUseDeterministicSemanticTemplate(plan), true);
  assert.equal(shouldUseDeterministicSemanticTemplateSimpleOnly(plan), false);
  assert.equal(canRecoverWithSemanticTemplate(plan), true);
});

test('filterTemplateRecoveryDiagnostics removes AI and pruner noise', () => {
  const filtered = filterTemplateRecoveryDiagnostics([
    { code: 'AI_API', message: 'no credits' },
    { code: 'IR_PRUNER_FAILED', message: 'no snapshot' },
    { code: 'SEMANTIC_TEMPLATE_READY', message: 'ok', severity: 'info' },
  ]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].code, 'SEMANTIC_TEMPLATE_READY');
});
