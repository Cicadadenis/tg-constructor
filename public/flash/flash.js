import {
  browserFlashSupported,
  releaseSerialPorts,
  unsupportedBrowserMessage,
  bindFlasherDialog,
  loadManifestBuildParts,
  chipMatchesFamily,
} from './cicada-flasher.js';

const deviceLabel = document.getElementById('device-label');
const flashBtn = document.getElementById('flash-btn');
const pickBinBtn = document.getElementById('pick-bin-btn');
const binFileInput = document.getElementById('bin-file-input');
const binFileName = document.getElementById('bin-file-name');
const chipFamilySelect = document.getElementById('chip-family');
const exitBtn = document.getElementById('exit-btn');
const encryptionKeyEl = document.getElementById('encryption-key-value');
const copyKeyBtn = document.getElementById('copy-key-btn');

const params = new URLSearchParams(location.search);
const projectName = params.get('name') || params.get('projectName') || '';
const API_KEY_STORAGE = 'cicada_esp_api_encryption_key';
const buildJob = params.get('buildJob') || params.get('jobId') || '';

function firmwareApiUrl(path) {
  const url = new URL(path, location.origin);
  if (buildJob) url.searchParams.set('buildJob', buildJob);
  return url.href;
}

const serverManifestUrl = firmwareApiUrl('/firmware/manifest.json');
const buildMetaUrl = firmwareApiUrl('/firmware/build-meta.json');

let displayedEncryptionKey = '';
let localBinFile = null;
let serverManifest = null;
let serverManifestReady = false;
let flashingBlocked = false;

function redirectToStudioLogin() {
  const rt = location.pathname + location.search;
  try { sessionStorage.setItem('cicada_return_to', rt); } catch { /* ignore */ }
  location.href = `/?login=1&returnTo=${encodeURIComponent(rt)}`;
}

function setFileLabel(text, isLocal) {
  if (!binFileName) return;
  binFileName.textContent = text;
  binFileName.classList.toggle('is-local', Boolean(isLocal));
}

function setEncryptionKey(key) {
  const value = String(key || '').trim();
  displayedEncryptionKey = value;
  if (!encryptionKeyEl) return;
  if (value) {
    encryptionKeyEl.value = value;
    encryptionKeyEl.classList.remove('is-empty');
  } else {
    encryptionKeyEl.value = 'Не найден в конфигурации сборки';
    encryptionKeyEl.classList.add('is-empty');
  }
  if (copyKeyBtn) copyKeyBtn.disabled = !value;
}

async function loadBuildMeta() {
  try {
    const stored = localStorage.getItem(API_KEY_STORAGE) || sessionStorage.getItem(API_KEY_STORAGE);
    if (stored) setEncryptionKey(stored);
  } catch { /* ignore */ }

  if (!buildJob) {
    try {
      const raw = localStorage.getItem('cicada_esp_last_build_download')
        || sessionStorage.getItem('cicada_esp_last_build_download');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.apiEncryptionKey) setEncryptionKey(data.apiEncryptionKey);
      }
    } catch { /* ignore */ }
  }

  try {
    const r = await fetch(buildMetaUrl, { cache: 'no-store', credentials: 'same-origin' });
    if (r.status === 401) {
      redirectToStudioLogin();
      return;
    }
    if (!r.ok) throw new Error('meta unavailable');
    const meta = await r.json();
    if (meta.apiEncryptionKey) setEncryptionKey(meta.apiEncryptionKey);
    if (meta.chipFamilies?.length === 1 && chipFamilySelect) {
      chipFamilySelect.value = meta.chipFamilies[0];
    }
  } catch {
    if (!displayedEncryptionKey) setEncryptionKey('');
  }
}

function handleExit() {
  releaseSerialPorts();
  if (window.opener) {
    window.close();
    return;
  }
  try {
    if (document.referrer) {
      const ref = new URL(document.referrer);
      if (ref.origin === location.origin) {
        location.href = document.referrer;
        return;
      }
    }
  } catch { /* ignore */ }
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  location.href = '/esphome/';
}

async function copyEncryptionKey() {
  if (!displayedEncryptionKey) return;
  try {
    await navigator.clipboard.writeText(displayedEncryptionKey);
    flasher.setStatus('Ключ скопирован в буфер обмена.', 'ok');
  } catch {
    flasher.setStatus('Не удалось скопировать ключ.', 'err');
  }
}

async function firmwareBinaryReady() {
  try {
    const r = await fetch(firmwareApiUrl('/firmware/esp.bin'), {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function loadServerManifestInfo() {
  try {
    const r = await fetch(serverManifestUrl, { cache: 'no-store', credentials: 'same-origin' });
    if (r.status === 401) {
      redirectToStudioLogin();
      return false;
    }
    if (!r.ok) throw new Error('manifest unavailable');
    serverManifest = await r.json();
    const ver = serverManifest.version ? ` · v${serverManifest.version}` : '';
    const chips = (serverManifest.builds || []).map((b) => b.chipFamily).join(', ');
    const binOk = await firmwareBinaryReady();
    if (!binOk) {
      flasher.setStatus('На сервере нет esp.bin — выберите локальный .bin', 'err');
      setFileLabel('Файл на сервере не найден', false);
      serverManifestReady = false;
      return false;
    }
    setFileLabel(`С сервера: ${serverManifest.name || 'firmware'}${ver}`, false);
    flasher.setStatus(`${serverManifest.name || 'ESP'}${ver}${chips ? ` (${chips})` : ''}`, 'ok');
    serverManifestReady = true;
    return true;
  } catch {
    const binOk = await firmwareBinaryReady();
    if (binOk) {
      const family = preferredChipFamily();
      serverManifest = {
        name: projectName || 'firmware',
        version: '',
        builds: [{ chipFamily: family, improv: false, parts: [{ path: 'esp.bin', offset: 0 }] }],
      };
      setFileLabel(`С сервера: ${serverManifest.name}`, false);
      flasher.setStatus('Прошивка с сервера готова к записи.', 'ok');
      serverManifestReady = true;
      return true;
    }
    flasher.setStatus('Сборка на сервере не опубликована — выберите локальный .bin', 'err');
    setFileLabel('Выберите файл .bin', false);
    serverManifestReady = false;
    return false;
  }
}

function preferredChipFamily() {
  return chipFamilySelect?.value || 'ESP8266';
}

async function resolveFlashPackage() {
  if (localBinFile) {
    const data = new Uint8Array(await localBinFile.arrayBuffer());
    const family = preferredChipFamily();
    return {
      name: localBinFile.name.replace(/\.(factory\.)?bin$/i, '') || 'firmware',
      sizeLabel: `${(localBinFile.size / 1024).toFixed(1)} KB · ${family}`,
      parts: [{ data, address: 0 }],
      preferredFamily: family,
      validateChip: (chip) => {
        if (!chipMatchesFamily(chip, family)) {
          throw new Error(
            `Выбрано семейство ${family}, на плате — ${chip}. Смените тип чипа или файл .bin.`,
          );
        }
      },
    };
  }

  if (!serverManifestReady || !serverManifest) {
    throw new Error('Нет прошивки на сервере. Выберите локальный .bin.');
  }

  const preferred = preferredChipFamily();
  const builds = serverManifest.builds || [];
  const build = builds.find((b) => b.chipFamily === preferred)
    || (builds.length === 1 ? builds[0] : null);
  if (!build) {
    throw new Error(
      `В manifest нет сборки для ${preferred}. Доступно: ${builds.map((b) => b.chipFamily).join(', ')}`,
    );
  }

  const parts = await loadManifestBuildParts(serverManifestUrl, build);
  const total = parts.reduce((n, p) => n + p.data.byteLength, 0);

  return {
    name: serverManifest.name || 'firmware',
    sizeLabel: `${(total / 1024).toFixed(1)} KB · ${build.chipFamily}`,
    parts,
    manifest: serverManifest,
    manifestUrl: serverManifestUrl,
    preferredFamily: build.chipFamily,
    validateChip: (chip) => {
      if (!chipMatchesFamily(chip, build.chipFamily)) {
        throw new Error(
          `На плате ${chip}, выбрана прошивка для ${build.chipFamily}. Смените «Семейство чипа» или пересоберите.`,
        );
      }
    },
  };
}

function onLocalFileSelected(file) {
  if (!file) return;
  if (!/\.bin$/i.test(file.name) && file.type !== 'application/octet-stream') {
    flasher.setStatus('Выберите файл с расширением .bin', 'err');
    return;
  }
  localBinFile = file;
  setFileLabel(`Локально: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, true);
  flasher.setStatus('Файл выбран. Нажмите «Прошить» и выберите COM-порт.', 'ok');
  flasher.enableFlash(true);
}

function updateFlashReady() {
  const canFlash = Boolean(localBinFile || serverManifestReady) && !flashingBlocked;
  flasher.enableFlash(canFlash);
}

const flasher = bindFlasherDialog({
  flashBtn,
  flashStatus: document.getElementById('flash-status'),
  getFlashPackage: async () => {
    const pkg = await resolveFlashPackage();
    return {
      name: pkg.name,
      sizeLabel: pkg.sizeLabel,
      parts: pkg.parts,
      validateChip: pkg.validateChip,
    };
  },
  doneMessage:
    'Прошивка записана. Нажмите RESET на плате. '
    + 'Для ESPHome откройте устройство в Home Assistant или по IP.',
});

pickBinBtn?.addEventListener('click', () => binFileInput?.click());

binFileInput?.addEventListener('change', () => {
  const file = binFileInput.files?.[0];
  if (file) onLocalFileSelected(file);
  binFileInput.value = '';
});

chipFamilySelect?.addEventListener('change', () => {
  if (localBinFile) {
    flasher.setStatus(`Чип: ${chipFamilySelect.value}. Можно прошивать.`, 'ok');
  } else if (serverManifestReady) {
    flasher.setStatus(`Серверная прошивка · ${chipFamilySelect.value}`, 'ok');
  }
});

exitBtn?.addEventListener('click', handleExit);
copyKeyBtn?.addEventListener('click', copyEncryptionKey);
window.addEventListener('beforeunload', () => { releaseSerialPorts(); });

(async function init() {
  await releaseSerialPorts();
  if (deviceLabel) {
    deviceLabel.textContent = projectName ? `Устройство: ${projectName}` : '';
  }

  const unsupported = unsupportedBrowserMessage();
  if (unsupported) {
    flashingBlocked = true;
    flasher.setStatus(unsupported, 'err');
    return;
  }

  await loadBuildMeta();
  if (!localBinFile) await loadServerManifestInfo();
  updateFlashReady();

  if (browserFlashSupported() && (localBinFile || serverManifestReady)) {
    flasher.setStatus('Нажмите «Прошить» и выберите COM-порт в окне браузера.', 'ok');
  }
})();
