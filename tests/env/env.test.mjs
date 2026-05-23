import assert from 'node:assert/strict';

const saved = {
  AUTH_BYPASS: process.env.AUTH_BYPASS,
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  DEV_IDE_ADMIN: process.env.DEV_IDE_ADMIN,
  DEV_ERRORS_ADMIN: process.env.DEV_ERRORS_ADMIN,
  DISABLE_FIRMWARE_RUNTIME: process.env.DISABLE_FIRMWARE_RUNTIME,
  TRUST_PROXY: process.env.TRUST_PROXY,
  TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function loadEnvModule() {
  const url = new URL('../../core/env.mjs', import.meta.url);
  url.searchParams.set('t', String(Date.now() + Math.random()));
  return import(url.href);
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
  const env = await loadEnvModule();
  assert.equal(env.isProduction(), false);
  assert.equal(env.isDevelopment(), true);
  assert.equal(env.isAuthBypassEnabled(), true);
  assert.equal(env.isDevLoggingEnabled(), true);
  assert.equal(env.isDevIdeEnabled(), true);
  assert.equal(env.isFirmwareRuntimeEnabled(), true);

  process.env.DISABLE_FIRMWARE_RUNTIME = '1';
  const fwOff = await loadEnvModule();
  assert.equal(fwOff.isFirmwareRuntimeEnabled(), false);
  delete process.env.DISABLE_FIRMWARE_RUNTIME;

  const dev = await loadAuthBypassModule();
  assert.equal(dev.isAuthBypassEnabled(), true);
  assert.equal(dev.getDevBypassUser()?.id, 'dev-bypass-user');

  process.env.NODE_ENV = 'production';
  delete process.env.APP_ENV;
  const prodEnv = await loadEnvModule();
  assert.equal(prodEnv.isProduction(), true);
  assert.equal(prodEnv.isAuthBypassEnabled(), false);
  assert.equal(prodEnv.isDevIdeEnabled(), false);
  assert.equal(prodEnv.isDevIdeAdminGated(), false);

  process.env.DEV_IDE_ADMIN = '1';
  const prodIdeAdmin = await loadEnvModule();
  assert.equal(prodIdeAdmin.isDevIdeEnabled(), true);
  assert.equal(prodIdeAdmin.isDevIdeAdminGated(), true);
  delete process.env.DEV_IDE_ADMIN;

  process.env.DEV_ERRORS_ADMIN = '1';
  const prodErrorsAdmin = await loadEnvModule();
  assert.equal(prodErrorsAdmin.isDevErrorsEnabled(), true);
  assert.equal(prodErrorsAdmin.isDevErrorsAdminGated(), true);
  delete process.env.DEV_ERRORS_ADMIN;

  const prod = await loadAuthBypassModule();
  assert.equal(prod.isAuthBypassEnabled(), false);
  assert.equal(prod.getDevBypassUser(), null);

  process.env.NODE_ENV = '';
  process.env.APP_ENV = 'production';
  process.env.AUTH_BYPASS = '1';
  const legacyProd = await loadEnvModule();
  assert.equal(legacyProd.isProduction(), true);
  assert.equal(legacyProd.isAuthBypassEnabled(), false);

  delete process.env.TRUST_PROXY;
  delete process.env.TRUST_PROXY_HOPS;
  process.env.NODE_ENV = 'development';
  process.env.APP_ENV = 'production';
  const messyDev = await loadEnvModule();
  assert.equal(messyDev.resolveTrustProxySetting(), false);

  process.env.NODE_ENV = 'production';
  const prodProxy = await loadEnvModule();
  assert.equal(prodProxy.resolveTrustProxySetting(), 1);

  process.env.TRUST_PROXY = 'true';
  const explicitTrue = await loadEnvModule();
  assert.equal(explicitTrue.resolveTrustProxySetting(), 1);

  console.log('env.test.mjs: ok');
} finally {
  restoreEnv();
}
