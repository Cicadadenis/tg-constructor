import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlowCardViewModel, sortFlowItems } from './flowCardModel.js';

test('buildFlowCardViewModel includes title and status', () => {
  const vm = buildFlowCardViewModel({
    id: 'a',
    name: 'Welcome Bot',
    status: 'active',
    triggerLabel: '/start',
    triggerType: 'start',
    nodeCount: 5,
    channel: 'telegram',
    updatedAtIso: new Date().toISOString(),
  }, 'en');
  assert.equal(vm.title, 'Welcome Bot');
  assert.equal(vm.statusLabel, 'Active');
  assert.ok(vm.description.includes('5'));
});

test('sortFlowItems by name', () => {
  const sorted = sortFlowItems([
    { name: 'Zeta', updatedAtIso: '2020-01-01' },
    { name: 'Alpha', updatedAtIso: '2024-01-01' },
  ], 'name', 'asc');
  assert.equal(sorted[0].name, 'Alpha');
});
