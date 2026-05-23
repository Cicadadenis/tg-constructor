import assert from 'node:assert/strict';
import { emitInlineKeyboard, parseInlineRows } from './keyboards.js';

const rows = parseInlineRows('A -> cb_ok\nB -> ' + 'x'.repeat(70));
assert.throws(
  () => emitInlineKeyboard(rows),
  /callback_data/,
);

const ok = parseInlineRows('Да -> yes\nНет -> no');
const py = emitInlineKeyboard(ok, 'kb_test');
assert.match(py, /callback_data="yes"/);

console.log('keyboards.validation.test.js: ok');
