import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveFlowListMeta } from './flowListMeta.js';

test('deriveFlowListMeta picks start trigger', () => {
  const doc = {
    nodes: {
      s: { id: 's', type: 'start', position: { x: 0, y: 0 } },
      m: { id: 'm', type: 'message', position: { x: 0, y: 0 } },
    },
  };
  const meta = deriveFlowListMeta('en', doc);
  assert.equal(meta.triggerLabel, '/start');
  assert.equal(meta.nodeCount, 2);
  assert.equal(meta.triggerType, 'start');
});

test('deriveFlowListMeta defaults without graph', () => {
  const meta = deriveFlowListMeta('ru', null);
  assert.equal(meta.triggerLabel, 'Сценарий');
  assert.equal(meta.nodeCount, 0);
});
