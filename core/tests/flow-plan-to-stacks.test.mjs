import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStacksFromPrompt } from '../ai/flowPlanToStacks.mjs';
import { FLOW_NICHE_IDS } from '../ai/flowIntentExtensions.mjs';

test('onboarding prompt builds connected stack', () => {
  const { stacks, meta } = buildStacksFromPrompt('Сделай onboarding flow');
  assert.equal(stacks.length, 1);
  const blocks = stacks[0].blocks;
  assert.ok(blocks.length >= 5);
  assert.equal(blocks[0].type, 'start');
  assert.ok(blocks.some((b) => b.type === 'delay'));
  assert.equal(meta.niche, FLOW_NICHE_IDS.ONBOARDING);
  assert.equal(meta.edgeCount, blocks.length - 1);
});

test('salon funnel prompt builds ask and condition', () => {
  const { stacks, meta } = buildStacksFromPrompt('Сделай автоворонку для салона');
  const types = stacks[0].blocks.map((b) => b.type);
  assert.ok(types.includes('ask'));
  assert.ok(types.includes('condition'));
  assert.equal(meta.niche, FLOW_NICHE_IDS.SALON_FUNNEL);
});
