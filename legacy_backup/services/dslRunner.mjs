import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { redactSecrets } from './redactLog.mjs';
import { normalizeMediaPathsInCode } from './botMediaPaths.mjs';
import { buildSandboxedChildCommand, resolveSandboxNetwork } from './sandboxSpawn.mjs';
import { botPythonEnv, pythonCmd } from './botPythonEnv.mjs';

const SAFE_USER_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_CODE_BYTES = Number(process.env.PYTHON_MAX_CODE_BYTES || process.env.DSL_MAX_CODE_BYTES || 200_000);
const MAX_RUNTIME_MS = Number(process.env.DSL_MAX_RUNTIME_MS || 5 * 60 * 1000);
const MAX_LOG_CHARS = Number(process.env.DSL_MAX_LOG_CHARS || 80_000);
const DSL_SANDBOX_NETWORK = resolveSandboxNetwork();
const MAX_SETTIMEOUT_MS = 2_147_483_647;

const runners = new Map();
const recentRunnerResults = new Map();

function normalizeMode(mode) {
  return mode === 'server' ? 'server' : 'sandbox';
}

function runnerSlotKey(userId, mode) {
  return `${userId}:${normalizeMode(mode)}`;
}

function safeFileName() {
  return `bot-${crypto.randomUUID()}.py`;
}

function validateInputs(userId, code) {
  if (!userId || !SAFE_USER_ID.test(String(userId))) {
    throw new Error('invalid userId');
  }
  if (!code || typeof code !== 'string') {
    throw new Error('invalid code');
  }
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    throw new Error(`code too large (>${MAX_CODE_BYTES} bytes)`);
  }
}

function buildSandboxedCommand({ pythonBin, userDir, runFile, botsDir, userId }) {
  return buildSandboxedChildCommand({
    bin: pythonBin,
    args: ['-u', runFile],
    workDir: userDir,
    network: DSL_SANDBOX_NETWORK,
    extraRoBindDirs: [],
  });
}

function ensureUserDir(botsDir, userId) {
  const dir = path.resolve(botsDir, userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function userRunDir(botsDir, userId, mode) {
  const root = ensureUserDir(botsDir, userId);
  const dir = path.join(root, `run-${normalizeMode(mode)}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupUserBotFiles(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((file) => {
    if (file.endsWith('.py') && file.startsWith('bot-')) {
      try { fs.unlinkSync(path.join(dir, file)); } catch {}
    }
  });
}

function appendLog(state, chunk) {
  const text = redactSecrets(String(chunk || ''));
  state.logs += text;
  if (state.logs.length > MAX_LOG_CHARS) {
    state.logs = state.logs.slice(state.logs.length - MAX_LOG_CHARS);
  }
}

function saveRunnerResult(slotKey, payload) {
  recentRunnerResults.set(slotKey, {
    ...payload,
    logs: redactSecrets(String(payload.logs || '')).slice(-MAX_LOG_CHARS),
  });
}

function hardKill(state) {
  if (!state?.proc || state.proc.killed) return;
  const proc = state.proc;
  try {
    if (process.platform !== 'win32' && proc.pid) {
      process.kill(-proc.pid, 'SIGTERM');
    } else {
      proc.kill('SIGTERM');
    }
  } catch {}
  setTimeout(() => {
    try {
      if (process.platform !== 'win32' && proc.pid) {
        process.kill(-proc.pid, 'SIGKILL');
      } else if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    } catch {}
  }, 1500).unref();
}

function remainingRunMs(state) {
  if (state.runsUntil != null && Number.isFinite(state.runsUntil)) {
    return Math.max(0, state.runsUntil - Date.now());
  }
  return Math.max(0, state.startedAt + state.timeoutMs - Date.now());
}

function scheduleRunnerTimeout(state, onEvent) {
  clearTimeout(state.timeout);
  const remaining = remainingRunMs(state);
  if (remaining <= 0) {
    onEvent?.('timeout', { userId: state.userId, mode: state.mode });
    hardKill(state);
    return;
  }
  const delay = Math.min(remaining, MAX_SETTIMEOUT_MS);
  state.timeout = setTimeout(() => {
    if (!runners.has(state.slotKey)) return;
    scheduleRunnerTimeout(state, onEvent);
  }, delay);
}

function projectIdSidecarPath(userDir) {
  return path.join(userDir, '.cicada-project-id');
}

function writePersistedProjectId(userDir, projectId) {
  try {
    if (!projectId) {
      const fp = projectIdSidecarPath(userDir);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      return;
    }
    fs.writeFileSync(projectIdSidecarPath(userDir), String(projectId), 'utf8');
  } catch {
    // ignore
  }
}

export function startRunner({
  userId,
  code,
  pythonBin,
  botsDir,
  onEvent,
  timeoutMs: timeoutMsOverride,
  mode = 'sandbox',
  runsUntil = null,
  projectId = null,
}) {
  validateInputs(userId, code);
  const py = pythonBin || pythonCmd();

  const maxServerMs = Math.min(
    Number(process.env.DSL_MAX_SERVER_RUNTIME_MS || 365 * 24 * 60 * 60 * 1000),
    MAX_SETTIMEOUT_MS,
  );
  const slotMode = normalizeMode(mode);
  const runTimeoutMs = Math.min(
    Math.max(1000, Number.isFinite(Number(timeoutMsOverride)) ? Number(timeoutMsOverride) : MAX_RUNTIME_MS),
    slotMode === 'server' ? maxServerMs : MAX_RUNTIME_MS,
    MAX_SETTIMEOUT_MS,
  );

  stopRunner(userId, { keepLog: false, reason: 'restart', mode: slotMode });

  const userDir = userRunDir(botsDir, userId, slotMode);
  const slotKey = runnerSlotKey(userId, slotMode);
  const normalizedProjectId = projectId ? String(projectId).trim() : '';
  if (slotMode === 'server') {
    writePersistedProjectId(userDir, normalizedProjectId || null);
  }
  cleanupUserBotFiles(userDir);
  const file = path.join(userDir, safeFileName());
  let finalCode = normalizeMediaPathsInCode(String(code).trim(), {
    botsDir,
    userId,
    projectId: normalizedProjectId || null,
  });
  fs.writeFileSync(file, finalCode, 'utf8');
  const runFile = path.basename(file);

  const launch = buildSandboxedCommand({ pythonBin: py, userDir, runFile, botsDir, userId });

  const proc = spawn(launch.command, launch.args, {
    cwd: userDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
    detached: process.platform !== 'win32',
    env: botPythonEnv({
      PATH: process.env.PATH,
      HOME: userDir,
      TMPDIR: '/tmp',
    }),
  });

  const state = {
    userId,
    file,
    proc,
    startedAt: Date.now(),
    logs: '',
    timeout: null,
    mode: slotMode,
    runsUntil: runsUntil != null ? Number(runsUntil) : null,
    timeoutMs: runTimeoutMs,
    slotKey,
    projectId: normalizedProjectId || null,
  };
  runners.set(slotKey, state);

  appendLog(
    state,
    `[cicada-runner] ${slotMode} started pid=${proc.pid ?? '?'} file=${runFile} sandbox=${Boolean(launch.sandboxed)}\n`,
  );

  scheduleRunnerTimeout(state, onEvent);

  proc.stdout?.on('data', (chunk) => appendLog(state, chunk));
  proc.stderr?.on('data', (chunk) => appendLog(state, chunk));
  proc.on('error', (err) => {
    appendLog(state, `\n[runner-error] ${redactSecrets(err?.message || String(err))}\n`);
    saveRunnerResult(state.slotKey, {
      endedAt: Date.now(),
      reason: 'spawn_error',
      code: null,
      signal: null,
      logs: state.logs,
    });
    onEvent?.('error', { userId, mode: state.mode, message: err?.message || String(err) });
  });
  proc.on('exit', (codeValue, signal) => {
    clearTimeout(state.timeout);
    saveRunnerResult(state.slotKey, {
      endedAt: Date.now(),
      reason: 'exit',
      code: codeValue,
      signal,
      logs: state.logs,
    });
    onEvent?.('exit', { userId, mode: state.mode, code: codeValue, signal });
    try { fs.unlinkSync(file); } catch {}
    runners.delete(state.slotKey);
  });

  return {
    startedAt: state.startedAt,
    timeoutMs: runTimeoutMs,
    mode: state.mode,
    runsUntil: state.runsUntil,
  };
}

function stopRunnerSlot(slotKey, { keepLog = false, reason = 'manual' } = {}) {
  const state = runners.get(slotKey);
  if (!state) return false;
  clearTimeout(state.timeout);
  hardKill(state);
  saveRunnerResult(slotKey, {
    endedAt: Date.now(),
    reason,
    code: null,
    signal: 'SIGTERM',
    logs: state.logs,
  });
  if (!keepLog) {
    try { fs.unlinkSync(state.file); } catch {}
  }
  runners.delete(slotKey);
  return true;
}

/** Kill stray bot-*.py in user run dir when in-memory runner state is missing. */
export function cleanupRunnerWorkspace(botsDir, userId, mode = 'sandbox') {
  try {
    const dir = userRunDir(botsDir, userId, mode);
    cleanupUserBotFiles(dir);
  } catch {
    // ignore
  }
}

export function stopRunner(userId, { keepLog = false, reason = 'manual', mode } = {}) {
  if (mode != null) {
    return stopRunnerSlot(runnerSlotKey(userId, mode), { keepLog, reason });
  }
  let stopped = false;
  for (const slotMode of ['sandbox', 'server']) {
    if (stopRunnerSlot(runnerSlotKey(userId, slotMode), { keepLog, reason })) stopped = true;
  }
  return stopped;
}

export function isRunnerActive(userId, mode) {
  if (mode != null) return runners.has(runnerSlotKey(userId, mode));
  return runners.has(runnerSlotKey(userId, 'sandbox')) || runners.has(runnerSlotKey(userId, 'server'));
}

export function getRunnerStatus(userId, mode) {
  const state = runners.get(runnerSlotKey(userId, mode));
  if (!state) return null;
  return {
    active: true,
    startedAt: state.startedAt,
    file: state.file,
    mode: state.mode,
    projectId: state.projectId,
    remainingMs: remainingRunMs(state),
    timeoutMs: state.timeoutMs,
    runsUntil: state.runsUntil,
  };
}

export function getRunnerLogs(userId, maxLines = 50, mode = 'sandbox') {
  const state = runners.get(runnerSlotKey(userId, mode));
  if (state) {
    const lines = state.logs.split(/\r?\n/).filter(Boolean);
    return { active: true, logs: lines.slice(-maxLines).join('\n') };
  }
  const recent = recentRunnerResults.get(runnerSlotKey(userId, mode));
  if (recent) {
    const lines = String(recent.logs || '').split(/\r?\n/).filter(Boolean);
    return { active: false, logs: lines.slice(-maxLines).join('\n'), endedAt: recent.endedAt, reason: recent.reason };
  }
  return { active: false, logs: '' };
}

export function listRunners() {
  return [...runners.values()].map((s) => ({
    userId: s.userId,
    mode: s.mode,
    startedAt: s.startedAt,
    projectId: s.projectId,
  }));
}
