import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpolateTemplate } from './variableInterpolation.js';

test('interpolateTemplate replaces {{key}} and nested paths', () => {
  const out = interpolateTemplate('Hi {{first_name}}, id={{user.id}}', {
    first_name: 'Alex',
    user: { id: '42' },
  });
  assert.equal(out, 'Hi Alex, id=42');
});

test('interpolateTemplate leaves unknown keys empty', () => {
  assert.equal(interpolateTemplate('{{missing}}', {}), '');
});
