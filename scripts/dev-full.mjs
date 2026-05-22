#!/usr/bin/env node
/**
 * Start API server (3001) + Vite dev server (5173) together.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

function run(name, cmd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, FORCE_COLOR: '1', ...extraEnv },
  });
  child.on('exit', (code, signal) => {
    if (signal) console.error(`[${name}] exited (${signal})`);
    else if (code) console.error(`[${name}] exited with code ${code}`);
    shutdown(code || 0);
  });
  return child;
}

const children = [];
let exiting = false;

function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const c of children) {
    try { c.kill('SIGTERM'); } catch { /* ignore */ }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

children.push(run('server', process.execPath, [path.join(root, 'server.mjs')]));
children.push(run('vite', process.execPath, [viteBin]));

const uiPort = Number(process.env.VITE_DEV_PORT) || 5173;
console.log(`Cicada Studio dev: API http://127.0.0.1:3001  |  UI http://127.0.0.1:${uiPort}`);
