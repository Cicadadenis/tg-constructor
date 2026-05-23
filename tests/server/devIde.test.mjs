import assert from 'node:assert/strict';
import express from 'express';
import fsp from 'node:fs/promises';
import path from 'node:path';

const saved = {
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function loadDevIde() {
  const url = new URL('../../server/devIde.mjs', import.meta.url);
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

  const { isDevIdeEnabled } = await import('../../core/env.mjs');
  assert.equal(isDevIdeEnabled(), true);

  const ide = await loadDevIde();
  const app = express();
  ide.registerDevIdeRoutes(app);

  const fixtureDir = path.resolve('tests/server/fixtures-dev-ide');
  const fixtureFile = path.join(fixtureDir, 'src', 'dev-ide-fixture.txt');
  await fsp.mkdir(path.dirname(fixtureFile), { recursive: true });
  await fsp.writeFile(fixtureFile, 'hello-ide', 'utf8');

  await withServer(app, async (port) => {
    const base = `http://127.0.0.1:${port}`;

    const tree = await fetch(`${base}/api/files/tree`);
    assert.equal(tree.status, 200);
    const treeData = await tree.json();
    assert.ok(Array.isArray(treeData.roots));

    const bad = await fetch(`${base}/api/files/read?path=../.env`);
    assert.equal(bad.status, 400);

    const bad2 = await fetch(`${base}/api/files/read?path=node_modules/foo`);
    assert.equal(bad2.status, 400);

    const rel = 'tests/server/fixtures-dev-ide/src/dev-ide-fixture.txt';
    const fixtureRead = await fetch(`${base}/api/files/read?path=${encodeURIComponent(rel)}`);
    assert.equal(fixtureRead.status, 200);

    const blockedBackup = await fetch(`${base}/api/files/read?path=${encodeURIComponent('.dev-backups/foo')}`);
    assert.equal(blockedBackup.status, 400);

    const writeBlocked = await fetch(`${base}/api/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '.env', content: 'x' }),
    });
    assert.equal(writeBlocked.status, 400);
  });

  process.env.APP_ENV = 'production';
  process.env.NODE_ENV = 'production';
  assert.equal(isDevIdeEnabled(), false);

  const prodApp = express();
  const prodIde = await loadDevIde();
  prodIde.registerDevIdeRoutes(prodApp);
  await withServer(prodApp, async (port) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/files/tree`);
    assert.equal(res.status, 404);
  });

  await fsp.rm(fixtureDir, { recursive: true, force: true });

  console.log('devIde.test.mjs: ok');
} finally {
  restoreEnv();
}
