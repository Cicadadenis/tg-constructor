import assert from 'node:assert/strict';
import express from 'express';

const saved = {
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_BYPASS: process.env.AUTH_BYPASS,
  DEV_ERRORS_ADMIN: process.env.DEV_ERRORS_ADMIN,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function loadDevErrors() {
  const url = new URL('../../server/devErrors.mjs', import.meta.url);
  url.searchParams.set('t', String(Date.now() + Math.random()));
  return import(url.href);
}

async function withServer(app, fn) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const { port } = server.address();
    return await fn(port);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

try {
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  delete process.env.AUTH_BYPASS;

  const { isDevLoggingEnabled } = await import('../../core/env.mjs');
  const dev = await loadDevErrors();
  assert.equal(isDevLoggingEnabled(), true);
  assert.equal(dev.isDevErrorsApiPath('/api/dev/errors'), true);

  const app = express();
  app.use(express.json());
  dev.registerDevErrorsRoutes(app);

  await withServer(app, async (port) => {
    const base = `http://127.0.0.1:${port}/api/dev/errors`;

    const post = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'frontend',
        message: 'test crash',
        stack: 'Error: test crash\n    at foo',
      }),
    });
    assert.equal(post.status, 204);

    const list = await fetch(base);
    assert.equal(list.status, 200);
    const data = await list.json();
    assert.equal(data.total, 1);
    assert.equal(data.errors[0].source, 'frontend');
    assert.equal(data.errors[0].message, 'test crash');
    assert.ok(data.errors[0].stack?.includes('test crash'));

    const del = await fetch(base, { method: 'DELETE' });
    assert.equal(del.status, 204);

    const empty = await fetch(base);
    const emptyData = await empty.json();
    assert.equal(emptyData.total, 0);
  });

  process.env.APP_ENV = 'production';
  process.env.NODE_ENV = 'production';
  delete process.env.DEV_ERRORS_ADMIN;
  const { isDevLoggingEnabled: isProdDevLogging, isDevErrorsEnabled } = await import('../../core/env.mjs');
  await loadDevErrors();
  assert.equal(isProdDevLogging(), false);
  assert.equal(isDevErrorsEnabled(), false);

  const prodApp = express();
  const prodMod = await loadDevErrors();
  prodMod.registerDevErrorsRoutes(prodApp);
  await withServer(prodApp, async (port) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/dev/errors`);
    assert.equal(res.status, 404);
  });

  process.env.DEV_ERRORS_ADMIN = '1';
  const prodAdminMod = await loadDevErrors();
  const prodAdminApp = express();
  prodAdminApp.use(express.json());
  prodAdminMod.setDevErrorsAdminAccessChecker(async () => false);
  prodAdminMod.registerDevErrorsRoutes(prodAdminApp);
  await withServer(prodAdminApp, async (port) => {
    const denied = await fetch(`http://127.0.0.1:${port}/api/dev/errors`);
    assert.equal(denied.status, 403);
    prodAdminMod.setDevErrorsAdminAccessChecker(async () => true);
    const post = await fetch(`http://127.0.0.1:${port}/api/dev/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'backend', message: 'prod admin test' }),
    });
    assert.equal(post.status, 204);
    const list = await fetch(`http://127.0.0.1:${port}/api/dev/errors`);
    assert.equal(list.status, 200);
    const data = await list.json();
    assert.equal(data.total, 1);
  });
  delete process.env.DEV_ERRORS_ADMIN;

  console.log('devErrors.test.mjs: ok');
} finally {
  restoreEnv();
}
