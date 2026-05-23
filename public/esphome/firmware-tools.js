/**
 * Сборка и прошивка ESP через API Cicada Studio (тот же origin, что и конструктор).
 */
const EspFirmwareTools = (() => {
  let lastBuildJobId = null;
  let lastDownloadUrl = null;
  const POLL_INTERVAL_MS = 2000;
  const POLL_MAX_MS = 45 * 60 * 1000;

  function projectParamsFromUrl() {
    const p = new URLSearchParams(window.location.search);
    return {
      projectId: p.get('projectId') || '',
      projectName: p.get('name') || p.get('projectName') || '',
    };
  }

  function deviceNameFromForm() {
    const el = document.getElementById('devName');
    return el ? String(el.value || '').trim() : '';
  }

  function resolveDeviceName() {
    const { projectName } = projectParamsFromUrl();
    return deviceNameFromForm() || projectName || 'esphome-device';
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function redirectToStudioLogin() {
    const rt = location.pathname + location.search;
    try { sessionStorage.setItem('cicada_return_to', rt); } catch { /* ignore */ }
    location.href = '/?login=1&returnTo=' + encodeURIComponent(rt);
  }

  function buildApiError(res, data) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.log = data.log;
    err.hint = data.hint;
    if (res.status === 401) {
      redirectToStudioLogin();
      err.hint = 'Требуется вход в Cicada Studio.';
    }
    if (res.status === 403) {
      err.hint = data.error || 'Нужна активная подписка PRO от 14 дней.';
    }
    if (res.status === 504) {
      err.hint = 'Сервер или прокси оборвал долгую сборку. Обновите страницу и повторите — сборка теперь идёт в фоне.';
    }
    return err;
  }

  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 202) {
      throw buildApiError(res, data);
    }
    if (res.status === 202) {
      return { ...data, _accepted: true };
    }
    if (!res.ok) {
      throw buildApiError(res, data);
    }
    return data;
  }

  async function pollFirmwareBuildJob(jobId, onProgress) {
    const t0 = Date.now();
    while (Date.now() - t0 < POLL_MAX_MS) {
      const res = await fetch(`/api/firmware/build/job/${encodeURIComponent(jobId)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          const err = new Error('Задача сборки не найдена (сервер перезапущен или истёк срок)');
          err.status = 404;
          err.hint = 'Нажмите «Собрать bin» ещё раз — сборка запустится заново.';
          throw err;
        }
        throw buildApiError(res, data);
      }
      if (typeof onProgress === 'function') onProgress(data);
      if (data.status === 'success') {
        if (data.sessionId) lastBuildJobId = data.sessionId;
        else if (data.jobId) lastBuildJobId = data.jobId;
        if (data.downloadUrl) lastDownloadUrl = data.downloadUrl;
        if (data.apiEncryptionKey) persistApiEncryptionKeyForFlash(data.apiEncryptionKey);
        return {
          success: true,
          meta: data.meta,
          manifest: data.manifest,
          build: data.build,
          log: data.log,
          firmwarePath: data.firmwarePath,
          downloadUrl: data.downloadUrl,
          apiEncryptionKey: data.apiEncryptionKey,
          sessionId: data.sessionId,
          jobId: data.jobId,
        };
      }
      if (data.status === 'failed' || data.status === 'timeout') {
        const err = new Error(data.error?.message || (data.status === 'timeout' ? 'Тайм-аут сборки' : 'Ошибка сборки'));
        err.log = data.error?.log || data.log;
        err.stderr = data.error?.stderr || err.log;
        err.exitCode = data.error?.exitCode;
        err.hint = data.error?.hint;
        throw err;
      }
      const inProgress = data.status === 'queued'
        || data.status === 'compiling'
        || data.status === 'running';
      if (!inProgress) {
        const err = new Error(`Неизвестный статус сборки: ${data.status || 'unknown'}`);
        err.log = data.log;
        throw err;
      }
      await sleep(POLL_INTERVAL_MS);
    }
    const err = new Error('Превышено время ожидания сборки (45 мин)');
    err.hint = 'Первая сборка ESPHome может занять много времени. Попробуйте снова через несколько минут.';
    throw err;
  }

  function getYamlText() {
    const code = document.getElementById('yaml');
    return code ? String(code.textContent || '').trim() : '';
  }

  function extractEncryptionKeyFromYaml(yamlText) {
    if (!yamlText) return '';
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
    return fallback?.[1] || '';
  }

  async function buildBin({ yaml, name, projectId, onProgress } = {}) {
    const yamlText = yaml ?? getYamlText();
    if (!yamlText) {
      throw new Error('Сначала сгенерируйте YAML.');
    }
    const started = await apiPost('/api/firmware/build', {
      yaml: yamlText,
      name: name || resolveDeviceName(),
      projectId: projectId || projectParamsFromUrl().projectId || undefined,
    });
    if (started.jobId) {
      lastBuildJobId = started.jobId;
      if (typeof onProgress === 'function') {
        onProgress({ status: started.status || 'queued', stage: 'queued', jobId: started.jobId });
      }
      const result = await pollFirmwareBuildJob(started.jobId, onProgress);
      rememberBuildResult(result);
      return result;
    }
    return started;
  }

  const API_KEY_STORAGE = 'cicada_esp_api_encryption_key';
  const BUILD_DOWNLOAD_STORAGE = 'cicada_esp_last_build_download';

  function readStoredJson(key) {
    try {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeStoredJson(key, value) {
    const payload = JSON.stringify(value);
    try { localStorage.setItem(key, payload); } catch { /* ignore */ }
    try { sessionStorage.setItem(key, payload); } catch { /* ignore */ }
  }

  function persistBuildDownload(result) {
    if (!result) return;
    const jobId = result.sessionId || result.jobId;
    if (!jobId && !result.downloadUrl) return;
    writeStoredJson(BUILD_DOWNLOAD_STORAGE, {
      jobId: jobId || null,
      downloadUrl: result.downloadUrl || null,
      apiEncryptionKey: result.apiEncryptionKey || null,
      savedAt: Date.now(),
    });
  }

  function restoreBuildDownload() {
    const data = readStoredJson(BUILD_DOWNLOAD_STORAGE);
    if (!data) return;
    if (data.jobId) lastBuildJobId = data.jobId;
    if (data.downloadUrl) lastDownloadUrl = data.downloadUrl;
    if (data.apiEncryptionKey) persistApiEncryptionKeyForFlash(data.apiEncryptionKey);
  }

  restoreBuildDownload();

  function rememberBuildResult(result) {
    if (!result) return;
    if (result.sessionId) lastBuildJobId = result.sessionId;
    else if (result.jobId) lastBuildJobId = result.jobId;
    if (result.downloadUrl) lastDownloadUrl = result.downloadUrl;
    const encKey = result.apiEncryptionKey || extractEncryptionKeyFromYaml(getYamlText());
    if (encKey) persistApiEncryptionKeyForFlash(encKey);
    persistBuildDownload({ ...result, apiEncryptionKey: encKey || result.apiEncryptionKey });
  }

  function persistApiEncryptionKeyForFlash(keyOverride) {
    const encKey = keyOverride || extractEncryptionKeyFromYaml(getYamlText());
    if (!encKey) return;
    try { localStorage.setItem(API_KEY_STORAGE, encKey); } catch { /* ignore */ }
    try { sessionStorage.setItem(API_KEY_STORAGE, encKey); } catch { /* ignore */ }
  }

  function flashPageUrl(opts = {}) {
    const { projectId, projectName } = projectParamsFromUrl();
    const params = new URLSearchParams();
    const name = resolveDeviceName() || projectName;
    if (projectId) params.set('projectId', projectId);
    if (name) params.set('name', name);
    const buildJob = opts.buildJob || opts.sessionId || lastBuildJobId;
    if (buildJob) params.set('buildJob', buildJob);
    const q = params.toString();
    return `/flash${q ? `?${q}` : ''}`;
  }

  function binDownloadUrl(opts = {}) {
    if (opts.downloadUrl) return opts.downloadUrl;
    const jobId = opts.buildJob || opts.sessionId || opts.jobId;
    if (jobId) return `/firmware/esp.bin?buildJob=${encodeURIComponent(jobId)}`;
    if (lastDownloadUrl) return lastDownloadUrl;
    const id = lastBuildJobId;
    if (id) return `/firmware/esp.bin?buildJob=${encodeURIComponent(id)}`;
    restoreBuildDownload();
    if (lastDownloadUrl) return lastDownloadUrl;
    if (lastBuildJobId) return `/firmware/esp.bin?buildJob=${encodeURIComponent(lastBuildJobId)}`;
    return null;
  }

  async function downloadBin(opts = {}) {
    const url = binDownloadUrl(opts);
    if (!url) {
      const err = new Error('Нет ссылки на прошивку. Соберите bin ещё раз.');
      err.hint = 'После сборки нажмите «Скачать bin» в этом же окне.';
      throw err;
    }
    const safeName = String(resolveDeviceName() || 'firmware')
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80);
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) {
      if (res.status === 401) redirectToStudioLogin();
      let msg = res.status === 401 ? 'Требуется вход в Cicada Studio' : `HTTP ${res.status}`;
      if (res.status === 404) {
        msg = 'Прошивка не найдена на сервере (истёк срок хранения или сервер перезапущен).';
      }
      const err = new Error(msg);
      err.status = res.status;
      err.hint = res.status === 404
        ? 'Запустите «Собрать bin» снова — повторная сборка обычно быстрее.'
        : '';
      throw err;
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${safeName}.bin`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  }

  async function openFlash(opts = {}) {
    try {
      sessionStorage.setItem('cicada_return_to', window.location.pathname + window.location.search);
    } catch { /* ignore */ }
    restoreBuildDownload();
    if (opts.buildJob) lastBuildJobId = opts.buildJob;
    else if (opts.sessionId) lastBuildJobId = opts.sessionId;
    if (opts.downloadUrl) lastDownloadUrl = opts.downloadUrl;
    if (opts.apiEncryptionKey) persistApiEncryptionKeyForFlash(opts.apiEncryptionKey);
    else persistApiEncryptionKeyForFlash();
    try {
      await apiPost('/api/firmware/refresh', {
        name: resolveDeviceName(),
        projectId: projectParamsFromUrl().projectId || undefined,
      });
    } catch {
      // bin может отсутствовать до сборки
    }
    window.open(flashPageUrl(opts), '_blank', 'noopener,noreferrer');
  }

  return {
    buildBin,
    pollFirmwareBuildJob,
    openFlash,
    downloadBin,
    binDownloadUrl,
    getYamlText,
    resolveDeviceName,
    projectParamsFromUrl,
    rememberBuildResult,
    persistApiEncryptionKeyForFlash,
  };
})();
