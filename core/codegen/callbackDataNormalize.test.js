import assert from 'node:assert/strict';
import { parseInlineRows } from './keyboards.js';
import {
  implicitCallbackFromButtonLabel,
  resolveInlineButtonCallback,
  expandCallbackMatchKeys,
  callbackKeysMatch,
  normalizeCallbackData,
} from './callbackDataNormalize.js';
import { buildCallbackMap } from './ast/callbackResolver.js';

assert.equal(implicitCallbackFromButtonLabel('Да'), 'callback_да');
assert.equal(resolveInlineButtonCallback('Да', ''), 'callback_да');
assert.equal(resolveInlineButtonCallback('Да', 'callback_да'), 'callback_да');
assert.equal(resolveInlineButtonCallback('OK', ''), 'OK');

const rows = parseInlineRows('Да, Нет');
assert.equal(rows[0][0].callback_data, 'callback_да');
assert.equal(rows[0][1].callback_data, 'callback_нет');

assert.equal(callbackKeysMatch('да', 'callback_да'), true);
assert.equal(callbackKeysMatch('да', 'Да'), true);
assert.equal(callbackKeysMatch('callback_да', 'да'), true);
assert.equal(callbackKeysMatch('more_info', 'more_x'), false);

assert.ok(expandCallbackMatchKeys('Да').includes('callback_да'));

const stacks = [
  {
    id: 'main',
    blocks: [
      { id: 'st', type: 'start', props: {} },
      { id: 'msg', type: 'message', props: { text: '?' } },
      { id: 'inl', type: 'inline', props: { buttons: 'Да' } },
    ],
  },
  {
    id: 'h_yes',
    blocks: [
      { id: 'cb', type: 'callback', props: { label: 'Да' } },
      { id: 'm', type: 'message', props: { text: 'yes' } },
    ],
  },
];

const map = buildCallbackMap(stacks);
assert.equal(map.ok, true, map.errors.map((e) => e.message).join('; '));

const stacksExplicitDa = [
  {
    id: 'main',
    blocks: [
      { id: 'inl', type: 'inline', props: { buttons: 'Да|да' } },
      { id: 'msg', type: 'message', props: { text: '?' } },
    ],
  },
  {
    id: 'h',
    blocks: [
      { id: 'cb', type: 'callback', props: { data: 'callback_да' } },
      { id: 'm', type: 'message', props: { text: 'ok' } },
    ],
  },
];
assert.equal(buildCallbackMap(stacksExplicitDa).ok, true);

assert.equal(normalizeCallbackData('  да  '), 'да');

console.log('callbackDataNormalize.test.js: ok');
