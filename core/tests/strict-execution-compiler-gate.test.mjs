import assert from 'node:assert/strict';
import test from 'node:test';

import '../node_manifest/init.mjs';
import {
  runStrictExecutionCompilerGate,
  StrictExecutionCompilerError,
} from '../compiler/strictExecutionCompilerGate.mjs';
import { compileFlowGraphToExecutionIr } from '../ai/executionGraphCompiler.mjs';

test('runStrictExecutionCompilerGate rejects unknown planner types', () => {
  assert.throws(
    () =>
      runStrictExecutionCompilerGate({
        nodes: [{ id: 'u', type: 'not_a_real_planner_type_xyz', payload: {} }],
        edges: [],
      }),
    StrictExecutionCompilerError,
  );
});

test('runStrictExecutionCompilerGate rejects intent-only types', () => {
  assert.throws(
    () =>
      runStrictExecutionCompilerGate({
        nodes: [{ id: 'sc', type: 'scenario', payload: {} }],
        edges: [],
      }),
    StrictExecutionCompilerError,
  );
});

test('runStrictExecutionCompilerGate rejects missing edge endpoints', () => {
  try {
    runStrictExecutionCompilerGate({
      nodes: [{ id: 'a', type: 'message', payload: { text: 'hi' } }],
      edges: [{ id: 'e1', from: 'a', to: 'missing', kind: 'flow' }],
    });
    assert.fail('expected StrictExecutionCompilerError');
  } catch (err) {
    assert.ok(err instanceof StrictExecutionCompilerError);
    assert.ok(err.issues.some((i) => i.includes('missing')));
  }
});

test('compileFlowGraphToExecutionIr uses strict gate before IR build', () => {
  const plan = compileFlowGraphToExecutionIr({
    nodes: [
      { id: 'a', type: 'notify', payload: { text: 'ok' } },
      { id: 'b', type: 'terminal', payload: {} },
    ],
    edges: [{ from: 'a', to: 'b', kind: 'flow' }],
  });
  assert.ok(plan.entryStepId);
  assert.ok(plan.steps.length > 0);
});
