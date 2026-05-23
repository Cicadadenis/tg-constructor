import assert from 'node:assert/strict';
import {
  normalizeSessionUser,
  requireSessionUser,
  isAuthenticatedUser,
} from '../../src/auth/sessionUser.js';

assert.equal(normalizeSessionUser(null), null);
assert.equal(normalizeSessionUser({ name: 'x' }), null);
assert.equal(normalizeSessionUser({ id: '  u1  ' })?.id, 'u1');

assert.throws(() => requireSessionUser(undefined), /недействительна/i);
assert.equal(isAuthenticatedUser({ id: '1' }), true);
assert.equal(isAuthenticatedUser({}), false);

console.log('sessionUser.test.mjs: ok');
