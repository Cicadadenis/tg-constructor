import assert from 'node:assert/strict';
import test from 'node:test';

import '../node_manifest/init.mjs';
import {
  assertLegacyExecutionAllowed,
  assertGraphExecutionIrCompilePath,
  LegacyExecutionDisabledError,
  isLegacyExecutionEnabled,
} from '../runtime/legacyExecutionPolicy.mjs';
import { buildExecutionIrFromFlowGraph } from '../runtime/execution/buildExecutionIr.mjs';
import { compileFlowGraphToExecutionIr } from '../ai/executionGraphCompiler.mjs';
const saved = process.env.LEGACY_EXECUTION_ENABLED;

test.after(() => {
  if (saved === undefined) delete process.env.LEGACY_EXECUTION_ENABLED;
  else process.env.LEGACY_EXECUTION_ENABLED = saved;
});

test('legacy disabled by default', () => {
  delete process.env.LEGACY_EXECUTION_ENABLED;
  assert.equal(isLegacyExecutionEnabled(), false);
  assert.throws(() => assertLegacyExecutionAllowed('test'), LegacyExecutionDisabledError);
});

test('direct buildExecutionIrFromFlowGraph blocked without gate', () => {
  delete process.env.LEGACY_EXECUTION_ENABLED;
  const flow = {
    nodes: [{ id: 'm', type: 'message', payload: { text: 'hi' } }],
    edges: [],
  };
  assert.throws(
    () => buildExecutionIrFromFlowGraph(flow),
    LegacyExecutionDisabledError,
  );
});

test('compileFlowGraphToExecutionIr is allowed when legacy is off', () => {
  delete process.env.LEGACY_EXECUTION_ENABLED;
  const plan = compileFlowGraphToExecutionIr({
    nodes: [{ id: 'm', type: 'message', payload: { text: 'hi' } }],
    edges: [],
  });
  assert.equal(plan.metadata?.source, 'flow_graph');
});

test('LEGACY_EXECUTION_ENABLED=true opens capability runtime', () => {
  process.env.LEGACY_EXECUTION_ENABLED = 'true';
  assert.equal(isLegacyExecutionEnabled(), true);
  assert.doesNotThrow(() => assertGraphExecutionIrCompilePath('noop'));
  assert.doesNotThrow(() =>
    buildExecutionIrFromFlowGraph({
      nodes: [{ id: 'm', type: 'message', payload: { text: 'x' } }],
      edges: [],
    }),
  );
});

test('capability runtime entry requires legacy flag', () => {
  delete process.env.LEGACY_EXECUTION_ENABLED;
  assert.throws(
    () => assertLegacyExecutionAllowed('createRuntimeEngine'),
    LegacyExecutionDisabledError,
  );
});
