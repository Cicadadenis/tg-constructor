import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFlowNiche,
  expandFlowPrompt,
  buildStructuredFlowPlan,
  FLOW_NICHE_IDS,
} from '../ai/flowIntentExtensions.mjs';

describe('flow intent extensions', () => {
  it('detects salon funnel niche', () => {
    assert.equal(detectFlowNiche('Сделай автоворонку для салона'), FLOW_NICHE_IDS.SALON_FUNNEL);
  });

  it('detects onboarding niche', () => {
    assert.equal(detectFlowNiche('Сделай onboarding flow'), FLOW_NICHE_IDS.ONBOARDING);
  });

  it('expands salon prompt', () => {
    const expanded = expandFlowPrompt('Салон', FLOW_NICHE_IDS.SALON_FUNNEL);
    assert.match(expanded, /салон/i);
    assert.match(expanded, /запис/i);
  });

  it('builds structured plan with sequence', () => {
    const plan = buildStructuredFlowPlan('Сделай onboarding flow');
    assert.equal(plan.niche, FLOW_NICHE_IDS.ONBOARDING);
    assert.ok(plan.sequence.length >= 4);
    assert.ok(plan.expandedPrompt.length > 10);
    assert.ok(plan.intentPlan.botType);
  });
});
