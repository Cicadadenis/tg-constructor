import assert from 'node:assert/strict';
import { resolveExecutionPathEdgeIds } from './canvasEdgeStyles.js';

const doc = {
  edges: {
    e1: { id: 'e1', source: 'a', target: 'b' },
    e2: { id: 'e2', source: 'b', target: 'c' },
    e3: { id: 'e3', source: 'a', target: 'c' },
  },
};

assert.deepEqual(resolveExecutionPathEdgeIds(doc, ['a', 'b']), ['e1']);
assert.deepEqual(resolveExecutionPathEdgeIds(doc, ['a', 'b', 'c']).sort(), ['e1', 'e2', 'e3'].sort());

console.log('canvasEdgeStyles.test.js: ok');
