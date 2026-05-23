import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEnv } from '../core/env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

export const DEV_IDE_OPS_API = '/api/dev';

const MAX_OUTPUT_CHARS = 48_000;
const DEFAULT_TIMEOUT_MS = 25_000;
const TEST_TIMEOUT_MS = 120_000;

const PM2_APP = String(process.env.DEV_IDE_PM2_APP || 'cicada-server').trim() || 'cicada-server';
const API_PORT = Number(readEnv('API_PORT') || 3001) || 3001;

const NGINX_ERROR_LOG = '/var/log/nginx/error.log';
const NGINX_ACCESS_LOG = '/var/log/nginx/access.log';

/** @type {Record<string, { label: string, run: (params?: Record<string, unknown>) => Promise<{ stdout: string, stderr: string, exitCode: number }> }>} */
const OPS_ACTIONS = {
  'pm2-list': {
    label: 'PM2 processes',
    run: async () => execArgv('pm2', ['jlist'], 12_000),
  },
  'pm2-logs': {
    label: `PM2 logs (${PM2_APP})`,
    run: async (params) => {
      const lines = clampLines(params?.lines, 80);
      return execArgv('pm2', ['logs', PM2_APP, '--nostream', '--lines', String(lines)], 20_000);
    },
  },
  'pm2-logs-err': {
    label: `PM2 error logs (${PM2_APP})`,
    run: async (params) => {
      const lines = clampLines(params?.lines, 60);
      return execArgv('pm2', ['logs', PM2_APP, '--err', '--nostream', '--lines', String(lines)], 20_000);
    },
  },
  ports: {
    label: 'Listening TCP ports',
    run: async () => {
      const ss = await execArgv('ss', ['-tlnp'], 8_000);
      if (ss.exitCode === 0 || ss.stdout) return ss;
      return execArgv('netstat', ['-tlnp'], 8_000);
    },
  },
  health: {
    label: `HTTP /api/health :${API_PORT}`,
    run: async () => fetchLocalHealth(API_PORT),
  },
  'nginx-error': {
    label: 'nginx error.log (tail)',
    run: async (params) => tailFile(NGINX_ERROR_LOG, clampLines(params?.lines, 80)),
  },
  'nginx-access': {
    label: 'nginx access.log (tail)',
    run: async (params) => tailFile(NGINX_ACCESS_LOG, clampLines(params?.lines, 40)),
  },
  'test-devIde': {
    label: 'node --test tests/server/devIde.test.mjs',
    run: async () =>
      execArgv('node', ['--test', 'tests/server/devIde.test.mjs'], TEST_TIMEOUT_MS, { cwd: PROJECT_ROOT }),
  },
  'test-env': {
    label: 'node --test tests/env/env.test.mjs',
    run: async () =>
      execArgv('node', ['--test', 'tests/env/env.test.mjs'], TEST_TIMEOUT_MS, { cwd: PROJECT_ROOT }),
  },
  'check-server': {
    label: 'node --check server.mjs',
    run: async () => execArgv('node', ['--check', 'server.mjs'], 15_000, { cwd: PROJECT_ROOT }),
  },
  'npm-test-compiler': {
    label: 'npm run test:compiler',
    run: async () => execArgv('npm', ['run', 'test:compiler'], TEST_TIMEOUT_MS, { cwd: PROJECT_ROOT }),
  },
  'npm-test-runtime': {
    label: 'npm run test:runtime',
    run: async () => execArgv('npm', ['run', 'test:runtime'], TEST_TIMEOUT_MS, { cwd: PROJECT_ROOT }),
  },
  'disk-free': {
    label: 'df -h',
    run: async () => execArgv('df', ['-h'], 8_000),
  },
};

export const DEV_IDE_OPS_CATALOG = Object.entries(OPS_ACTIONS).map(([id, meta]) => ({
  id,
  label: meta.label,
}));

function clampLines(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(300, Math.max(10, Math.floor(n)));
}

function clipOutput(text) {
  const s = String(text ?? '');
  if (s.length <= MAX_OUTPUT_CHARS) return s;
  return `${s.slice(0, MAX_OUTPUT_CHARS)}\n… [обрезано, всего ${s.length} символов]`;
}

function execArgv(cmd, args, timeoutMs = DEFAULT_TIMEOUT_MS, { cwd = PROJECT_ROOT } = {}) {
  const run = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: timeoutMs,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  const stdout = clipOutput(run.stdout || '');
  const stderr = clipOutput(run.stderr || '');
  const exitCode = run.status ?? (run.error ? 1 : 0);
  const error = run.error
    ? run.error.code === 'ENOENT'
      ? `${cmd} не найден в PATH`
      : run.error.message
    : null;
  return Promise.resolve({
    stdout: error && !stdout ? error : stdout,
    stderr,
    exitCode: error ? 127 : exitCode,
    error,
  });
}

async function fetchLocalHealth(port) {
  const url = `http://127.0.0.1:${port}/api/health`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8_000);
  try {
    const res = await fetch(url, { signal: ac.signal });
    const body = await res.text();
    return {
      stdout: clipOutput(`GET ${url}\nHTTP ${res.status}\n${body.slice(0, 8_000)}`),
      stderr: '',
      exitCode: res.ok ? 0 : 1,
    };
  } catch (err) {
    return {
      stdout: '',
      stderr: clipOutput(err instanceof Error ? err.message : String(err)),
      exitCode: 1,
      error: 'fetch failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function tailFile(absPath, lines) {
  if (!fs.existsSync(absPath)) {
    return {
      stdout: '',
      stderr: `Файл недоступен: ${absPath}`,
      exitCode: 1,
    };
  }
  return execArgv('tail', ['-n', String(lines), absPath], 10_000);
}

export function listOpsActions() {
  return DEV_IDE_OPS_CATALOG;
}

export async function runOpsAction(actionId, params = {}) {
  const id = String(actionId || '').trim().toLowerCase();
  const action = OPS_ACTIONS[id];
  if (!action) {
    const err = new Error(`unknown ops action: ${id}`);
    err.code = 'UNKNOWN_ACTION';
    throw err;
  }
  const started = Date.now();
  const result = await action.run(params);
  return {
    action: id,
    label: action.label,
    ...result,
    durationMs: Date.now() - started,
  };
}

export async function buildAutoOpsContext(userText) {
  const t = String(userText || '').toLowerCase();
  const planned = [];

  const wantsLogs = /(?:лог|log|pm2|ошибк|error|trace|stack|crash|упал|stderr)/i.test(t);
  const wantsPorts = /(?:порт|port|слуша|listen|502|upstream|connection refused|refused|lsof)/i.test(t);
  const wantsHealth = /(?:health|жив|работает|доступен|uptime|\/api\/health)/i.test(t);
  const wantsTests = /(?:прогони|запусти|run).{0,12}(?:тест|test)|(?:тест|test).{0,12}(?:прогони|запусти|run)|\bnode --test\b/i.test(t);
  const wantsNginx = /nginx/i.test(t);
  const wantsDisk = /(?:место|disk|df\b|диск)/i.test(t);

  if (wantsLogs) {
    planned.push(['pm2-list', {}], ['pm2-logs', { lines: 80 }], ['pm2-logs-err', { lines: 40 }]);
  }
  if (wantsPorts) planned.push(['ports', {}]);
  if (wantsHealth || wantsPorts) planned.push(['health', {}]);
  if (wantsNginx) planned.push(['nginx-error', { lines: 60 }]);
  if (wantsDisk) planned.push(['disk-free', {}]);
  if (wantsTests) planned.push(['test-devIde', {}], ['check-server', {}]);

  const seen = new Set();
  const blocks = [];
  for (const [action, params] of planned) {
    if (seen.has(action)) continue;
    seen.add(action);
    try {
      const out = await runOpsAction(action, params);
      blocks.push(formatOpsBlock(out));
    } catch (err) {
      blocks.push(`### ops:${action}\n\`\`\`\n${err instanceof Error ? err.message : String(err)}\n\`\`\``);
    }
  }

  if (!blocks.length) return '';
  return `\n\n---\nАвто-диагностика сервера (ops, только чтение/тесты):\n${blocks.join('\n')}`;
}

export function formatOpsBlock(result) {
  const head = `### ops:${result.action} (${result.label}) exit=${result.exitCode} ${result.durationMs}ms`;
  const body = [result.stdout, result.stderr].filter(Boolean).join('\n--- stderr ---\n').trim() || '(пусто)';
  return `${head}\n\`\`\`\n${body}\n\`\`\``;
}

export function extractOpsDirectives(text) {
  const actions = [];
  const seen = new Set();
  const add = (action, params = {}) => {
    const key = `${action}:${JSON.stringify(params)}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (OPS_ACTIONS[action]) actions.push({ action, params });
  };

  for (const m of String(text || '').matchAll(/\bops:([a-z0-9-]+)(?::(\d+))?/gi)) {
    const action = m[1].toLowerCase();
    const params = m[2] ? { lines: Number(m[2]) } : {};
    add(action, params);
  }
  return actions;
}

export function mapBashLineToOpsAction(line) {
  const s = String(line || '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const table = [
    [/^pm2\s+jlist$/i, 'pm2-list'],
    [/^pm2\s+list$/i, 'pm2-list'],
    [/^pm2\s+logs(?:\s+cicada-server|\s+\S+)?(?:\s+--lines\s+(\d+))?/i, 'pm2-logs'],
    [/^pm2\s+logs\s+\S+\s+--err/i, 'pm2-logs-err'],
    [/^ss\s+-tlnp$/i, 'ports'],
    [/^netstat\s+-tlnp$/i, 'ports'],
    [/^curl\b.*\/api\/health/i, 'health'],
    [/^node\s+--test\s+tests\/server\/devIde\.test\.mjs$/i, 'test-devIde'],
    [/^node\s+--test\s+tests\/env\/env\.test\.mjs$/i, 'test-env'],
    [/^node\s+--check\s+server\.mjs$/i, 'check-server'],
    [/^npm\s+run\s+test:compiler$/i, 'npm-test-compiler'],
    [/^npm\s+run\s+test:runtime$/i, 'npm-test-runtime'],
    [/^df\s+-h$/i, 'disk-free'],
    [/^tail\s+-n\s+(\d+)\s+\/var\/log\/nginx\/error\.log$/i, 'nginx-error'],
  ];
  for (const [re, action] of table) {
    const m = s.match(re);
    if (m) {
      if (action === 'pm2-logs' && m[1]) return { action, params: { lines: Number(m[1]) } };
      if (action === 'nginx-error' && m[1]) return { action, params: { lines: Number(m[1]) } };
      return { action, params: {} };
    }
  }
  return null;
}
