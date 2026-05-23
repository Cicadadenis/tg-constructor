import assert from 'node:assert/strict';
import express from 'express';

const saved = {
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_BYPASS: process.env.AUTH_BYPASS,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function loadDevLog() {
  const url = new URL('../../server/devLog.mjs', import.meta.url);
  url.searchParams.set('t', String(Date.now() + Math.random()));
  return import(url.href);
}

async function postDevLog(app, body) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/dev/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text };
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

try {
  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  delete process.env.AUTH_BYPASS;

  const dev = await loadDevLog();
  assert.equal(dev.isDevLoggingEnabled(), true);
  assert.equal(dev.isDevLogApiPath('/api/dev/log'), true);
  assert.equal(dev.isDevLogApiPath('/api/dev/log?x=1'), true);
  assert.equal(dev.isDevLogApiPath('/api/bots'), false);

  const app = express();
  app.use(express.json());
  dev.registerDevLogRoutes(app);

  const ok = await postDevLog(app, { type: 'frontend', message: 'test error' });
  assert.equal(ok.status, 204);
  assert.equal(ok.text, '');

  const empty = await postDevLog(app, {});
  assert.equal(empty.status, 204);

  process.env.APP_ENV = 'production';
  process.env.NODE_ENV = 'production';
  const prod = await loadDevLog();
  assert.equal(prod.isDevLoggingEnabled(), false);

  const prodApp = express();
  prod.registerDevLogRoutes(prodApp);
  const prodRes = await postDevLog(prodApp, { type: 'frontend', message: 'x' });
  assert.equal(prodRes.status, 204);

  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'development';
  process.env.AUTH_BYPASS = '1';
  const bypass = await loadDevLog();
  assert.equal(bypass.isDevLoggingEnabled(), true);

  console.log('devLog.test.mjs: ok');
} finally {
  restoreEnv();
}
