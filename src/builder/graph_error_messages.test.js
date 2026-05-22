import assert from 'node:assert/strict';
import {
  normalizeGraphError,
  normalizeConnectionError,
  inferGraphErrorCode,
  sanitizeRawErrorText,
  groupGraphErrorsForDisplay,
} from './graph_error_messages.js';

assert.equal(inferGraphErrorCode('GRAPH_IR_VALIDATION', ''), 'GRAPH_IR_VALIDATION');
assert.equal(inferGraphErrorCode('', 'Validation failed for proposed insertion'), 'PROPOSED_INSERTION_FAILED');
assert.equal(inferGraphErrorCode('', 'Connection already exists'), 'duplicate_edge');

const conn = normalizeConnectionError('start: terminal node has no outputs', {
  lang: 'ru',
  sourceType: 'start',
  targetType: 'message',
});
assert.ok(!conn.title.includes('terminal'));
assert.ok(conn.fix.includes('Старт') || conn.fix.includes('Ответ'));

const compile = normalizeGraphError({
  code: 'MissingCallbackHandlerError',
  message: 'Нет handler для callback_data «buy»',
  nodeId: 'n1',
}, { lang: 'ru' });
assert.ok(compile.title.includes('buy') || compile.title.includes('кнопк'));
assert.ok(compile.cause);
assert.ok(compile.fix);

assert.equal(sanitizeRawErrorText('GRAPH_COMPILE_GATE: blocked'), 'blocked');

const grouped = groupGraphErrorsForDisplay([
  { code: 'orphan_node', nodeId: 'a' },
  { code: 'orphan_node', nodeId: 'b' },
], { lang: 'ru' });
assert.equal(grouped.length, 1);
assert.equal(grouped[0].count, 2);

const massOrphans = groupGraphErrorsForDisplay(
  Array.from({ length: 12 }, (_, i) => ({ code: 'dangling_entry', nodeId: `n${i}` })),
  { lang: 'ru' },
);
assert.equal(massOrphans.length, 1);
assert.equal(massOrphans[0].code, 'corrupt_graph_shell');
assert.ok(massOrphans[0].count >= 8);

console.log('graph_error_messages.test.js: ok');
