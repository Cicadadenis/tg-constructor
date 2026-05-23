import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import {
  resolvePublishedFirmwareBin,
  getLatestFirmwareSessionId,
  resolveFirmwareManifestFile,
  syncFirmwareForProject,
  startFirmwareBuildJob,
  getFirmwareBuildJob,
  detectFirmwareBuildSystem,
  readFirmwareMeta,
  getFirmwareWorkspaceRoot,
  initEspFirmwareOnBoot,
  registerActiveDownload,
  unregisterActiveDownload,
  sanitizeFirmwareMeta,
} from './espFirmware.mjs';
import { readJobApiEncryptionKey, ensureJobInMemory } from './espBuildJobServer.mjs';
import { PROJECT_ID_RE } from './projectId.mjs';
import {
  getEspPremiumAccess,
  espPremiumDeniedMessage,
} from './espSubscriptionGate.mjs';

/** Тот же пользователь, что GET /api/me (findById + rowToUser). */
async function loadEspPremiumAccess(findById, userId) {
  if (typeof findById !== 'function') return getEspPremiumAccess(null);
  const user = await findById(userId);
  if (!user) return getEspPremiumAccess(null);
  return getEspPremiumAccess(user);
}

function denyEspPremium(res, access) {
  return res.status(403).json({
    error: espPremiumDeniedMessage(access),
    espPremium: access,
  });
}

function firmwareSessionIdFromReq(req) {
  return String(req.query?.buildJob || req.query?.jobId || '').trim() || null;
}

function trimEnv(v) {
  return String(v || '').trim();
}

const FLASH_PAGE_PATH = path.resolve('public/flash/index.html');
const JAMMER_FLASH_PAGE_PATH = path.resolve('public/flash/jammer/index.html');
const JAMMER_FIRMWARE_BIN_PATH = path.resolve(
  trimEnv(process.env.JAMMER_FIRMWARE_BIN) || 'esp8266_deauther.bin',
);
const JAMMER_MANIFEST_PATH = path.resolve('public/flash/jammer/manifest.json');
const JAMMER_PUBLIC_BIN_PATH = path.resolve('public/flash/jammer/esp8266_deauther.bin');

async function ensureJammerFirmwareAssets() {
  const src = JAMMER_FIRMWARE_BIN_PATH;
  if (!fs.existsSync(src)) {
    console.warn('[jammer] firmware not found:', src);
    return false;
  }
  await fsp.mkdir(path.dirname(JAMMER_PUBLIC_BIN_PATH), { recursive: true });
  let needCopy = true;
  if (fs.existsSync(JAMMER_PUBLIC_BIN_PATH)) {
    const [s, d] = await Promise.all([fsp.stat(src), fsp.stat(JAMMER_PUBLIC_BIN_PATH)]);
    if (s.size === d.size && d.mtimeMs >= s.mtimeMs) needCopy = false;
  }
  if (needCopy) {
    await fsp.copyFile(src, JAMMER_PUBLIC_BIN_PATH);
    console.log('[jammer] published firmware to', JAMMER_PUBLIC_BIN_PATH);
  }
  return true;
}

export async function initJammerFirmwareOnBoot() {
  return ensureJammerFirmwareAssets();
}

function getFirmwareAllowedOrigins() {
  const raw = trimEnv(process.env.CORS_ORIGINS);
  const list = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const appUrl = trimEnv(process.env.APP_URL);
  if (appUrl) list.push(appUrl.replace(/\/$/, ''));
  return [...new Set(list)];
}

function applyFirmwareCors(req, res) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return;
  const allowed = getFirmwareAllowedOrigins();
  if (allowed.some((o) => o === origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

function sendJammerManifest(res) {
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.sendFile(JAMMER_MANIFEST_PATH);
}

function resolveJammerBinPath() {
  if (fs.existsSync(JAMMER_FIRMWARE_BIN_PATH)) return JAMMER_FIRMWARE_BIN_PATH;
  if (fs.existsSync(JAMMER_PUBLIC_BIN_PATH)) return JAMMER_PUBLIC_BIN_PATH;
  return null;
}

function sendJammerBin(res) {
  const binPath = resolveJammerBinPath();
  if (!binPath) {
    return res.status(404).type('text/plain').send('Jammer firmware not found');
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(binPath);
}

function pipeEphemeralFirmwareFile(jobId, filePath, res) {
  if (!jobId || !filePath) {
    res.status(404).send('Firmware not found');
    return;
  }
  registerActiveDownload(jobId);
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    unregisterActiveDownload(jobId);
  };
  res.setHeader('Content-Type', res.getHeader('Content-Type') || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.on('close', done);
  res.on('finish', done);
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).send('Download failed');
    done();
  });
  stream.pipe(res);
}

function resolveOwnedSessionId(req) {
  const userId = req.authUserId;
  const requested = firmwareSessionIdFromReq(req);
  if (requested) return requested;
  return getLatestFirmwareSessionId(userId);
}

export function registerEspFirmwareStaticRoutes(app, { requireUserAuth, requireUserAuthPage, pool, findById }) {
  const auth = requireUserAuth;
  const authPage = requireUserAuthPage || requireUserAuth;

  async function requireEspPremium(req, res, next) {
    if (!findById) return res.status(503).json({ error: 'Сервис временно недоступен' });
    try {
      const access = await loadEspPremiumAccess(findById, req.authUserId);
      if (!access.allowed) return denyEspPremium(res, access);
      req.espPremium = access;
      return next();
    } catch {
      return res.status(500).json({ error: 'Не удалось проверить подписку' });
    }
  }

  const serveFlashPage = (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).send('Method Not Allowed');
    return res.sendFile(FLASH_PAGE_PATH);
  };

  const redirectFlashIndex = (req, res, target) => {
    const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(301, `${target}${qs}`);
  };

  app.get(/^\/flash\/index\.html$/, (req, res) => redirectFlashIndex(req, '/flash/'));
  app.get(/^\/admin\/flash\/index\.html$/, (req, res) => redirectFlashIndex(req, '/admin/flash/'));

  app.all(/^\/flash\/?$/, authPage, serveFlashPage);
  app.all(/^\/admin\/flash\/?$/, authPage, serveFlashPage);

  const serveJammerFlashPage = (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).send('Method Not Allowed');
    return res.sendFile(JAMMER_FLASH_PAGE_PATH);
  };
  app.get(/^\/flash\/jammer\/index\.html$/, (req, res) => redirectFlashIndex(req, '/flash/jammer/'));
  app.all(/^\/flash\/jammer\/?$/, authPage, serveJammerFlashPage);

  // Фиксированная прошивка глушилки — без привязки к user_id; страница /flash/jammer/ уже за authPage.
  // esp-web-tools качает manifest/bin без cookie — иначе вместо .bin приходит JSON 401 (~5 с «готово», пустой лог).
  app.get('/flash/jammer/manifest.json', auth, requireEspPremium, (req, res) => {
    applyFirmwareCors(req, res);
    return sendJammerManifest(res);
  });
  app.get('/flash/jammer/esp8266_deauther.bin', auth, requireEspPremium, (req, res) => {
    applyFirmwareCors(req, res);
    return sendJammerBin(res);
  });
  app.get('/firmware/jammer/manifest.json', auth, requireEspPremium, (req, res) => {
    applyFirmwareCors(req, res);
    return sendJammerManifest(res);
  });
  app.get('/firmware/jammer/esp8266_deauther.bin', auth, requireEspPremium, (req, res) => {
    applyFirmwareCors(req, res);
    return sendJammerBin(res);
  });

  app.get('/flash/jammer/jammer.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.resolve('public/flash/jammer/jammer.js'));
  });

  app.get('/flash/jammer/flash-i18n.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.resolve('public/flash/flash-i18n.js'));
  });

  app.get('/flash/jammer/serial-cleanup.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.resolve('public/flash/serial-cleanup.js'));
  });

  app.get('/firmware/latest.bin', auth, async (req, res) => {
    applyFirmwareCors(req, res);
    const sessionId = resolveOwnedSessionId(req);
    if (!sessionId) return res.status(404).send('Firmware not found');
    await ensureJobInMemory(sessionId);
    const bin = resolvePublishedFirmwareBin(sessionId, req.authUserId);
    if (!bin) return res.status(404).send('Firmware not found');
    pipeEphemeralFirmwareFile(sessionId, bin, res);
  });

  app.get('/firmware/build-meta.json', auth, async (req, res) => {
    applyFirmwareCors(req, res);
    try {
      const sessionId = resolveOwnedSessionId(req);
      if (!sessionId) return res.status(404).json({ error: 'Метаданные прошивки не найдены' });
      await ensureJobInMemory(sessionId);
      const meta = await readFirmwareMeta(sessionId, req.authUserId);
      if (!meta) return res.status(404).json({ error: 'Метаданные прошивки не найдены' });
      const apiEncryptionKey = await readJobApiEncryptionKey(sessionId, req.authUserId);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.json({
        ...sanitizeFirmwareMeta(meta),
        ...(apiEncryptionKey ? { apiEncryptionKey } : {}),
      });
    } catch {
      return res.status(500).json({ error: 'Не удалось прочитать метаданные' });
    }
  });

  app.get('/firmware/manifest.json', auth, async (req, res) => {
    applyFirmwareCors(req, res);
    const sessionId = resolveOwnedSessionId(req);
    if (!sessionId) return res.status(404).end();
    await ensureJobInMemory(sessionId);
    const file = resolveFirmwareManifestFile(sessionId, req.authUserId);
    if (!file) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.sendFile(file);
  });

  app.get('/firmware/esp.bin', auth, async (req, res) => {
    applyFirmwareCors(req, res);
    const jobId = firmwareSessionIdFromReq(req);
    if (!jobId) return res.status(404).send('Firmware not found');
    await ensureJobInMemory(jobId);
    const bin = resolvePublishedFirmwareBin(jobId, req.authUserId);
    if (!bin) return res.status(404).send('Firmware not found');
    pipeEphemeralFirmwareFile(jobId, bin, res);
  });

  app.get('/flash/flash.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.resolve('public/flash/flash.js'));
  });

  app.get('/flash/flash-i18n.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.resolve('public/flash/flash-i18n.js'));
  });

  app.get('/flash/cicada-flasher.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.resolve('public/flash/cicada-flasher.js'));
  });

  app.get('/flash/vendor/esptool-js.bundle.js', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(path.resolve('public/flash/vendor/esptool-js.bundle.js'));
  });

  app.get('/flash/flash-dialog.css', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.resolve('public/flash/flash-dialog.css'));
  });

  app.get('/flash/serial-cleanup.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.resolve('public/flash/serial-cleanup.js'));
  });

  app.get('/flash/flash-return.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.resolve('public/flash/flash-return.js'));
  });
}

export function registerEspFirmwareApiRoutes(app, {
  requireUserAuth,
  pool,
  assertProjectOwned,
  findById,
}) {
  const auth = requireUserAuth;

  app.get('/api/firmware/premium-access', auth, async (req, res) => {
    try {
      const access = await loadEspPremiumAccess(findById, req.authUserId);
      return res.json(access);
    } catch {
      return res.status(500).json({ error: 'Не удалось проверить подписку' });
    }
  });

  app.get('/api/firmware/status', auth, async (req, res) => {
    try {
      const sessionId = resolveOwnedSessionId(req);
      const meta = sessionId
        ? await readFirmwareMeta(sessionId, req.authUserId)
        : null;
      const bin = sessionId
        ? resolvePublishedFirmwareBin(sessionId, req.authUserId)
        : null;
      const buildJobQ = sessionId ? `?buildJob=${encodeURIComponent(sessionId)}` : '';
      return res.json({
        ready: Boolean(bin),
        meta: sanitizeFirmwareMeta(meta),
        sessionId: sessionId || null,
        manifestUrl: sessionId ? `/firmware/manifest.json${buildJobQ}` : null,
        latestBinUrl: sessionId ? `/firmware/esp.bin${buildJobQ}` : null,
      });
    } catch {
      return res.status(500).json({ error: 'Не удалось прочитать статус прошивки' });
    }
  });

  app.get('/api/firmware/build-config', auth, async (req, res) => {
    const userId = req.authUserId;
    const projectId = String(req.query?.projectId || '').trim();
    let workspaceRoot = getFirmwareWorkspaceRoot();
    if (projectId) {
      if (!PROJECT_ID_RE.test(projectId)) {
        return res.status(400).json({ error: 'Некорректный projectId' });
      }
      try {
        await assertProjectOwned(userId, projectId);
      } catch (e) {
        return res.status(e.statusCode || 403).json({ error: e.publicMessage || 'Нет доступа' });
      }
      workspaceRoot = path.resolve('bots', userId, 'projects', projectId);
    }
    const detected = await detectFirmwareBuildSystem(workspaceRoot);
    return res.json({
      workspaceRoot,
      detected: detected
        ? { tool: detected.tool, cwd: detected.cwd, configFile: detected.configFile }
        : null,
    });
  });

  async function readYamlFromProjectRoot(projectRoot) {
    const candidates = [
      path.join(projectRoot, 'firmware', 'esphome.yaml'),
      path.join(projectRoot, 'firmware', 'config.yaml'),
      path.join(projectRoot, 'esphome.yaml'),
      path.join(projectRoot, 'config.yaml'),
    ];
    for (const fp of candidates) {
      try {
        const text = await fsp.readFile(fp, 'utf8');
        if (String(text).trim()) return text;
      } catch {
        // next
      }
    }
    return '';
  }

  async function readPlatformioFromProjectRoot(projectRoot) {
    const fp = path.join(projectRoot, 'firmware', 'platformio.ini');
    try {
      const text = await fsp.readFile(fp, 'utf8');
      return String(text).trim();
    } catch {
      return '';
    }
  }

  function resolveFirmwareBuildRequest(req) {
    const userId = req.authUserId;
    const { projectId, name: bodyName, yaml, platformioIni } = req.body || {};
    let deviceName = String(bodyName || '').trim();
    const yamlBody = yaml != null ? String(yaml).trim() : '';
    const pioBody = platformioIni != null ? String(platformioIni).trim() : '';

    if (projectId) {
      const pid = String(projectId).trim();
      if (!PROJECT_ID_RE.test(pid)) {
        const err = new Error('Некорректный projectId');
        err.statusCode = 400;
        throw err;
      }
      return assertProjectOwned(userId, pid).then(async () => {
        if (!deviceName) {
          const { rows } = await pool.query(
            'SELECT name FROM projects WHERE id=$1 AND user_id=$2',
            [pid, userId],
          );
          deviceName = rows[0]?.name || deviceName;
        }
        const projectRoot = path.resolve('bots', userId, 'projects', pid);
        const resolvedYaml = yamlBody || await readYamlFromProjectRoot(projectRoot);
        const resolvedPio = pioBody || await readPlatformioFromProjectRoot(projectRoot);
        return {
          deviceName: deviceName || undefined,
          yaml: resolvedYaml || undefined,
          platformioIni: resolvedPio || undefined,
        };
      }).catch((e) => {
        const err = new Error(e.publicMessage || 'Нет доступа');
        err.statusCode = e.statusCode || 403;
        throw err;
      });
    }

    return Promise.resolve({
      deviceName: deviceName || undefined,
      yaml: yamlBody || undefined,
      platformioIni: pioBody || undefined,
    });
  }

  function mapFirmwareBuildError(res, e) {
    if (e?.statusCode === 400) {
      return res.status(400).json({ error: e.message });
    }
    if (e?.statusCode === 401) {
      return res.status(401).json({ error: e.message });
    }
    if (e?.statusCode === 403) {
      return res.status(403).json({ error: e.message });
    }
    if (e?.code === 'FIRMWARE_BUILD_CONFIG_MISSING') {
      return res.status(400).json({
        error: e.message,
        hint: 'Создайте bots/<user>/projects/<id>/firmware/esphome.yaml или задайте FIRMWARE_WORKSPACE_ROOT',
      });
    }
    if (e?.code === 'FIRMWARE_CONFIG_INVALID') {
      return res.status(422).json({
        error: e.message || 'Ошибка валидации ESPHome YAML',
        log: e.log || '',
        stderr: e.stderr || e.log || '',
        exitCode: e.exitCode ?? null,
      });
    }
    if (e?.code === 'FIRMWARE_BUILD_FAILED' || e?.code === 'FIRMWARE_BUILD_TIMEOUT') {
      return res.status(422).json({
        error: e.message || 'Ошибка сборки',
        log: e.log || '',
        stderr: e.stderr || e.log || '',
        exitCode: e.exitCode ?? null,
      });
    }
    if (e?.code === 'FIRMWARE_NOT_FOUND') {
      return res.status(422).json({
        error: 'Сборка прошла, но firmware.bin не найден. Проверьте логи ESPHome/PlatformIO.',
        log: e.log || '',
      });
    }
    return res.status(500).json({ error: 'Не удалось собрать прошивку' });
  }

  app.get('/api/firmware/build/job/:jobId', auth, async (req, res) => {
    const job = getFirmwareBuildJob(req.params.jobId, req.authUserId);
    if (!job) {
      return res.status(404).json({ error: 'Задача сборки не найдена или устарела' });
    }
    return res.json(job);
  });

  app.post('/api/firmware/build', auth, async (req, res) => {
    try {
      const access = await loadEspPremiumAccess(findById, req.authUserId);
      if (!access.allowed) return denyEspPremium(res, access);
      const buildOpts = await resolveFirmwareBuildRequest(req);
      const accepted = startFirmwareBuildJob({
        ...buildOpts,
        userId: req.authUserId,
      });
      return res.status(202).json({
        accepted: true,
        ...accepted,
        message: 'Сборка в очереди. Опросите pollUrl: queued → compiling → success | failed | timeout.',
      });
    } catch (e) {
      return mapFirmwareBuildError(res, e);
    }
  });

  app.post('/api/firmware/refresh', auth, async (req, res) => {
    const userId = req.authUserId;
    const { projectId, name: bodyName } = req.body || {};
    let deviceName = String(bodyName || '').trim();
    let projectRoot = null;

    if (projectId) {
      const pid = String(projectId).trim();
      if (!PROJECT_ID_RE.test(pid)) {
        return res.status(400).json({ error: 'Некорректный projectId' });
      }
      try {
        await assertProjectOwned(userId, pid);
      } catch (e) {
        return res.status(e.statusCode || 403).json({ error: e.publicMessage || 'Нет доступа' });
      }
      if (!deviceName) {
        const { rows } = await pool.query('SELECT name FROM projects WHERE id=$1 AND user_id=$2', [pid, userId]);
        deviceName = rows[0]?.name || deviceName;
      }
      projectRoot = path.resolve('bots', userId, 'projects', pid);
    }

    try {
      const result = await syncFirmwareForProject({
        deviceName: deviceName || undefined,
        projectRoot: projectRoot || undefined,
        ownerUserId: userId,
      });
      return res.json({
        success: true,
        meta: sanitizeFirmwareMeta(result.meta),
        manifest: result.manifest,
        sessionId: result.sessionId,
        downloadUrl: result.downloadUrl,
      });
    } catch (e) {
      if (e?.code === 'FIRMWARE_NOT_FOUND') {
        return res.status(404).json({
          error: 'Сборка не найдена. Запустите ESPHome compile или PlatformIO build.',
        });
      }
      if (e?.statusCode === 401) {
        return res.status(401).json({ error: e.message });
      }
      return res.status(500).json({ error: 'Не удалось опубликовать прошивку' });
    }
  });
}

export { initEspFirmwareOnBoot };
