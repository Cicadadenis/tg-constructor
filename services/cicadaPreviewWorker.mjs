/**
 * Pool of Python preview workers (aiogram 3 bot.py, JSON-lines protocol).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { botPythonEnv, resolveBotPythonRoot } from './botPythonEnv.mjs';
import { buildSandboxedChildCommand } from './sandboxSpawn.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_SCRIPT = path.join(__dirname, 'python_preview_worker.py');
const MAX_CONCURRENT = Math.max(1, Number(process.env.PREVIEW_MAX_CONCURRENT || 8));
const WATCHDOG_MS = Math.max(10_000, Number(process.env.PREVIEW_WATCHDOG_MS || 90_000));
const MAX_REQUESTS = Math.max(1, Number(process.env.PREVIEW_WORKER_MAX_REQUESTS || 500));
const PREVIEW_NETWORK = process.env.PREVIEW_SANDBOX_NETWORK || process.env.DSL_SANDBOX_NETWORK || 'none';

const pool = [];
const waiters = [];

class PreviewWorker {
  constructor(proc, rl) {
    this.proc = proc;
    this.rl = rl;
    this.busy = false;
    this.dead = false;
    this.requests = 0;
    this.pending = null;
    this.timer = null;
  }

  resetWatchdog() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.kill('watchdog'), WATCHDOG_MS);
  }

  kill(reason = 'kill') {
    if (this.dead) return;
    this.dead = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.pending) {
      this.pending.reject(new Error(`preview worker ${reason}`));
      this.pending = null;
    }
    try {
      this.proc.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    releaseSlot(this);
  }

  onLine(line) {
    if (!this.pending) return;
    const { resolve, reject } = this.pending;
    this.pending = null;
    this.busy = false;
    this.resetWatchdog();
    try {
      resolve(JSON.parse(line));
    } catch (e) {
      reject(new Error(`invalid preview worker JSON: ${line.slice(0, 200)}`));
    }
    pumpQueue();
  }

  request(payload, timeoutMs = 60_000) {
    if (this.dead) return Promise.reject(new Error('preview worker dead'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        this.busy = false;
        this.kill('timeout');
        reject(new Error('preview worker timeout'));
      }, timeoutMs);

      this.pending = {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
      this.busy = true;
      this.requests += 1;
      if (this.requests >= MAX_REQUESTS) {
        const done = this.pending;
        this.pending = null;
        this.kill('max_requests');
        if (done) done.reject(new Error('preview worker recycled'));
        return;
      }
      this.resetWatchdog();
      this.proc.stdin.write(`${JSON.stringify(payload)}\n`, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending = null;
          this.busy = false;
          reject(err);
        }
      });
    });
  }
}

function releaseSlot(worker) {
  const idx = pool.indexOf(worker);
  if (idx >= 0) pool.splice(idx, 1);
  const next = waiters.shift();
  if (next) next();
}

/** bwrap не монтирует /var — используем python из /usr и PYTHONPATH на venv site-packages. */
function previewPythonExecutable() {
  if (fs.existsSync('/usr/bin/python3')) return '/usr/bin/python3';
  const venv = resolveBotPythonRoot();
  if (venv) {
    const nix = path.join(venv, 'bin', 'python3');
    if (fs.existsSync(nix)) return nix;
  }
  return 'python3';
}

function previewSandboxBindDirs() {
  const venvRoot = resolveBotPythonRoot();
  return venvRoot && fs.existsSync(venvRoot) ? [venvRoot] : [];
}

function spawnWorker() {
  if (!fs.existsSync(WORKER_SCRIPT)) {
    throw new Error(`missing ${WORKER_SCRIPT}`);
  }
  const py = previewPythonExecutable();
  const { command, args } = buildSandboxedChildCommand({
    bin: py,
    args: ['-u', WORKER_SCRIPT],
    workDir: __dirname,
    network: PREVIEW_NETWORK,
    requireSandbox: false,
    extraRoBindDirs: previewSandboxBindDirs(),
  });
  const proc = spawn(command, args, {
    cwd: __dirname,
    env: botPythonEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const rl = readline.createInterface({ input: proc.stdout });
  const worker = new PreviewWorker(proc, rl);
  rl.on('line', (line) => worker.onLine(line));
  proc.stderr.on('data', (chunk) => {
    const text = String(chunk || '').trim();
    if (text) console.error('[preview-worker]', text.slice(0, 500));
  });
  proc.on('error', () => worker.kill('spawn_error'));
  proc.on('close', () => worker.kill('exit'));
  worker.resetWatchdog();
  pool.push(worker);
  return worker;
}

function acquireWorker() {
  const idle = pool.find((w) => !w.busy && !w.dead);
  if (idle) return Promise.resolve(idle);
  if (pool.length < MAX_CONCURRENT) {
    return Promise.resolve(spawnWorker());
  }
  return new Promise((resolve) => {
    waiters.push(() => resolve(acquireWorker()));
  });
}

async function pumpQueue() {
  if (waiters.length) {
    const next = waiters.shift();
    if (next) next();
  }
}

/**
 * @param {object} payload — preview step (Python bot.py source)
 * @returns {Promise<{ ok: boolean, outbound?: object[], effects?: object[], error?: string }>}
 */
export async function sendPreviewRequest(payload) {
  const worker = await acquireWorker();
  try {
    return await worker.request(payload);
  } catch (e) {
    if (!worker.dead) worker.kill('request_failed');
    throw e;
  } finally {
    if (!worker.busy && !worker.dead && pool.length <= MAX_CONCURRENT) {
      pumpQueue();
    }
  }
}
