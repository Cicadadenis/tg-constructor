import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawnCompile } from './espCompileService.mjs';
import { atomicWriteFile } from './secureFs.mjs';
import { buildEspWebManifest, yamlSupportsImprovWifi } from './espManifest.mjs';

const JOBS_ROOT = path.resolve(
  process.env.ESPHOME_JOBS_ROOT || '/tmp/esphome-jobs',
);
const DOWNLOAD_TTL_MS = Math.max(
  60_000,
  Number(process.env.FIRMWARE_DOWNLOAD_TTL_MS) || 60 * 60 * 1000,
);
const CLEANUP_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.ESPHOME_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000,
);
const JOB_META_TTL_MS = Math.max(
  DOWNLOAD_TTL_MS,
  Number(process.env.ESPHOME_JOB_META_TTL_MS) || 30 * 60 * 1000,
);
const MAX_CONCURRENT_BUILDS = Math.max(
  1,
  Math.min(
    os.cpus().length || 4,
    Number(process.env.ESPHOME_MAX_CONCURRENT_BUILDS) || 4,
  ),
);
const JOB_LOG_MAX = 512 * 1024;
const FIRMWARE_BIN_NAME = 'esp.bin';
const MANIFEST_NAME = 'manifest.json';
const META_NAME = 'build-meta.json';
const JOB_STATE_NAME = 'job-state.json';
const JOB_ID_RE = /^[a-f0-9]{24}$/;

/** @type {Map<string, JobRecord>} */
const jobs = new Map();
/** @type {string[]} */
const waitQueue = [];
/** @type {Map<string, number>} */
const activeDownloads = new Map();
let runningBuilds = 0;
let cleanupTimer = null;
let pumpScheduled = false;
/** @type {Map<string, NodeJS.Timeout>} */
const persistTimers = new Map();

/**
 * @typedef {Object} JobRecord
 * @property {string} id
 * @property {string} ownerUserId
 * @property {'queued'|'compiling'|'success'|'failed'|'timeout'} status
 * @property {string} stage
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number|null} expiresAt
 * @property {string} jobDir
 * @property {string} log
 * @property {string|null} binPath
 * @property {string|null} manifestPath
 * @property {string|null} metaPath
 * @property {object|null} result
 * @property {object|null} error
 * @property {boolean} cleanupStarted
 * @property {string} [requestYaml]
 * @property {string} [requestPlatformioIni]
 * @property {string} [requestDeviceName]
 */

/** @param {object|null|undefined} meta */
export function sanitizeFirmwareMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const { apiEncryptionKey, ...rest } = meta;
  return rest;
}

export function assertFirmwareJobOwned(job, userId) {
  if (!job) {
    const err = new Error('Задача сборки не найдена');
    err.statusCode = 404;
    throw err;
  }
  if (!userId || job.ownerUserId !== userId) {
    const err = new Error('Нет доступа к задаче сборки');
    err.statusCode = 403;
    throw err;
  }
}

function debugLog(tag, message, jobId = '') {
  const prefix = jobId ? ` job=${jobId}` : '';
  const line = String(message ?? '').replace(/\s+/g, ' ').trim();
  const preview = line.length > 400 ? `${line.slice(0, 400)}…` : line;
  console.log(`[${tag}]${prefix} ${preview}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimEnv(v) {
  return String(v || '').trim();
}

const PROJECT_ESPHOME_VENV_BIN = path.resolve(process.cwd(), '.venv-esphome', 'bin', 'esphome');

function resolveExecutableBin(envKey, defaultName, projectVenvBin) {
  const fromEnv = trimEnv(process.env[envKey]);
  const candidates = [];
  if (fromEnv) {
    candidates.push(
      path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv),
      fromEnv,
    );
  }
  if (fs.existsSync(projectVenvBin)) candidates.push(projectVenvBin);
  candidates.push(defaultName);
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === defaultName) return candidate;
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // ignore
    }
  }
  return fromEnv || defaultName;
}

function resolveEsphomeBin() {
  return resolveExecutableBin('ESPHOME_BIN', 'esphome', PROJECT_ESPHOME_VENV_BIN);
}

function resolvePlatformioBin() {
  const envKey = trimEnv(process.env.PIO_BIN)
    ? 'PIO_BIN'
    : (trimEnv(process.env.PLATFORMIO_BIN) ? 'PLATFORMIO_BIN' : 'PIO_BIN');
  const projectPio = path.resolve(process.cwd(), '.venv-esphome', 'bin', 'pio');
  return resolveExecutableBin(envKey, 'pio', projectPio);
}

function buildSpawnNotFoundError(tool, bin) {
  const err = new Error(
    `${tool} не найден (${bin}). Установите ESPHome CLI на сервере.`,
  );
  err.code = 'FIRMWARE_BUILD_FAILED';
  return err;
}

function tailLog(text, maxLines = 120) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines).join('\n');
}

function jobStateFile(jobDir) {
  return path.join(jobDir, JOB_STATE_NAME);
}

function snapshotJob(job) {
  const result = job.result
    ? {
      ...job.result,
      meta: sanitizeFirmwareMeta(job.result.meta),
    }
    : job.result;
  return {
    id: job.id,
    ownerUserId: job.ownerUserId,
    status: job.status,
    stage: job.stage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    expiresAt: job.expiresAt,
    jobDir: job.jobDir,
    log: job.log,
    binPath: job.binPath,
    manifestPath: job.manifestPath,
    metaPath: job.metaPath,
    result,
    error: job.error,
    cleanupStarted: job.cleanupStarted,
    requestDeviceName: job.requestDeviceName,
  };
}

function reviveJob(snapshot) {
  const jobDir = path.join(JOBS_ROOT, snapshot.id);
  return {
    id: snapshot.id,
    ownerUserId: snapshot.ownerUserId || '',
    status: snapshot.status,
    stage: snapshot.stage,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    expiresAt: snapshot.expiresAt ?? null,
    jobDir,
    log: snapshot.log || '',
    binPath: snapshot.binPath ?? null,
    manifestPath: snapshot.manifestPath ?? null,
    metaPath: snapshot.metaPath ?? null,
    result: snapshot.result ?? null,
    error: snapshot.error ?? null,
    cleanupStarted: Boolean(snapshot.cleanupStarted),
    requestYaml: '',
    requestPlatformioIni: '',
    requestDeviceName: snapshot.requestDeviceName,
  };
}

async function persistJob(job) {
  if (!job?.id || !job.jobDir) return;
  await fsp.mkdir(job.jobDir, { recursive: true });
  await atomicWriteFile(
    jobStateFile(job.jobDir),
    `${JSON.stringify(snapshotJob(job))}\n`,
  );
  job.updatedAt = Date.now();
}

function schedulePersistJob(job) {
  if (!job?.id) return;
  const existing = persistTimers.get(job.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    persistTimers.delete(job.id);
    persistJob(job).catch((e) => {
      debugLog('PERSIST', e.message, job.id);
    });
  }, 1500);
  timer.unref?.();
  persistTimers.set(job.id, timer);
}

function appendJobLog(job, chunk) {
  if (!chunk) return;
  job.log += String(chunk);
  if (job.log.length > JOB_LOG_MAX) {
    job.log = job.log.slice(job.log.length - JOB_LOG_MAX);
  }
  job.updatedAt = Date.now();
  if (job.status === 'compiling') schedulePersistJob(job);
}

function versionFromMtime(mtimeMs) {
  const d = new Date(mtimeMs || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

export function extractApiEncryptionKeyFromYaml(yamlText) {
  if (!yamlText || typeof yamlText !== 'string') return null;
  const lines = yamlText.split('\n');
  let inApi = false;
  let inEncryption = false;
  let apiIndent = -1;
  let encIndent = -1;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = line.length - trimmed.length;
    if (/^api\s*:/.test(trimmed)) {
      inApi = true;
      inEncryption = false;
      apiIndent = indent;
      continue;
    }
    if (inApi && apiIndent >= 0 && indent <= apiIndent && !/^encryption\s*:/.test(trimmed)) {
      inApi = false;
      inEncryption = false;
    }
    if (inApi && /^encryption\s*:/.test(trimmed)) {
      inEncryption = true;
      encIndent = indent;
      continue;
    }
    if (inEncryption && encIndent >= 0 && indent <= encIndent) inEncryption = false;
    if ((inApi || inEncryption) && /^key\s*:/.test(trimmed)) {
      const m = trimmed.match(/^key\s*:\s*["']?([^"'\s#]+)["']?/);
      if (m?.[1]) return m[1];
    }
  }
  const fallback = yamlText.match(/encryption\s*:\s*\n\s*key\s*:\s*["']?([^"'\s#]+)["']?/m);
  return fallback?.[1] || null;
}

async function detectChipFamiliesFromYaml(yamlText) {
  const envRaw = trimEnv(process.env.FIRMWARE_CHIP_FAMILY);
  if (envRaw) {
    const parts = envRaw.split(/[,|]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    const out = [];
    if (parts.some((p) => p.includes('8266'))) out.push('ESP8266');
    if (parts.some((p) => p.includes('32'))) out.push('ESP32');
    if (out.length) return [...new Set(out)];
  }
  const families = new Set();
  if (/^\s*esp32\s*:/m.test(yamlText) || /platform:\s*esp32/m.test(yamlText)) families.add('ESP32');
  if (/^\s*esp8266\s*:/m.test(yamlText) || /platform:\s*esp8266/m.test(yamlText)) families.add('ESP8266');
  if (families.size) return [...families];
  return ['ESP32', 'ESP8266'];
}


/**
 * @param {string} jobDir
 * @returns {Promise<{ tool: 'esphome'|'platformio', cwd: string, configFile: string } | null>}
 */
async function detectBuildSystemInJobDir(jobDir) {
  const pioIni = path.join(jobDir, 'platformio.ini');
  if (fs.existsSync(pioIni)) {
    return { tool: 'platformio', cwd: jobDir, configFile: pioIni };
  }
  for (const name of ['esphome.yaml', 'config.yaml']) {
    const fp = path.join(jobDir, name);
    if (!fs.existsSync(fp)) continue;
    try {
      const text = await fsp.readFile(fp, 'utf8');
      if (name === 'esphome.yaml' || /^\s*esphome\s*:/m.test(text)) {
        return { tool: 'esphome', cwd: jobDir, configFile: fp };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

const FIRMWARE_MAX_BYTES = 16 * 1024 * 1024;

async function findNewestBinaryUnder(dir, patterns) {
  if (!fs.existsSync(dir)) return null;
  let best = null;

  const walk = async (current) => {
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue;
        await walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      const lower = ent.name.toLowerCase();
      const rank = patterns.findIndex(
        (p) => lower === p.toLowerCase() || lower.endsWith(p.toLowerCase()),
      );
      if (rank < 0) continue;
      let st;
      try {
        st = await fsp.stat(full);
      } catch {
        continue;
      }
      if (st.size < 1024 || st.size > FIRMWARE_MAX_BYTES) continue;
      const score = st.mtimeMs + (patterns.length - rank) * 1e15;
      if (!best || score > best.score) {
        best = { path: full, mtimeMs: st.mtimeMs, size: st.size, rank, name: ent.name, score };
      }
    }
  };

  await walk(dir);
  return best;
}

async function discoverFirmwareBinaryInJobDir(jobDir) {
  const patterns = [
    'firmware.factory.bin',
    'firmware.bin',
    'esp.bin',
  ];
  const found = await findNewestBinaryUnder(jobDir, patterns);
  if (found) return found;
  const pio = await findNewestBinaryUnder(path.join(jobDir, '.pio', 'build'), ['firmware.bin']);
  return pio;
}

function buildFailureFromRun(run, detected, toolBin) {
  const log = tailLog(`${run.stdout || ''}\n${run.stderr || ''}`);
  if (run.error?.code === 'ENOENT') {
    const err = buildSpawnNotFoundError(
      detected.tool === 'esphome' ? 'ESPHome CLI' : 'PlatformIO',
      toolBin,
    );
    err.log = log;
    err.stderr = run.stderr || '';
    err.exitCode = run.exitCode;
    return err;
  }
  if (run.timedOut) {
    const err = new Error(run.error?.message || 'Превышено время ожидания сборки прошивки');
    err.code = 'FIRMWARE_BUILD_TIMEOUT';
    err.log = log;
    err.stderr = run.stderr || '';
    err.exitCode = run.exitCode ?? 124;
    return err;
  }
  if (run.error) {
    const err = new Error(run.error.message || 'build process error');
    err.code = 'FIRMWARE_BUILD_FAILED';
    err.log = log;
    err.stderr = run.stderr || '';
    err.exitCode = run.exitCode;
    return err;
  }
  if (run.exitCode !== 0) {
    const err = new Error(`Сборка завершилась с кодом ${run.exitCode}`);
    err.code = 'FIRMWARE_BUILD_FAILED';
    err.log = log;
    err.stderr = run.stderr || '';
    err.exitCode = run.exitCode;
    return err;
  }
  return null;
}

function isolatedCompileEnv(jobDir) {
  const root = path.resolve(jobDir);
  const sharedPio = trimEnv(process.env.ESPHOME_PLATFORMIO_HOME)
    || path.resolve(process.cwd(), '.cache', 'platformio');
  return {
    PLATFORMIO_CORE_DIR: sharedPio,
    PLATFORMIO_HOME_DIR: sharedPio,
    PLATFORMIO_SETTING_ENABLE_PROMPTS: 'false',
    ESPHOME_BUILD_PATH: path.join(root, '.esphome', 'build'),
  };
}

async function runConfigValidateInJob(job, detected) {
  if (detected.tool !== 'esphome') return null;
  const esphomeBin = resolveEsphomeBin();
  const configName = path.basename(detected.configFile);
  appendJobLog(job, 'INFO: проверка конфигурации (esphome config)…\n');
  const run = await spawnCompile({
    command: esphomeBin,
    args: ['config', configName],
    cwd: detected.cwd,
    env: isolatedCompileEnv(job.jobDir),
    onStdout: (chunk) => appendJobLog(job, chunk),
    onStderr: (chunk) => appendJobLog(job, chunk),
  });
  const failure = buildFailureFromRun(run, detected, esphomeBin);
  if (failure) {
    failure.code = 'FIRMWARE_CONFIG_INVALID';
    failure.message = failure.message || 'Ошибка валидации ESPHome YAML';
  }
  return failure;
}

async function runCompileInJob(job, detected) {
  const esphomeBin = resolveEsphomeBin();
  const pioBin = resolvePlatformioBin();
  const onChunk = (chunk) => appendJobLog(job, chunk);
  const env = isolatedCompileEnv(job.jobDir);

  if (detected.tool === 'esphome') {
    const configName = path.basename(detected.configFile);
    return {
      run: await spawnCompile({
        command: esphomeBin,
        args: ['compile', configName],
        cwd: detected.cwd,
        env,
        onStdout: onChunk,
        onStderr: onChunk,
      }),
      toolBin: esphomeBin,
    };
  }

  return {
    run: await spawnCompile({
      command: pioBin,
      args: ['run'],
      cwd: detected.cwd,
      env,
      onStdout: onChunk,
      onStderr: onChunk,
    }),
    toolBin: pioBin,
  };
}

async function writeJobConfig(jobDir, { yaml, platformioIni }) {
  const yamlText = String(yaml || '').trim();
  const pioText = String(platformioIni || '').trim();

  if (yamlText) {
    if (yamlText.length > 512_000) {
      const err = new Error('esphome yaml too large');
      err.code = 'FIRMWARE_CONFIG_TOO_LARGE';
      throw err;
    }
    await atomicWriteFile(path.join(jobDir, 'esphome.yaml'), `${yamlText}\n`);
  }
  if (pioText) {
    if (pioText.length > 256_000) {
      const err = new Error('platformio.ini too large');
      err.code = 'FIRMWARE_CONFIG_TOO_LARGE';
      throw err;
    }
    await atomicWriteFile(path.join(jobDir, 'platformio.ini'), `${pioText}\n`);
  }
}

async function finalizeSuccessJob(job, { detected, run, toolBin, deviceName, yamlText }) {
  const discovered = await discoverFirmwareBinaryInJobDir(job.jobDir);
  if (!discovered) {
    const err = new Error('Сборка завершена, но firmware.bin не найден в каталоге задачи');
    err.code = 'FIRMWARE_NOT_FOUND';
    err.log = tailLog(job.log);
    throw err;
  }

  const destBin = path.join(job.jobDir, FIRMWARE_BIN_NAME);
  await fsp.copyFile(discovered.path, destBin);
  job.binPath = destBin;

  const chipFamilies = await detectChipFamiliesFromYaml(yamlText || '');
  const version = versionFromMtime(discovered.mtimeMs);
  const name = trimEnv(deviceName) || trimEnv(process.env.FIRMWARE_DEVICE_NAME) || 'Cicada ESP Device';
  const manifest = buildEspWebManifest({
    name,
    version,
    chipFamilies,
    binPath: FIRMWARE_BIN_NAME,
    improvWifi: yamlSupportsImprovWifi(yamlText),
  });
  job.manifestPath = path.join(job.jobDir, MANIFEST_NAME);
  await atomicWriteFile(job.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const expiresAt = Date.now() + DOWNLOAD_TTL_MS;
  job.expiresAt = expiresAt;

  const apiEncryptionKey = extractApiEncryptionKeyFromYaml(yamlText || '');
  const meta = {
    updatedAt: new Date().toISOString(),
    deviceName: name,
    version,
    chipFamilies,
    source: detected.tool,
    size: discovered.size,
    jobId: job.id,
    sessionId: job.id,
    expiresAt: new Date(expiresAt).toISOString(),
    ephemeral: true,
    downloadTtlMs: DOWNLOAD_TTL_MS,
    ...(apiEncryptionKey ? { apiEncryptionKey } : {}),
  };
  job.metaPath = path.join(job.jobDir, META_NAME);
  await atomicWriteFile(job.metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  for (const cfgName of ['esphome.yaml', 'config.yaml', 'platformio.ini']) {
    try {
      await fsp.unlink(path.join(job.jobDir, cfgName));
    } catch {
      // ignore
    }
  }

  job.status = 'success';
  job.stage = 'done';
  job.result = {
    build: {
      tool: detected.tool,
      cwd: detected.cwd,
      configFile: detected.configFile,
      durationMs: run.durationMs,
      command: run.command,
      args: run.args,
      exitCode: run.exitCode,
    },
    meta,
    manifest,
    sessionId: job.id,
    jobId: job.id,
    firmwarePath: destBin,
    downloadUrl: `/firmware/esp.bin?buildJob=${encodeURIComponent(job.id)}`,
    log: tailLog(job.log || `${run.stdout || ''}\n${run.stderr || ''}`),
    expiresAt: meta.expiresAt,
  };
  job.log = job.result.log;
  job.requestYaml = '';
  job.requestPlatformioIni = '';
  job.updatedAt = Date.now();
  await persistJob(job);
  debugLog('EXIT', `success bin=${destBin} expires=${meta.expiresAt}`, job.id);
}

function markJobFailed(job, e, status = 'failed') {
  job.status = status;
  job.stage = status;
  job.expiresAt = null;
  const combinedLog = tailLog(job.log || e.log || e.stderr || '');
  job.error = {
    message: e.message || 'Ошибка сборки',
    code: e.code || '',
    log: combinedLog,
    stderr: e.stderr || combinedLog,
    exitCode: e.exitCode ?? null,
    hint: e.hint || '',
  };
  if (!job.log && combinedLog) job.log = combinedLog;
  job.updatedAt = Date.now();
  persistJob(job).catch((err) => {
    debugLog('PERSIST', err.message, job.id);
  });
  debugLog('EXIT', `failed code=${e.code || ''} msg=${e.message}`, job.id);
}

function getActiveDownloadCount(jobId) {
  return activeDownloads.get(jobId) || 0;
}

export function registerActiveDownload(jobId) {
  const id = String(jobId || '').trim();
  activeDownloads.set(id, getActiveDownloadCount(id) + 1);
  debugLog('CLEANUP', `download stream started (active=${activeDownloads.get(id)})`, id);
}

export function unregisterActiveDownload(jobId) {
  const id = String(jobId || '').trim();
  const next = getActiveDownloadCount(id) - 1;
  if (next <= 0) {
    activeDownloads.delete(id);
    debugLog('CLEANUP', 'download stream ended', id);
  } else {
    activeDownloads.set(id, next);
    debugLog('CLEANUP', `download stream ended (active=${next})`, id);
  }
}

/** Load a persisted job into memory (e.g. after server restart, before download). */
export async function ensureJobInMemory(jobId) {
  const id = String(jobId || '').trim();
  if (!JOB_ID_RE.test(id)) return null;
  const existing = jobs.get(id);
  if (existing) return existing;

  const statePath = jobStateFile(path.join(JOBS_ROOT, id));
  let snapshot;
  try {
    snapshot = JSON.parse(await fsp.readFile(statePath, 'utf8'));
  } catch {
    return null;
  }
  const job = reviveJob(snapshot);
  if (isJobExpired(job)) return null;
  jobs.set(job.id, job);
  debugLog('BOOT', `restored job for download`, id);
  return job;
}

async function safeRm(target, jobId, reason) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fsp.rm(target, { recursive: true, force: true, maxRetries: 0 });
      debugLog('DELETE', `${reason}: removed ${target}`, jobId);
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') {
        debugLog('DELETE', `${reason}: already gone ${target}`, jobId);
        return true;
      }
      if (e.code === 'EBUSY' && attempt < 5) {
        debugLog('CLEANUP', `${reason}: EBUSY retry ${attempt + 1}/5 ${target}`, jobId);
        await sleep(150 * (attempt + 1));
        continue;
      }
      debugLog('DELETE', `${reason}: failed ${e.code} ${target}`, jobId);
      return false;
    }
  }
  return false;
}

async function scheduleJobCleanup(jobId, reason) {
  const id = String(jobId || '').trim();
  const job = jobs.get(id);
  if (!job || job.cleanupStarted) return;
  if (getActiveDownloadCount(id) > 0) {
    debugLog('CLEANUP', `deferred (${reason}): active download`, id);
    return;
  }
  job.cleanupStarted = true;
  debugLog('CLEANUP', `start (${reason})`, id);
  await safeRm(job.jobDir, id, reason);
  jobs.delete(id);
  debugLog('CLEANUP', `finished (${reason})`, id);
}

function isJobExpired(job) {
  if (job.status === 'success' && job.expiresAt && job.expiresAt <= Date.now()) {
    return true;
  }
  if ((job.status === 'failed' || job.status === 'timeout') && job.updatedAt + 60_000 <= Date.now()) {
    return true;
  }
  if (job.updatedAt + JOB_META_TTL_MS <= Date.now()) {
    return true;
  }
  return false;
}

async function runExpireSweep() {
  debugLog('EXPIRE', 'daemon sweep start');
  const now = Date.now();
  for (const [id, job] of [...jobs.entries()]) {
    if (getActiveDownloadCount(id) > 0) continue;
    const expired = isJobExpired(job)
      || (job.status === 'success' && job.expiresAt && job.expiresAt <= now);
    if (expired) {
      debugLog('EXPIRE', `job ${job.status} expired`, id);
      await scheduleJobCleanup(id, 'expire');
    }
  }
  debugLog('EXPIRE', 'daemon sweep end');
}

function schedulePump() {
  if (pumpScheduled) return;
  pumpScheduled = true;
  setImmediate(() => {
    pumpScheduled = false;
    pumpQueue();
  });
}

function queueMetricsFor(jobId) {
  const pos = waitQueue.indexOf(jobId);
  return {
    queuePosition: pos >= 0 ? pos + 1 : 0,
    queueLength: waitQueue.length,
    runningBuilds,
    maxConcurrent: MAX_CONCURRENT_BUILDS,
  };
}

function pumpQueue() {
  while (runningBuilds < MAX_CONCURRENT_BUILDS && waitQueue.length > 0) {
    const jobId = waitQueue.shift();
    const job = jobs.get(jobId);
    if (!job) continue;
    if (job.status !== 'queued') continue;
    runningBuilds += 1;
    job.status = 'compiling';
    job.stage = 'compiling';
    job.updatedAt = Date.now();
    appendJobLog(job, 'INFO: слот сборки выделен, запуск ESPHome/PlatformIO…\n');
    persistJob(job).catch((e) => {
      debugLog('PERSIST', e.message, jobId);
    });
    debugLog('SPAWN', `dequeue (running=${runningBuilds}/${MAX_CONCURRENT_BUILDS})`, jobId);
    executeJob(job)
      .catch((e) => {
        debugLog('EXIT', `unhandled ${e.message}`, jobId);
      })
      .finally(() => {
        runningBuilds = Math.max(0, runningBuilds - 1);
        schedulePump();
      });
  }
}

async function executeJob(job) {
  const yamlText = job.requestYaml || '';
  try {
    await fsp.mkdir(job.jobDir, { recursive: true });
    await writeJobConfig(job.jobDir, {
      yaml: job.requestYaml,
      platformioIni: job.requestPlatformioIni,
    });

    const detected = await detectBuildSystemInJobDir(job.jobDir);
    if (!detected) {
      const err = new Error('Не найден esphome.yaml или platformio.ini в задаче сборки');
      err.code = 'FIRMWARE_BUILD_CONFIG_MISSING';
      throw err;
    }

    const configFailure = await runConfigValidateInJob(job, detected);
    if (configFailure) {
      markJobFailed(job, configFailure, 'failed');
      await scheduleJobCleanup(job.id, 'config-invalid');
      return;
    }

    const { run, toolBin } = await runCompileInJob(job, detected);
    const failure = buildFailureFromRun(run, detected, toolBin);
    if (failure) {
      if (failure.code === 'FIRMWARE_BUILD_TIMEOUT') {
        markJobFailed(job, failure, 'timeout');
      } else {
        markJobFailed(job, failure, 'failed');
      }
      await scheduleJobCleanup(job.id, 'build-failed');
      return;
    }

    await finalizeSuccessJob(job, {
      detected,
      run,
      toolBin,
      deviceName: job.requestDeviceName,
      yamlText,
    });
  } catch (e) {
    if (job.status !== 'timeout') {
      markJobFailed(job, e, e.code === 'FIRMWARE_BUILD_TIMEOUT' ? 'timeout' : 'failed');
    }
    await scheduleJobCleanup(job.id, 'build-error');
  }
}

/**
 * @param {{ yaml?: string, platformioIni?: string, deviceName?: string, userId: string }} opts
 */
export function startFirmwareBuildJob(opts = {}) {
  const userId = String(opts.userId || '').trim();
  if (!userId) {
    const err = new Error('Необходима авторизация');
    err.statusCode = 401;
    throw err;
  }

  const yamlText = opts.yaml != null ? String(opts.yaml).trim() : '';
  const pioText = opts.platformioIni != null ? String(opts.platformioIni).trim() : '';

  if (!yamlText && !pioText) {
    const err = new Error('Передайте yaml или platformioIni для сборки');
    err.code = 'FIRMWARE_BUILD_CONFIG_MISSING';
    throw err;
  }

  const jobId = crypto.randomBytes(12).toString('hex');
  const jobDir = path.join(JOBS_ROOT, jobId);

  /** @type {JobRecord} */
  const job = {
    id: jobId,
    ownerUserId: userId,
    status: 'queued',
    stage: 'queued',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: null,
    jobDir,
    log: '',
    binPath: null,
    manifestPath: null,
    metaPath: null,
    result: null,
    error: null,
    cleanupStarted: false,
    requestYaml: yamlText,
    requestPlatformioIni: pioText,
    requestDeviceName: opts.deviceName,
  };

  jobs.set(jobId, job);
  waitQueue.push(jobId);
  debugLog('SPAWN', `queued (queue=${waitQueue.length} running=${runningBuilds})`, jobId);

  persistJob(job).catch((e) => {
    debugLog('PERSIST', e.message, jobId);
  });
  schedulePump();

  return {
    jobId,
    status: 'queued',
    pollUrl: `/api/firmware/build/job/${jobId}`,
  };
}

function serializeJob(job) {
  const base = {
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    startedAt: job.createdAt,
    updatedAt: job.updatedAt,
    log: job.log ? tailLog(job.log, 120) : '',
    expiresAt: job.expiresAt ? new Date(job.expiresAt).toISOString() : null,
    ...queueMetricsFor(job.id),
  };
  if (job.status === 'success' && job.result) {
    const apiKey = job.result.meta?.apiEncryptionKey;
    return {
      ...base,
      success: true,
      meta: sanitizeFirmwareMeta(job.result.meta),
      manifest: job.result.manifest,
      build: job.result.build,
      sessionId: job.id,
      jobId: job.id,
      firmwarePath: job.binPath,
      downloadUrl: job.result.downloadUrl,
      ...(apiKey ? { apiEncryptionKey: String(apiKey) } : {}),
      log: job.result.log || base.log,
    };
  }
  if ((job.status === 'failed' || job.status === 'timeout') && job.error) {
    return { ...base, status: job.status, error: job.error };
  }
  return base;
}

export function getFirmwareBuildJob(jobId, userId) {
  const id = String(jobId || '').trim();
  if (!JOB_ID_RE.test(id)) return null;
  const job = jobs.get(id);
  if (!job) return null;
  try {
    assertFirmwareJobOwned(job, userId);
  } catch {
    return null;
  }
  return serializeJob(job);
}

export function getJobRecord(jobId, userId) {
  const id = String(jobId || '').trim();
  if (!JOB_ID_RE.test(id)) return null;
  const job = jobs.get(id);
  if (!job) return null;
  if (userId && job.ownerUserId !== userId) return null;
  return job;
}

export function resolveJobFirmwareBin(jobId, userId) {
  const job = getJobRecord(jobId, userId);
  if (!job || job.status !== 'success' || !job.binPath) return null;
  if (job.expiresAt && job.expiresAt <= Date.now()) return null;
  return fs.existsSync(job.binPath) ? job.binPath : null;
}

export function resolveJobManifestFile(jobId, userId) {
  const job = getJobRecord(jobId, userId);
  if (!job || job.status !== 'success' || !job.manifestPath) return null;
  if (job.expiresAt && job.expiresAt <= Date.now()) return null;
  return fs.existsSync(job.manifestPath) ? job.manifestPath : null;
}

export async function readJobFirmwareMeta(jobId, userId) {
  const job = getJobRecord(jobId, userId);
  if (!job) return null;
  let meta = null;
  if (job.metaPath && fs.existsSync(job.metaPath)) {
    try {
      meta = JSON.parse(await fsp.readFile(job.metaPath, 'utf8'));
    } catch {
      meta = job.result?.meta || null;
    }
  } else {
    meta = job.result?.meta || null;
  }
  return sanitizeFirmwareMeta(meta);
}

/** Ключ API из meta задачи — только для владельца (страница прошивки). */
export async function readJobApiEncryptionKey(jobId, userId) {
  const job = getJobRecord(jobId, userId);
  if (!job) return null;
  let meta = null;
  if (job.metaPath && fs.existsSync(job.metaPath)) {
    try {
      meta = JSON.parse(await fsp.readFile(job.metaPath, 'utf8'));
    } catch {
      meta = job.result?.meta || null;
    }
  } else {
    meta = job.result?.meta || null;
  }
  const key = meta?.apiEncryptionKey;
  return key ? String(key).trim() : null;
}

export function getLatestSuccessfulJobId(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  let latest = null;
  for (const job of jobs.values()) {
    if (job.ownerUserId !== uid) continue;
    if (job.status !== 'success') continue;
    if (job.expiresAt && job.expiresAt <= Date.now()) continue;
    if (!latest || job.updatedAt > latest.updatedAt) latest = job;
  }
  return latest?.id || null;
}

async function restoreJobsFromDisk() {
  let entries = [];
  try {
    entries = await fsp.readdir(JOBS_ROOT, { withFileTypes: true });
  } catch (e) {
    debugLog('BOOT', `readdir failed: ${e.message}`);
    return;
  }

  let restored = 0;
  for (const ent of entries) {
    if (!ent.isDirectory() || !JOB_ID_RE.test(ent.name)) continue;
    const statePath = jobStateFile(path.join(JOBS_ROOT, ent.name));
    let snapshot;
    try {
      snapshot = JSON.parse(await fsp.readFile(statePath, 'utf8'));
    } catch {
      await safeRm(path.join(JOBS_ROOT, ent.name), ent.name, 'boot-orphan');
      continue;
    }
    const job = reviveJob(snapshot);
    if (isJobExpired(job)) {
      await safeRm(job.jobDir, job.id, 'boot-expired');
      continue;
    }
    if (!job.ownerUserId) {
      await safeRm(job.jobDir, job.id, 'boot-no-owner');
      continue;
    }
    jobs.set(job.id, job);
    restored += 1;
    if (job.status === 'queued' || job.status === 'compiling') {
      job.status = 'failed';
      job.stage = 'failed';
      job.error = {
        message: 'Сборка прервана перезапуском сервера. Запустите сборку снова.',
        code: 'FIRMWARE_BUILD_INTERRUPTED',
        log: tailLog(job.log),
        stderr: '',
        exitCode: null,
        hint: '',
      };
      await persistJob(job);
      await scheduleJobCleanup(job.id, 'boot-interrupted');
    }
  }
  debugLog('BOOT', `restored ${restored} jobs, queue=${waitQueue.length}`);
}

export async function initEspBuildJobServer() {
  await fsp.mkdir(JOBS_ROOT, { recursive: true });
  jobs.clear();
  waitQueue.length = 0;
  runningBuilds = 0;
  activeDownloads.clear();

  await restoreJobsFromDisk();

  if (cleanupTimer) clearInterval(cleanupTimer);
  cleanupTimer = setInterval(() => {
    runExpireSweep().catch((e) => {
      debugLog('EXPIRE', `sweep error: ${e.message}`);
    });
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();

  schedulePump();
  debugLog('CLEANUP', `server ready root=${JOBS_ROOT} maxConcurrent=${MAX_CONCURRENT_BUILDS} ttl=${DOWNLOAD_TTL_MS}ms`);
}

export function stopEspBuildJobServer() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

export {
  JOBS_ROOT,
  DOWNLOAD_TTL_MS,
  FIRMWARE_BIN_NAME,
  JOB_ID_RE,
};
