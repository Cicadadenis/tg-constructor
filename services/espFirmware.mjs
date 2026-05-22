import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { atomicWriteFile } from './secureFs.mjs';
import {
  startFirmwareBuildJob,
  getFirmwareBuildJob,
  resolveJobFirmwareBin,
  resolveJobManifestFile,
  readJobFirmwareMeta,
  getLatestSuccessfulJobId,
  initEspBuildJobServer,
  stopEspBuildJobServer,
  sanitizeFirmwareMeta,
  registerActiveDownload,
  unregisterActiveDownload,
} from './espBuildJobServer.mjs';
import { buildEspWebManifest, yamlSupportsImprovWifi } from './espManifest.mjs';

export {
  startFirmwareBuildJob,
  getFirmwareBuildJob,
  sanitizeFirmwareMeta,
  registerActiveDownload,
  unregisterActiveDownload,
};

export const FIRMWARE_PUBLIC_DIR = path.resolve('public/firmware');
export const FIRMWARE_CACHE_DIR = path.resolve('data/firmware-cache');
export const FIRMWARE_BIN_NAME = 'esp.bin';
export const FIRMWARE_MANIFEST_NAME = 'manifest.json';
export const FIRMWARE_LATEST_ALIAS = 'latest.bin';

const FIRMWARE_MAX_BYTES = 16 * 1024 * 1024;
const WATCH_DEBOUNCE_MS = 800;
const FIRMWARE_SESSION_TTL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.FIRMWARE_SESSION_TTL_MS) || 30 * 60 * 1000,
);

/** @type {Map<string, { dir: string, meta: object, manifest: object, expiresAt: number, ownerUserId: string }>} */
const firmwareSessions = new Map();
/** @type {Map<string, string>} */
const latestFirmwareSessionByUser = new Map();
const sessionCleanupTimers = new Map();

/** @type {import('fs').FSWatcher[]} */
const activeWatchers = [];
let watchDebounceTimer = null;

function trimEnv(v) {
  return String(v || '').trim();
}

export function getFirmwareWorkspaceRoot() {
  const raw = trimEnv(process.env.FIRMWARE_WORKSPACE_ROOT || process.env.FIRMWARE_PROJECT_DIR);
  return raw ? path.resolve(raw) : process.cwd();
}

async function ensureFirmwareDir() {
  await fsp.mkdir(FIRMWARE_PUBLIC_DIR, { recursive: true });
}

function getFirmwareSession(sessionId, userId) {
  pruneExpiredFirmwareSessions();
  const id = String(sessionId || '').trim();
  const uid = String(userId || '').trim();
  if (!id || !uid) return null;
  const session = firmwareSessions.get(id);
  if (!session || session.ownerUserId !== uid) return null;
  if (session.expiresAt <= Date.now()) {
    deleteFirmwareSession(id).catch(() => {});
    return null;
  }
  return { id, ...session };
}

function pruneExpiredFirmwareSessions() {
  const now = Date.now();
  for (const [id, session] of firmwareSessions) {
    if (session.expiresAt <= now) {
      deleteFirmwareSession(id).catch(() => {});
    }
  }
}

async function deleteFirmwareSession(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return;
  const timer = sessionCleanupTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    sessionCleanupTimers.delete(id);
  }
  firmwareSessions.delete(id);
  for (const [uid, sid] of latestFirmwareSessionByUser) {
    if (sid === id) latestFirmwareSessionByUser.delete(uid);
  }
  try {
    await fsp.rm(path.join(FIRMWARE_CACHE_DIR, id), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function scheduleFirmwareSessionExpiry(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return;
  const existing = sessionCleanupTimers.get(id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    deleteFirmwareSession(id).catch(() => {});
  }, FIRMWARE_SESSION_TTL_MS);
  timer.unref?.();
  sessionCleanupTimers.set(id, timer);
}

export async function clearPublicFirmwareArtifacts() {
  await ensureFirmwareDir();
  for (const name of [
    FIRMWARE_BIN_NAME,
    FIRMWARE_LATEST_ALIAS,
    FIRMWARE_MANIFEST_NAME,
    'build-meta.json',
  ]) {
    try {
      await fsp.unlink(path.join(FIRMWARE_PUBLIC_DIR, name));
    } catch {
      // ignore
    }
  }
  const distDir = path.resolve('dist/firmware');
  try {
    await fsp.rm(distDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function unlinkBinFilesUnder(dir) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      await unlinkBinFilesUnder(fp);
      continue;
    }
    if (ent.isFile() && /\.bin$/i.test(ent.name)) {
      try {
        await fsp.unlink(fp);
      } catch {
        // ignore
      }
    }
  }
}

/** Удаляет артефакты сборки (.bin) из workspace, YAML не трогает. */
export async function cleanupWorkspaceBuildBins(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  const targets = [
    path.join(root, '.esphome', 'build'),
    path.join(root, '.pio', 'build'),
    path.join(root, 'dist'),
  ];
  for (const dir of targets) {
    await unlinkBinFilesUnder(dir);
  }
}

export async function clearAllFirmwareStorage() {
  for (const id of [...firmwareSessions.keys()]) {
    await deleteFirmwareSession(id);
  }
  await clearPublicFirmwareArtifacts();
  try {
    await fsp.rm(FIRMWARE_CACHE_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
  await fsp.mkdir(FIRMWARE_CACHE_DIR, { recursive: true });
}

/**
 * @param {string} dir
 * @param {string[]} patterns - basename suffixes, e.g. ['firmware.factory.bin', 'firmware.bin']
 */
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
      const rank = patterns.findIndex((p) => lower === p.toLowerCase() || lower.endsWith(p.toLowerCase()));
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
        best = { path: full, mtimeMs: st.mtimeMs, size: st.size, rank, name: ent.name };
        best.score = score;
      }
    }
  };

  await walk(dir);
  return best;
}

/**
 * @param {string} root
 * @returns {Promise<{ path: string, source: string, mtimeMs: number, size: number } | null>}
 */
export async function discoverFirmwareBinary(root = getFirmwareWorkspaceRoot()) {
  const roots = [root];
  const explicit = trimEnv(process.env.FIRMWARE_PROJECT_DIR);
  if (explicit) roots.push(path.resolve(explicit));

  const candidates = [
  ];

  for (const r of roots) {
    if (!r || !fs.existsSync(r)) continue;

    const esphome = await findNewestBinaryUnder(r, [
      'firmware.factory.bin',
      'firmware.bin',
    ]);
    if (esphome) {
      candidates.push({ ...esphome, source: 'esphome', root: r });
    }

    const pio = await findNewestBinaryUnder(path.join(r, '.pio', 'build'), [
      'firmware.bin',
    ]);
    if (pio) {
      candidates.push({ ...pio, source: 'platformio', root: r });
    }

    const pioenvs = await findNewestBinaryUnder(r, [
      'firmware.factory.bin',
      'firmware.bin',
    ]);
    if (pioenvs && pioenvs.path.includes(`${path.sep}.pioenvs${path.sep}`)) {
      candidates.push({ ...pioenvs, source: 'esphome-pioenvs', root: r });
    }

    for (const distName of ['dist/firmware.bin', 'dist/esp.bin', 'firmware.bin', 'esp.bin']) {
      const fp = path.join(r, distName);
      try {
        const st = await fsp.stat(fp);
        if (st.isFile() && st.size >= 1024 && st.size <= FIRMWARE_MAX_BYTES) {
          candidates.push({
            path: fp,
            mtimeMs: st.mtimeMs,
            size: st.size,
            source: 'dist',
            root: r,
            score: st.mtimeMs,
          });
        }
      } catch {
        // ignore
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  const pick = candidates[0];
  return {
    path: pick.path,
    source: pick.source,
    mtimeMs: pick.mtimeMs,
    size: pick.size,
  };
}

/**
 * @param {string} root
 * @returns {Promise<('ESP32'|'ESP8266')[]>}
 */
export async function detectChipFamilies(root = getFirmwareWorkspaceRoot()) {
  const envRaw = trimEnv(process.env.FIRMWARE_CHIP_FAMILY);
  if (envRaw) {
    const parts = envRaw.split(/[,|]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    const out = [];
    if (parts.some((p) => p.includes('8266'))) out.push('ESP8266');
    if (parts.some((p) => p.includes('32'))) out.push('ESP32');
    if (out.length) return [...new Set(out)];
  }

  const families = new Set();
  const yamlNames = ['esphome.yaml', 'config.yaml'];
  const searchDirs = [root, ...yamlNames.map((n) => path.dirname(path.join(root, n)))];

  for (const dir of searchDirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    let files = [];
    try {
      files = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const name of files) {
      if (!/\.ya?ml$/i.test(name)) continue;
      let text = '';
      try {
        text = await fsp.readFile(path.join(dir, name), 'utf8');
      } catch {
        continue;
      }
      if (/^\s*esp32\s*:/m.test(text) || /platform:\s*esp32/m.test(text)) families.add('ESP32');
      if (/^\s*esp8266\s*:/m.test(text) || /platform:\s*esp8266/m.test(text)) families.add('ESP8266');
    }
  }

  if (families.size) return [...families];
  return ['ESP32', 'ESP8266'];
}

function versionFromMtime(mtimeMs) {
  const d = new Date(mtimeMs || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}


async function readEsphomeYamlFromWorkspace(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  const candidates = [
    path.join(root, 'firmware', 'esphome.yaml'),
    path.join(root, 'esphome.yaml'),
    path.join(root, 'config.yaml'),
  ];
  const detected = await detectFirmwareBuildSystem(root);
  if (detected?.configFile) candidates.unshift(detected.configFile);
  for (const fp of candidates) {
    try {
      const text = await fsp.readFile(fp, 'utf8');
      if (/^\s*esphome\s*:/m.test(text) || /^\s*api\s*:/m.test(text)) return text;
    } catch {
      // next
    }
  }
  return null;
}

/**
 * Публикует прошивку во временную сессию (не в public/firmware) и удаляет .bin с диска сборки.
 * @param {string} sessionId
 * @param {{ deviceName?: string, workspaceRoot?: string, chipFamilies?: ('ESP32'|'ESP8266')[] }} opts
 */
export async function publishFirmwareSession(sessionId, opts = {}) {
  const id = String(sessionId || '').trim() || crypto.randomBytes(12).toString('hex');
  const workspaceRoot = opts.workspaceRoot || getFirmwareWorkspaceRoot();
  const discovered = await discoverFirmwareBinary(workspaceRoot);
  if (!discovered) {
    const err = new Error('firmware binary not found');
    err.code = 'FIRMWARE_NOT_FOUND';
    throw err;
  }

  const deviceName = trimEnv(opts.deviceName)
    || trimEnv(process.env.FIRMWARE_DEVICE_NAME)
    || 'Cicada ESP Device';
  const chipFamilies = opts.chipFamilies?.length
    ? opts.chipFamilies
    : await detectChipFamilies(workspaceRoot);
  const version = versionFromMtime(discovered.mtimeMs);
  const yamlText = await readEsphomeYamlFromWorkspace(workspaceRoot);
  const ownerUserId = String(opts.ownerUserId || '').trim();
  if (!ownerUserId) {
    const err = new Error('Необходима авторизация');
    err.statusCode = 401;
    throw err;
  }

  const prevLatest = latestFirmwareSessionByUser.get(ownerUserId);
  if (prevLatest && prevLatest !== id) {
    await deleteFirmwareSession(prevLatest);
  }

  const sessionDir = path.join(FIRMWARE_CACHE_DIR, id);
  await fsp.rm(sessionDir, { recursive: true, force: true });
  await fsp.mkdir(sessionDir, { recursive: true });

  const destBin = path.join(sessionDir, FIRMWARE_BIN_NAME);
  await fsp.copyFile(discovered.path, destBin);

  const manifest = buildEspWebManifest({
    name: deviceName,
    version,
    chipFamilies,
    binPath: FIRMWARE_BIN_NAME,
    improvWifi: yamlSupportsImprovWifi(yamlText),
  });
  const manifestPath = path.join(sessionDir, FIRMWARE_MANIFEST_NAME);
  await atomicWriteFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const meta = {
    updatedAt: new Date().toISOString(),
    deviceName,
    version,
    chipFamilies,
    source: discovered.source,
    size: discovered.size,
    sessionId: id,
    expiresAt: new Date(Date.now() + FIRMWARE_SESSION_TTL_MS).toISOString(),
    ephemeral: true,
  };
  await atomicWriteFile(
    path.join(sessionDir, 'build-meta.json'),
    `${JSON.stringify(meta, null, 2)}\n`,
  );

  firmwareSessions.set(id, {
    dir: sessionDir,
    meta,
    manifest,
    expiresAt: Date.now() + FIRMWARE_SESSION_TTL_MS,
    ownerUserId,
  });
  latestFirmwareSessionByUser.set(ownerUserId, id);
  scheduleFirmwareSessionExpiry(id);

  await clearPublicFirmwareArtifacts();
  await cleanupWorkspaceBuildBins(workspaceRoot);

  return {
    manifest,
    meta,
    binaryPath: destBin,
    sessionId: id,
    downloadUrl: `/firmware/esp.bin?buildJob=${encodeURIComponent(id)}`,
  };
}

/**
 * @param {{ deviceName?: string, workspaceRoot?: string, chipFamilies?: ('ESP32'|'ESP8266')[], sessionId?: string }} opts
 */
export async function syncFirmwareArtifacts(opts = {}) {
  const sessionId = opts.sessionId || crypto.randomBytes(12).toString('hex');
  return publishFirmwareSession(sessionId, opts);
}

export async function readFirmwareMeta(sessionId, userId) {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  const fromJob = await readJobFirmwareMeta(sessionId, uid);
  if (fromJob) return fromJob;
  const session = getFirmwareSession(sessionId, uid);
  return sanitizeFirmwareMeta(session?.meta || null);
}

export function resolvePublishedFirmwareBin(sessionId, userId) {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  const fromJob = resolveJobFirmwareBin(sessionId, uid);
  if (fromJob) return fromJob;
  const session = getFirmwareSession(sessionId, uid);
  if (!session) return null;
  const bin = path.join(session.dir, FIRMWARE_BIN_NAME);
  return fs.existsSync(bin) ? bin : null;
}

export function resolveFirmwareManifestFile(sessionId, userId) {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  const fromJob = resolveJobManifestFile(sessionId, uid);
  if (fromJob) return fromJob;
  const session = getFirmwareSession(sessionId, uid);
  if (!session) return null;
  const file = path.join(session.dir, FIRMWARE_MANIFEST_NAME);
  return fs.existsSync(file) ? file : null;
}

export function getLatestFirmwareSessionId(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  const jobId = getLatestSuccessfulJobId(uid);
  if (jobId) return jobId;
  pruneExpiredFirmwareSessions();
  return latestFirmwareSessionByUser.get(uid) || null;
}

const WATCH_RELATIVE_DIRS = [
  '.esphome/build',
  '.pio/build',
  'dist',
];

function collectWatchTargets() {
  const root = getFirmwareWorkspaceRoot();
  const targets = new Set();
  for (const rel of WATCH_RELATIVE_DIRS) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) targets.add(abs);
  }
  const explicit = trimEnv(process.env.FIRMWARE_PROJECT_DIR);
  if (explicit) {
    for (const rel of WATCH_RELATIVE_DIRS) {
      const abs = path.join(path.resolve(explicit), rel);
      if (fs.existsSync(abs)) targets.add(abs);
    }
  }
  return [...targets];
}

function scheduleWatchSync() {
  if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
  watchDebounceTimer = setTimeout(() => {
    // Не публикуем .bin на диск — только очистка артефактов сборки.
    cleanupWorkspaceBuildBins(getFirmwareWorkspaceRoot()).catch((err) => {
      console.warn('[esp-firmware] watch cleanup failed:', err.message);
    });
  }, WATCH_DEBOUNCE_MS);
}

export function startFirmwareWatchers() {
  if (String(process.env.FIRMWARE_WATCH || '0').trim() === '0') return;
  for (const dir of collectWatchTargets()) {
    try {
      const watcher = fs.watch(dir, { recursive: true }, (event, filename) => {
        if (!filename) return scheduleWatchSync();
        const lower = String(filename).toLowerCase();
        if (lower.includes('firmware') && lower.endsWith('.bin')) scheduleWatchSync();
      });
      activeWatchers.push(watcher);
    } catch (err) {
      console.warn('[esp-firmware] watch failed for', dir, err.message);
    }
  }
}

export function stopFirmwareWatchers() {
  for (const w of activeWatchers) {
    try {
      w.close();
    } catch {
      // ignore
    }
  }
  activeWatchers.length = 0;
  if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
}

export async function initEspFirmwareOnBoot() {
  await initEspBuildJobServer();
  await clearAllFirmwareStorage();
  console.log('[esp-firmware] ephemeral concurrent build server ready');
  startFirmwareWatchers();
}

export function stopEspFirmwareServices() {
  stopEspBuildJobServer();
  stopFirmwareWatchers();
}

export async function syncFirmwareForProject({ deviceName, projectRoot, sessionId, ownerUserId }) {
  const uid = String(ownerUserId || '').trim();
  if (!uid) {
    const err = new Error('Необходима авторизация');
    err.statusCode = 401;
    throw err;
  }
  const root = projectRoot ? path.resolve(projectRoot) : getFirmwareWorkspaceRoot();
  const discovered = await discoverFirmwareBinary(root);
  if (discovered) {
    return publishFirmwareSession(sessionId || crypto.randomBytes(12).toString('hex'), {
      deviceName,
      workspaceRoot: root,
      ownerUserId: uid,
    });
  }
  const active = getFirmwareSession(sessionId, uid);
  if (active) {
    return {
      manifest: active.manifest,
      meta: sanitizeFirmwareMeta(active.meta),
      binaryPath: path.join(active.dir, FIRMWARE_BIN_NAME),
      sessionId: active.id,
      downloadUrl: `/firmware/esp.bin?buildJob=${encodeURIComponent(active.id)}`,
    };
  }
  const err = new Error('firmware binary not found');
  err.code = 'FIRMWARE_NOT_FOUND';
  throw err;
}

function tailLog(text, maxLines = 40) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines).join('\n');
}

/**
 * @param {string} root
 * @returns {Promise<{ tool: 'esphome'|'platformio', cwd: string, configFile: string } | null>}
 */
export async function detectFirmwareBuildSystem(root) {
  const base = path.resolve(root);
  const searchRoots = [base, path.join(base, 'firmware')];

  for (const dir of searchRoots) {
    if (!fs.existsSync(dir)) continue;

    const pioIni = path.join(dir, 'platformio.ini');
    if (fs.existsSync(pioIni)) {
      return { tool: 'platformio', cwd: dir, configFile: pioIni };
    }

    for (const name of ['esphome.yaml', 'config.yaml']) {
      const fp = path.join(dir, name);
      if (!fs.existsSync(fp)) continue;
      try {
        const text = await fsp.readFile(fp, 'utf8');
        if (name === 'esphome.yaml' || /^\s*esphome\s*:/m.test(text)) {
          return { tool: 'esphome', cwd: dir, configFile: fp };
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

/**
 * @param {string} projectRoot
 * @param {{ yaml?: string, platformioIni?: string }} files
 */
export async function writeProjectFirmwareConfig(projectRoot, files = {}) {
  const root = path.resolve(projectRoot);
  const fwDir = path.join(root, 'firmware');
  await fsp.mkdir(fwDir, { recursive: true });

  const yaml = String(files.yaml || '').trim();
  const platformioIni = String(files.platformioIni || '').trim();

  if (yaml) {
    if (yaml.length > 512_000) {
      const err = new Error('esphome yaml too large');
      err.code = 'FIRMWARE_CONFIG_TOO_LARGE';
      throw err;
    }
    await atomicWriteFile(path.join(fwDir, 'esphome.yaml'), `${yaml}\n`);
  }
  if (platformioIni) {
    if (platformioIni.length > 256_000) {
      const err = new Error('platformio.ini too large');
      err.code = 'FIRMWARE_CONFIG_TOO_LARGE';
      throw err;
    }
    await atomicWriteFile(path.join(fwDir, 'platformio.ini'), `${platformioIni}\n`);
  }
}

