import assert from 'node:assert/strict';
import test from 'node:test';

import '../node_manifest/init.mjs';
import { compileFlowGraphToExecutionIr } from '../ai/executionGraphCompiler.mjs';
import {
  ExecutionContractValidationError,
  RETRY_POLICY_NONE,
} from '../node_manifest/executionContract.mjs';
import { getNodeManifestRegistry } from '../node_manifest/nodeManifestRegistry.mjs';
import { StrictExecutionCompilerError } from '../compiler/strictExecutionCompilerGate.mjs';

test('every NodeManifest declares async, idempotent, retryPolicy', () => {
  for (const manifest of getNodeManifestRegistry().list()) {
    assert.equal(typeof manifest.executionContract.async, 'boolean');
    assert.equal(typeof manifest.executionContract.idempotent, 'boolean');
    assert.ok(
      ['none', 'simple', 'durable'].includes(manifest.executionContract.retryPolicy),
    );
  }
});

test('compileFlowGraphToExecutionIr attaches executionContract to steps', () => {
  const plan = compileFlowGraphToExecutionIr({
    nodes: [
      {
        id: 'root',
        type: 'entry',
        payload: { structuralType: 'entry' },
      },
      {
        id: 'm1',
        type: 'message',
        payload: { text: 'Hello' },
      },
    ],
    edges: [{ from: 'root', to: 'm1', kind: 'flow' }],
  });

  const actionStep = plan.steps.find((s) => s.sourceNodeId === 'm1');
  assert.ok(actionStep);
  assert.ok(actionStep.executionContract);
  assert.equal(actionStep.executionContract.async, false);
  assert.equal(actionStep.executionContract.retryPolicy, RETRY_POLICY_NONE);
});

test('invalid flow types fail at compile time before Execution IR', () => {
  assert.throws(
    () =>
      compileFlowGraphToExecutionIr({
        nodes: [
          {
            id: 'x',
            type: 'not_a_real_planner_type_xyz',
            payload: {},
          },
        ],
        edges: [],
      }),
    StrictExecutionCompilerError,
  );
});
