import { spawn } from 'child_process';

/** @typedef {'queued'|'compiling'|'success'|'failed'} CompileJobStatus */

/** Первая ESPHome-сборка на сервере часто >10 мин (скачивание PlatformIO toolchain). */
const DEFAULT_COMPILE_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CAPTURE_CHARS = 4 * 1024 * 1024;
const DEBUG_CHUNK_CHARS = 240;

export function formatCompileTimeoutMessage(timeoutMs) {
  const ms = Number(timeoutMs) || DEFAULT_COMPILE_TIMEOUT_MS;
  const mins = Math.max(1, Math.round(ms / 60_000));
  return `Сборка прервана по таймауту (${mins} мин). Первая компиляция на сервере может занять 20–30 мин — повторите или увеличьте FIRMWARE_BUILD_TIMEOUT_MS.`;
}

function debugLog(tag, message) {
  const line = String(message ?? '').replace(/\s+/g, ' ').trim();
  const preview = line.length > DEBUG_CHUNK_CHARS
    ? `${line.slice(0, DEBUG_CHUNK_CHARS)}…`
    : line;
  console.log(`[${tag}] ${preview}`);
}

function killProcessTree(child, signal = 'SIGTERM') {
  if (!child?.pid) return;
  try {
    if (process.platform !== 'win32') {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  }
}

function trimCapture(stdout, stderr) {
  const total = stdout.length + stderr.length;
  if (total <= MAX_CAPTURE_CHARS) return { stdout, stderr };
  const over = total - MAX_CAPTURE_CHARS;
  if (stdout.length >= over) {
    return { stdout: stdout.slice(over), stderr };
  }
  return {
    stdout: '',
    stderr: stderr.slice(Math.max(0, stderr.length - over)),
  };
}

/**
 * Production-safe ESPHome / PlatformIO compile runner.
 *
 * @param {{
 *   command: string,
 *   args?: string[],
 *   cwd: string,
 *   env?: Record<string, string>,
 *   timeoutMs?: number,
 *   onStdout?: (chunk: string) => void,
 *   onStderr?: (chunk: string) => void,
 * }} opts
 * @returns {Promise<{
 *   exitCode: number | null,
 *   signal: string | null,
 *   stdout: string,
 *   stderr: string,
 *   error: Error | null,
 *   timedOut: boolean,
 *   durationMs: number,
 *   command: string,
 *   args: string[],
 *   cwd: string,
 * }>}
 */
export function spawnCompile(opts) {
  const {
    command,
    args = [],
    cwd,
    env = {},
    timeoutMs = Number(process.env.FIRMWARE_BUILD_TIMEOUT_MS) || DEFAULT_COMPILE_TIMEOUT_MS,
    onStdout,
    onStderr,
  } = opts;

  const started = Date.now();
  let stdout = '';
  let stderr = '';
  let settled = false;
  let timedOut = false;
  /** @type {NodeJS.Timeout | null} */
  let timeoutTimer = null;
  /** @type {NodeJS.Timeout | null} */
  let killTimer = null;

  const spawnEnv = {
    ...process.env,
    ...env,
    CI: '1',
    NO_COLOR: '1',
    TERM: 'dumb',
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    PIP_DISABLE_PIP_VERSION_CHECK: '1',
    PLATFORMIO_SETTING_ENABLE_PROMPTS: 'false',
  };

  debugLog('SPAWN', `${command} ${args.join(' ')} | cwd=${cwd} | timeout=${timeoutMs}ms`);

  return new Promise((resolve) => {
    /** @param {import('child_process').ChildProcess | null} child */
    const destroyStreams = (child) => {
      try { child?.stdout?.removeAllListeners('data'); } catch { /* ignore */ }
      try { child?.stderr?.removeAllListeners('data'); } catch { /* ignore */ }
      try { child?.stdout?.destroy(); } catch { /* ignore */ }
      try { child?.stderr?.destroy(); } catch { /* ignore */ }
    };

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      destroyStreams(child);
      const trimmed = trimCapture(stdout, stderr);
      resolve({
        ...payload,
        stdout: trimmed.stdout,
        stderr: trimmed.stderr,
        durationMs: Date.now() - started,
        command,
        args,
        cwd,
      });
    };

    const child = spawn(command, args, {
      cwd,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: spawnEnv,
      windowsHide: true,
    });

    const append = (chunk, stream) => {
      const text = String(chunk || '');
      if (stream === 'stdout') stdout += text;
      else stderr += text;
      const trimmed = trimCapture(stdout, stderr);
      stdout = trimmed.stdout;
      stderr = trimmed.stderr;
      if (stream === 'stdout') {
        if (text) debugLog('STDOUT', text);
        onStdout?.(text);
      } else if (text) {
        debugLog('STDERR', text);
        onStderr?.(text);
      }
    };

    child.stdout?.on('data', (chunk) => append(chunk, 'stdout'));
    child.stderr?.on('data', (chunk) => append(chunk, 'stderr'));

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      debugLog('TIMEOUT', `elapsed ${timeoutMs}ms — SIGTERM process group`);
      killProcessTree(child, 'SIGTERM');
      killTimer = setTimeout(() => {
        debugLog('TIMEOUT', 'grace period over — SIGKILL');
        killProcessTree(child, 'SIGKILL');
      }, 5000);
    }, timeoutMs);
    timeoutTimer.unref?.();

    child.on('error', (error) => {
      debugLog('EXIT', `spawn error: ${error.message}`);
      finish({
        exitCode: null,
        signal: null,
        error,
        timedOut: false,
      });
    });

    child.on('exit', (exitCode, signal) => {
      debugLog('EXIT', `code=${exitCode} signal=${signal || 'none'} timedOut=${timedOut}`);
      const code = exitCode == null ? 1 : exitCode;
      finish({
        exitCode: timedOut ? 124 : code,
        signal: timedOut ? 'SIGTERM' : (signal || null),
        error: timedOut ? new Error(formatCompileTimeoutMessage(timeoutMs)) : null,
        timedOut,
      });
    });
  });
}

export { DEFAULT_COMPILE_TIMEOUT_MS };
