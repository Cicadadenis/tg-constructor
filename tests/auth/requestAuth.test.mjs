import assert from 'node:assert/strict';
import {
  attachAuthenticatedUser,
  DEV_BYPASS_API_DEFAULTS,
  isDatabaseUnavailableError,
  normalizeAuthUserId,
  requireRequestAuthContext,
  authVerificationFailureStatus,
} from '../../server/requestAuth.mjs';

assert.equal(normalizeAuthUserId('  u1 '), 'u1');
assert.equal(normalizeAuthUserId(null), '');

function mockRes() {
  const state = { statusCode: 200, body: null };
  return {
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.body = payload;
      return this;
    },
  };
}

{
  const res = mockRes();
  const ctx = requireRequestAuthContext({ authUserId: 'dev-bypass-user', authBypass: true }, res);
  assert.ok(ctx?.userId);
  assert.equal(ctx.bypass, true);
}

{
  const res = mockRes();
  const ctx = requireRequestAuthContext({}, res);
  assert.equal(ctx, null);
  assert.equal(res.statusCode, 401);
}

assert.equal(isDatabaseUnavailableError({ code: '28P01' }), true);
assert.equal(isDatabaseUnavailableError({ code: '23505' }), false);
assert.equal(authVerificationFailureStatus({ code: 'ECONNREFUSED' }), 503);
assert.equal(authVerificationFailureStatus(new Error('bad jwt')), 401);
assert.deepEqual(DEV_BYPASS_API_DEFAULTS.projects, { projects: [] });

{
  const req = { authUserId: 'u1', authUser: { id: 'u1', name: 'Test' } };
  assert.equal(attachAuthenticatedUser(req), true);
  assert.equal(req.user?.id, 'u1');
}

console.log('requestAuth.test.mjs: ok');
