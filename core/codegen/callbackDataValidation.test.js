import assert from 'node:assert/strict';
import {
  CALLBACK_DATA_MAX_BYTES,
  callbackDataUtf8ByteLength,
  validateCallbackData,
  validateInlineKeyboardRows,
} from './callbackDataValidation.js';

assert.equal(validateCallbackData('').ok, false);
assert.equal(validateCallbackData('   ').ok, false);
assert.equal(validateCallbackData('menu:home').ok, true);

const long = 'x'.repeat(CALLBACK_DATA_MAX_BYTES + 1);
assert.equal(validateCallbackData(long).ok, false);
assert.ok(callbackDataUtf8ByteLength('привет') > 5);

const issues = validateInlineKeyboardRows([
  [{ text: 'OK', callback_data: 'ok' }],
  [{ text: 'Bad', callback_data: '   ' }],
]);
assert.equal(issues.length, 1);
assert.equal(issues[0].code, 'CALLBACK_EMPTY');

console.log('callbackDataValidation.test.js: ok');
