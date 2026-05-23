/**
 * Strict callback resolution — no stub handlers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileGraphToPython } from '../codegen/pipeline.js';
import { buildCallbackMap } from '../codegen/ast/callbackResolver.js';
import { flowToStacks } from '../codegen/compileCore.js';
import { validateAiogram3Graph } from '../rules/aiogram3RuleEngine.js';
import { EXAMPLE_GRAPH_FLOWS } from '../../src/examples/flows/index.js';

test('inline without callback handler → MissingCallbackHandlerError', () => {
  const flow = {
    nodes: [
      { id: 'b', type: 'cicada', position: { x: 0, y: 0 }, data: { type: 'bot', props: { token: 'T' } } },
      { id: 's', type: 'cicada', position: { x: 0, y: 1000 }, data: { type: 'start', props: {} } },
      { id: 'i', type: 'cicada', position: { x: 0, y: 1100 }, data: { type: 'inline', props: { buttons: 'X → orphan_cb' } } },
      { id: 'm', type: 'cicada', position: { x: 0, y: 1200 }, data: { type: 'message', props: { text: 'ok' } } },
    ],
    edges: [
      { id: 'e1', source: 's', target: 'i' },
      { id: 'e2', source: 'i', target: 'm' },
    ],
  };
  const rules = validateAiogram3Graph(flow);
  assert.equal(rules.ok, false);
  assert.ok(rules.errors.some((e) => e.code === 'MissingCallbackHandlerError'));

  const out = compileGraphToPython(flow, { strict: true, autoFix: false, validatePython: false });
  assert.ok(out.aborted);
  assert.ok(out.compileErrors.some((e) => e.code === 'MissingCallbackHandlerError'));

  const fixed = compileGraphToPython(flow, { strict: true, validatePython: false });
  assert.notEqual(fixed.aborted, true, fixed.compileErrors.map((e) => e.message).join('; '));
  assert.ok(fixed.code?.length, 'expected generated Python after autoFix');
  assert.ok(!fixed.compileErrors.some((e) => e.code === 'MissingCallbackHandlerError'));
  assert.match(fixed.code, /orphan_cb/);
});

test('default inline Да/Нет auto-fixes callback_да and callback_нет', () => {
  const flow = {
    nodes: [
      { id: 'b', type: 'cicada', position: { x: 0, y: 0 }, data: { type: 'bot', props: { token: 'T' } } },
      { id: 's', type: 'cicada', position: { x: 0, y: 1000 }, data: { type: 'start', props: {} } },
      {
        id: 'i',
        type: 'cicada',
        position: { x: 0, y: 1100 },
        data: { type: 'inline', props: { buttons: 'Да|callback_да, Нет|callback_нет' } },
      },
      { id: 'm', type: 'cicada', position: { x: 0, y: 1200 }, data: { type: 'message', props: { text: 'Выберите' } } },
    ],
    edges: [
      { id: 'e1', source: 's', target: 'i' },
      { id: 'e2', source: 'i', target: 'm' },
    ],
  };
  const out = compileGraphToPython(flow, { strict: true, validatePython: false });
  assert.notEqual(out.aborted, true, out.compileErrors.map((e) => e.message).join('; '));
  assert.match(out.code, /callback_да/);
  assert.match(out.code, /callback_нет/);
});

test('callbacks example resolves without stubs', () => {
  const flow = EXAMPLE_GRAPH_FLOWS.callbacks;
  const stacks = flowToStacks(flow);
  const map = buildCallbackMap(stacks, flow);
  assert.equal(map.ok, true, map.errors.map((e) => e.message).join('; '));

  const out = compileGraphToPython(flow, { strict: false, validatePython: false });
  assert.equal(out.compileErrors.length, 0);
  assert.match(out.code, /F\.data\.startswith\("run_"\)/);
  assert.match(out.code, /F\.data\.startswith\("cancel_"\)/);
  assert.doesNotMatch(out.code, /@router\.callback_query\(F\.data == "run_demo"\)[\s\S]*?await callback\.answer\(\)\s*$/m);
});

test('legacy: callback label matching required inline callback_data', () => {
  const stacks = [
    {
      id: 'h_yes',
      blocks: [
        { id: 'cb_yes', type: 'callback', props: { label: 'callback_да' } },
        { id: 'm_yes', type: 'message', props: { text: 'да' } },
      ],
    },
    {
      id: 'h_no',
      blocks: [
        { id: 'cb_no', type: 'callback', props: { label: 'callback_нет' } },
        { id: 'm_no', type: 'message', props: { text: 'нет' } },
      ],
    },
    {
      id: 's',
      blocks: [
        { id: 'st', type: 'start', props: {} },
        { id: 'inl', type: 'inline', props: { buttons: 'Да|callback_да, Нет|callback_нет' } },
        { id: 'msg', type: 'message', props: { text: 'choose' } },
      ],
    },
  ];
  const map = buildCallbackMap(stacks);
  assert.equal(map.ok, true, map.errors.map((e) => e.message).join('; '));
});

test('exact callback data via props.data matches inline', () => {
  const stacks = [
    {
      id: 'h',
      blocks: [
        { id: 'cb', type: 'callback', props: { data: 'pick_1' } },
        { id: 'm', type: 'message', props: { text: 'picked' } },
      ],
    },
    {
      id: 's',
      blocks: [
        { id: 'st', type: 'start', props: {} },
        { id: 'inl', type: 'inline', props: { buttons: 'A → pick_1' } },
        { id: 'msg', type: 'message', props: { text: 'choose' } },
      ],
    },
  ];
  const map = buildCallbackMap(stacks);
  assert.equal(map.ok, true);
});
