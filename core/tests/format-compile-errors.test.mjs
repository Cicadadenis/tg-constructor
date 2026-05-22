import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCompileError, formatCompileErrorsForDisplay } from '../../src/builder/formatCompileErrors.js';

test('OUTPUT_AS_ROOT → понятное объяснение без технического id', () => {
  const out = formatCompileError({
    code: 'OUTPUT_AS_ROOT',
    message: 'Ответ/медиа требуют handler (entry) выше',
    blockType: 'message',
    nodeId: 'n_stack_orphan_b3_b3',
  });
  assert.match(out.title, /Ответ/);
  assert.match(out.hint, /Старт/);
  assert.ok(!out.title.includes('n_stack_orphan'));
  assert.equal(out.nodeId, 'n_stack_orphan_b3_b3');
});

test('группировка одинаковых ошибок', () => {
  const list = formatCompileErrorsForDisplay([
    { code: 'OUTPUT_AS_ROOT', message: '…', blockType: 'message', nodeId: 'a' },
    { code: 'OUTPUT_AS_ROOT', message: '…', blockType: 'reply', nodeId: 'b' },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].count, 2);
  assert.deepEqual(list[0].nodeIds, ['a', 'b']);
});

test('MissingCallbackHandlerError декодирует callback_да', () => {
  const out = formatCompileError({
    code: 'MissingCallbackHandlerError',
    message: 'Нет handler для callback_data «callback_да» — добавьте блок «При нажатии»',
    blockType: 'inline',
  });
  assert.match(out.title, /да/i);
});
