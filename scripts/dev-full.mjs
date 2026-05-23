#!/usr/bin/env node
/**
 * Start API server + Vite dev server for local web development.
 *
 * Sets NODE_ENV=development and AUTH_BYPASS=1 (unless already set in the environment).
 * Creates a project backup first (unless SKIP_DEV_BACKUP=1).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDevBackup } from './dev-backup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const localDevEnv = {
  NODE_ENV: 'development',
  AUTH_BYPASS: process.env.AUTH_BYPASS ?? '1',
};

function run(name, cmd, args) {
  const child = spawn(cmd, args, {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: '1', ...localDevEnv },
    stdio: 'inherit',
    shell: false,
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

async function main() {
  if (process.env.SKIP_DEV_BACKUP !== '1') {
    try {
      console.log('Создание резервной копии проекта…');
      const backupPath = await createDevBackup(root);
      const rel = path.relative(root, backupPath) || backupPath;
      console.log(`  Backup → ${rel}`);
    } catch (err) {
      console.error('[backup] не удалось создать копию:', err instanceof Error ? err.message : err);
      console.error('  Продолжаем без бэкапа или остановите и исправьте ошибку.');
    }
  } else {
    console.log('  Backup пропущен (SKIP_DEV_BACKUP=1)');
  }

  children.push(run('server', process.execPath, ['--import', 'tsx', path.join(root, 'server.mjs')]));
  children.push(run('vite', process.execPath, [viteBin]));

  const uiPort = Number(process.env.VITE_DEV_PORT) || 5173;
  console.log('Cicada Studio — local development (web only)');
  console.log(`  API  → http://127.0.0.1:${process.env.API_PORT || 3001}`);
  console.log(`  UI   → http://127.0.0.1:${uiPort}`);
  console.log(`  Debug IDE → http://127.0.0.1:${process.env.API_PORT || 3001}/debug`);
  console.log('  AUTH_BYPASS=1 (mock user, no login required)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
