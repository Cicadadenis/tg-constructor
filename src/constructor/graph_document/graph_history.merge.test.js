import assert from 'node:assert/strict';
import { createOperation } from './graph_operations.js';
import { mergeOperationStreams } from './graph_history.js';

const local = [
  createOperation('AddNode', { nodeId: 'a', type: 'start' }, { id: 'op1', timestamp: 1 }),
];

const remoteOk = [
  createOperation('AddNode', { nodeId: 'b', type: 'message' }, {
    id: 'op2',
    timestamp: 2,
    baseRevision: 1,
  }),
];

const remoteStale = [
  createOperation('AddNode', { nodeId: 'c', type: 'stop' }, {
    id: 'op3',
    timestamp: 3,
    baseRevision: 99,
  }),
];

const merged = mergeOperationStreams(local, [...remoteOk, ...remoteStale], {
  localRevision: 1,
  strict: true,
});
assert.equal(merged.length, 2);

const withRejected = mergeOperationStreams(local, [...remoteOk, ...remoteStale], {
  localRevision: 1,
  strict: true,
  includeRejected: true,
});
assert.equal(withRejected.merged.length, 2);
assert.equal(withRejected.rejected.length, 1);
assert.equal(withRejected.rejected[0].reason, 'baseRevision_mismatch');

console.log('graph_history.merge.test.js: ok');
