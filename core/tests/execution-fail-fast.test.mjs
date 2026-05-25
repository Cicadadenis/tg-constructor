import assert from 'node:assert/strict';
import test from 'node:test';

import '../node_manifest/init.mjs';
import { ExecutionError } from '../runtime/execution/executionErrors.mjs';
import { buildExecutionIrFromFlowGraph } from '../runtime/execution/buildExecutionIr.mjs';
import { runStrictExecutionCompilerGate } from '../compiler/strictExecutionCompilerGate.mjs';
import { sanitizeFlowGraphForExecution } from '../ai/flowGraphSanitizer.mjs';
import { compileFlowGraphToExecutionIr } from '../ai/executionGraphCompiler.mjs';
import { withExecutionIrCompileGate } from '../runtime/legacyExecutionPolicy.mjs';

test('sanitizeFlowGraphForExecution throws on intent-only nodes', () => {
  assert.throws(
    () =>
      sanitizeFlowGraphForExecution({
        nodes: [{ id: 'sc', type: 'scenario', payload: {} }],
        edges: [],
      }),
    ExecutionError,
  );
});

test('compiler gate throws on edge to missing node', () => {
  assert.throws(
    () =>
      runStrictExecutionCompilerGate({
        nodes: [{ id: 'a', type: 'message', payload: { text: 'hi' } }],
        edges: [{ from: 'a', to: 'ghost', kind: 'flow' }],
      }),
    (err) => err.name === 'StrictExecutionCompilerError' || err instanceof ExecutionError,
  );
});

test('buildExecutionIrFromFlowGraph throws when condition has no branches', () => {
  const flow = runStrictExecutionCompilerGate({
    nodes: [
      { id: 'c', type: 'branch', payload: { expression: 'x > 0' } },
    ],
    edges: [],
  });
  assert.throws(
    () =>
      withExecutionIrCompileGate(() => buildExecutionIrFromFlowGraph(flow)),
    (err) => err instanceof ExecutionError && err.reason === 'missing_edge',
  );
});

test('ExecutionError includes node id, type, and execution path', () => {
  const err = ExecutionError.missingNode('n1', 'message', ['run', 'step_a']);
  assert.equal(err.nodeId, 'n1');
  assert.equal(err.nodeType, 'message');
  assert.deepEqual(err.executionPath, ['run', 'step_a']);
  assert.equal(err.reason, 'missing_node');
});

test('compileFlowGraphToExecutionIr rejects invalid graphs before run', () => {
  assert.throws(
    () =>
      compileFlowGraphToExecutionIr({
        nodes: [{ id: 'u', type: 'not_a_real_planner_type_xyz', payload: {} }],
        edges: [],
      }),
  );
});
