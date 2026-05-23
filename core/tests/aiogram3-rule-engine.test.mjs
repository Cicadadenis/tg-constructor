/**
 * Aiogram 3 rule engine tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAiogram3Graph } from '../rules/aiogram3RuleEngine.js';
import { stacksToFlow } from '../codegen/stacksFlow.js';
import { compileGraphToPython } from '../codegen/pipeline.js';

test('unknown block type is hard error', () => {
  const r = validateAiogram3Graph([{
    id: 's1',
    blocks: [{ id: 'b1', type: 'scenario', props: {} }],
  }]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'UNKNOWN_BLOCK_TYPE'));
});

test('keyboard only stack → KeyboardWithoutOutputNode', () => {
  const r = validateAiogram3Graph([{
    id: 's1',
    blocks: [
      { id: 'b0', type: 'start', props: {} },
      { id: 'b1', type: 'inline', props: { buttons: 'A → a' } },
    ],
  }]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'KeyboardWithoutOutputNode'));
});

test('FSM cannot be graph root', () => {
  const r = validateAiogram3Graph([{
    id: 's1',
    blocks: [{ id: 'b0', type: 'ask', props: { question: 'q', varname: 'x' } }],
  }]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'FSM_AS_ROOT'));
});

test('valid start + message passes', () => {
  const stacks = [{
    id: 's1',
    blocks: [
      { id: 'b0', type: 'start', props: {} },
      { id: 'b1', type: 'message', props: { text: 'hi' } },
    ],
  }];
  const r = validateAiogram3Graph(stacks);
  assert.equal(r.ok, true);
  const py = compileGraphToPython(stacksToFlow(stacks), { strict: false, validatePython: false });
  assert.ok(!py.aborted);
  assert.ok(py.code?.includes('async def'));
});

test('inline without handler is MissingCallbackHandlerError', () => {
  const r = validateAiogram3Graph([{
    id: 's1',
    blocks: [
      { id: 'b0', type: 'start', props: {} },
      { id: 'b1', type: 'inline', props: { buttons: 'Go → go_cb' } },
      { id: 'b2', type: 'message', props: { text: 'ok' } },
    ],
  }]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'MissingCallbackHandlerError'));
});
