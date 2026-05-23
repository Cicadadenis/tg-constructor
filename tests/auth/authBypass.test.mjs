import assert from 'node:assert/strict';

const saved = {
  AUTH_BYPASS: process.env.AUTH_BYPASS,
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function loadAuthBypassModule() {
  const url = new URL('../../server/authBypass.mjs', import.meta.url);
  url.searchParams.set('t', String(Date.now() + Math.random()));
  return import(url.href);
}

try {
  process.env.AUTH_BYPASS = '1';
  process.env.NODE_ENV = 'development';
  delete process.env.APP_ENV;
  const dev = await loadAuthBypassModule();
  assert.equal(dev.isAuthBypassEnabled(), true);
  assert.equal(dev.getDevBypassUser()?.id, 'dev-bypass-user');

  process.env.NODE_ENV = 'production';
  const prod = await loadAuthBypassModule();
  assert.equal(prod.isAuthBypassEnabled(), false);
  assert.equal(prod.getDevBypassUser(), null);

  console.log('authBypass.test.mjs: ok');
} finally {
  restoreEnv();
}
