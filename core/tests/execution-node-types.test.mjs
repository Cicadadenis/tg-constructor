import assert from 'node:assert/strict';
import test from 'node:test';

import '../node_manifest/init.mjs';
import {
  validateExecutionIR,
  normalizeFlowGraphForExecutionIR,
  ExecutionIRValidationError,
  ALLOWED_EXECUTION_IR_NODE_TYPES,
} from '../runtime/execution/validateExecutionIR.mjs';
import { compileFlowGraphToExecutionIr } from '../ai/executionGraphCompiler.mjs';
import { isIntentOnlyBlockType } from '../ai/intentNodeRegistry.mjs';
import { synthesizeFlowGraph } from '../ai/flowSynthesizer.mjs';
import { buildCapabilityPlanFromBotIntent } from '../ai/capabilityPlanner.mjs';
import { normalizeSemanticIntent } from '../ai/semanticIntent.mjs';

test('validateExecutionIR accepts only message|input|button|action|condition', () => {
  validateExecutionIR([
    { id: 'm', type: 'message' },
    { id: 'i', type: 'input' },
    { id: 'b', type: 'button' },
    { id: 'a', type: 'action' },
    { id: 'c', type: 'condition' },
  ]);
  assert.throws(
    () => validateExecutionIR([{ id: 'x', type: 'notify' }]),
    ExecutionIRValidationError,
  );
  assert.throws(
    () => validateExecutionIR([{ id: 'x', type: 'scenario' }]),
    ExecutionIRValidationError,
  );
});

test('normalizeFlowGraphForExecutionIR maps planner types then validates', () => {
  const normalized = normalizeFlowGraphForExecutionIR({
    nodes: [
      { id: 'p', type: 'present', payload: { message: 'Hi' } },
      { id: 'c', type: 'collect', payload: { prompt: 'Name?', field: 'name' } },
      { id: 't', type: 'terminal', payload: {} },
    ],
    edges: [],
  });
  assert.equal(normalized.nodes.find((n) => n.id === 'p')?.type, 'message');
  assert.equal(normalized.nodes.find((n) => n.id === 'c')?.type, 'input');
  assert.equal(normalized.nodes.find((n) => n.id === 't')?.type, 'action');
  for (const node of normalized.nodes) {
    assert.ok(ALLOWED_EXECUTION_IR_NODE_TYPES.has(node.type));
  }
});

test('scenario throws during normalization — no silent drop', () => {
  assert.throws(
    () => normalizeFlowGraphForExecutionIR({
      nodes: [{ id: 'sc', type: 'scenario', payload: {} }],
      edges: [],
    }),
    ExecutionIRValidationError,
  );
});

test('unknown planner type throws — no fallback', () => {
  assert.throws(
    () => normalizeFlowGraphForExecutionIR({
      nodes: [{ id: 'u', type: 'totally_unknown', payload: {} }],
      edges: [],
    }),
    ExecutionIRValidationError,
  );
});

test('compileFlowGraphToExecutionIr runs strictExecutionCompilerGate', () => {
  const plan = compileFlowGraphToExecutionIr({
    nodes: [
      { id: 'a', type: 'notify', payload: { text: 'ok' } },
      { id: 'b', type: 'terminal', payload: {} },
    ],
    edges: [{ from: 'a', to: 'b', kind: 'flow' }],
  });
  assert.ok(plan.entryStepId);
});

test('synthesized flow graph compiles through strict gate', () => {
  const semantic = normalizeSemanticIntent({
    summary: 'test',
    primaryGoal: 'test',
    entities: [],
    tasks: [{
      id: 't1',
      goal: 'notify',
      operations: [{ kind: 'notify', text: 'hi' }, { kind: 'end' }],
    }],
    interactions: [{ id: 'ix', trigger: { type: 'start' }, taskId: 't1' }],
  });
  const plan = buildCapabilityPlanFromBotIntent(
    {
      intentPlanVersion: 2,
      summary: 't',
      primaryGoal: 't',
      tasks: semantic.tasks,
      interactions: semantic.interactions,
      entities: semantic.entities,
    },
    { complexity: 'SIMPLE' },
  );
  const flow = synthesizeFlowGraph(plan);
  const normalized = normalizeFlowGraphForExecutionIR(flow);
  for (const node of normalized.nodes) {
    assert.ok(
      ALLOWED_EXECUTION_IR_NODE_TYPES.has(node.type),
      `node ${node.id} has illegal type ${node.type}`,
    );
  }
  const executionIr = compileFlowGraphToExecutionIr(flow);
  assert.ok(executionIr.steps.length > 0);
});
