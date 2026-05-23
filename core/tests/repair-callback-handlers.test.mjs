import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repairCallbackHandlersInStacks } from '../../src/constructor/graph_document/repair_callback_handlers.js';
import { buildCallbackMap } from '../codegen/ast/callbackResolver.js';

test('repair synthesizes handlers for default inline Да/Нет', () => {
  const stacks = [
    {
      id: 'main',
      blocks: [
        { id: 'st', type: 'start', props: {} },
        { id: 'inl', type: 'inline', props: { buttons: 'Да|callback_да, Нет|callback_нет' } },
        { id: 'msg', type: 'message', props: { text: 'Выберите' } },
      ],
    },
  ];
  const { stacks: repaired, modified, fixes } = repairCallbackHandlersInStacks(stacks);
  assert.equal(modified, true);
  assert.ok(fixes.length >= 2);
  const map = buildCallbackMap(repaired);
  assert.equal(map.ok, true, map.errors.map((e) => e.message).join('; '));
});

test('repair migrates legacy callback label to data', () => {
  const stacks = [
    {
      id: 'h',
      blocks: [
        { id: 'cb', type: 'callback', props: { label: 'callback_да' } },
        { id: 'm', type: 'message', props: { text: 'ok' } },
      ],
    },
    {
      id: 'main',
      blocks: [
        { id: 'inl', type: 'inline', props: { buttons: 'Да|callback_да' } },
        { id: 'msg', type: 'message', props: { text: '?' } },
      ],
    },
  ];
  const { stacks: repaired, modified } = repairCallbackHandlersInStacks(stacks);
  assert.equal(modified, true);
  assert.equal(repaired[0].blocks[0].props.data, 'callback_да');
  assert.equal(buildCallbackMap(repaired).ok, true);
});
