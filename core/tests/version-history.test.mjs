import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pushFlowVersion,
  listFlowVersions,
  getFlowVersion,
} from '../../src/product/saas/versionHistory.js';

const mockDoc = {
  nodes: { n1: { id: 'n1', type: 'start', data: {} } },
  edges: {},
  metadata: { revision: 1 },
};

test('version history push and list', () => {
  const pid = `test_${Date.now()}`;
  pushFlowVersion(pid, mockDoc, { kind: 'publish', label: 'Test' });
  const list = listFlowVersions(pid);
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, 'publish');
  const v = getFlowVersion(pid, list[0].id);
  assert.ok(v.snapshot.nodes.n1);
});
