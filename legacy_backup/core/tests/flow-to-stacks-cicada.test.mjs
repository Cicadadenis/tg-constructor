import test from 'node:test';
import assert from 'node:assert/strict';
import { flowToStacks } from '../codegen/compileCore.js';
import { compileGraphToPython } from '../codegen/pipeline.js';

test('flowToStacks recognizes start handler inside cicada wrapper nodes', () => {
  const flow = {
    nodes: [
      { id: 'b', type: 'cicada', position: { x: 0, y: 20 }, data: { type: 'bot', props: { token: 'T' } } },
      { id: 's', type: 'cicada', position: { x: 0, y: 120 }, data: { type: 'start', props: {} } },
      { id: 'm', type: 'cicada', position: { x: 0, y: 162 }, data: { type: 'message', props: { text: 'Hi' } } },
    ],
    edges: [
      { id: 'e1', source: 's', target: 'm', sourceHandle: 'flow', targetHandle: 'flow' },
    ],
  };
  const stacks = flowToStacks(flow);
  const messageStack = stacks.find((s) => (s.blocks || []).some((b) => b.type === 'message'));
  assert.ok(messageStack, 'message should be in a stack chained from start');
  const idx = messageStack.blocks.findIndex((b) => b.type === 'message');
  assert.ok(idx > 0, 'message should not be stack root');
  assert.equal(messageStack.blocks[0].type, 'start');
});

test('compileGraphToPython: start → message does not abort with OUTPUT_AS_ROOT', () => {
  const flow = {
    nodes: [
      {
        id: 's',
        type: 'cicada',
        position: { x: 0, y: 0 },
        data: { type: 'start', props: {}, irId: 's', compilerId: 's', semanticId: 's' },
      },
      {
        id: 'm',
        type: 'cicada',
        position: { x: 0, y: 50 },
        data: { type: 'message', props: { text: 'Привет!' }, irId: 'm', compilerId: 'm', semanticId: 'm' },
      },
    ],
    edges: [{ id: 'e1', source: 's', target: 'm', sourceHandle: 'flow', targetHandle: 'flow' }],
  };
  const out = compileGraphToPython(flow, { strict: true, validatePython: false });
  assert.notEqual(out.aborted, true, out.compileErrors.map((e) => e.message).join('; '));
  assert.ok(!out.compileErrors.some((e) => e.code === 'OUTPUT_AS_ROOT'));
});
