/**
 * Общий русскоязычный флэшер Cicada (esptool-js + Web Serial).
 * esptool-js лежит локально в vendor/ — без CDN (версия 0.6.0).
 */
const ESPTOOL_MODULE = new URL('./vendor/esptool-js.bundle.js', import.meta.url).href;

export function browserFlashSupported() {
  return window.isSecureContext && 'serial' in navigator;
}

export function releaseSerialPorts() {
  return window.CicadaSerialCleanup?.releaseAndForgetSerialPorts?.() ?? Promise.resolve();
}

export function unsupportedBrowserMessage() {
  if (!window.isSecureContext) {
    return 'Прошивка по USB доступна только по HTTPS или на localhost.';
  }
  if (!('serial' in navigator)) {
    return 'Web Serial не поддерживается. Откройте страницу в Chrome или Edge на ПК.';
  }
  return '';
}

export async function importEsptool() {
  try {
    return await import(/* @vite-ignore */ ESPTOOL_MODULE);
  } catch (e) {
    console.error('[cicada-flasher] esptool-js load failed', e);
    throw new Error(
      'Не удалось загрузить модуль прошивки (esptool-js). '
      + 'Обновите страницу; если ошибка повторяется — перезапустите сервер Cicada Studio.',
    );
  }
}

export async function requestSerialPort() {
  await releaseSerialPorts();
  try {
    return await navigator.serial.requestPort();
  } catch (e) {
    if (e?.name === 'NotFoundError') {
      throw new Error('Порт не выбран. Подключите ESP по USB и повторите.');
    }
    throw e;
  }
}

/** @param {string} chipName @param {string} chipFamily */
export function chipMatchesFamily(chipName, chipFamily) {
  const c = String(chipName || '').toUpperCase();
  const f = String(chipFamily || '').toUpperCase();
  if (f === 'ESP8266') return c.includes('8266');
  if (f === 'ESP32') return c.includes('ESP32');
  return c.includes(f.replace(/^ESP/, ''));
}

/** @param {string} chipName */
export function detectChipFamily(chipName) {
  const c = String(chipName || '').toUpperCase();
  if (c.includes('8266')) return 'ESP8266';
  if (c.includes('ESP32')) return 'ESP32';
  return null;
}

/**
 * @param {object} manifest
 * @param {string} chipName
 * @param {string} [preferredFamily]
 */
export function pickManifestBuild(manifest, chipName, preferredFamily) {
  const builds = manifest?.builds || [];
  if (!builds.length) throw new Error('В manifest нет сборок для прошивки.');

  const detected = detectChipFamily(chipName);
  let build = detected
    ? builds.find((b) => chipMatchesFamily(chipName, b.chipFamily))
    : null;
  if (!build && preferredFamily) {
    build = builds.find((b) => b.chipFamily === preferredFamily);
  }
  if (!build && builds.length === 1) build = builds[0];
  if (!build) {
    throw new Error(
      `Прошивка для ${chipName} не найдена в manifest. Доступно: ${builds.map((b) => b.chipFamily).join(', ')}`,
    );
  }
  if (detected && !chipMatchesFamily(chipName, build.chipFamily)) {
    throw new Error(
      `На плате ${chipName}, а в manifest — ${build.chipFamily}. Выберите другой .bin или пересоберите прошивку.`,
    );
  }
  return build;
}

/**
 * @param {string} manifestUrl
 * @param {object} build
 * @param {RequestInit} [fetchInit]
 * @returns {Promise<{ data: Uint8Array, address: number }[]>}
 */
export async function loadManifestBuildParts(manifestUrl, build, fetchInit = {}) {
  const base = new URL(manifestUrl, location.origin);
  const init = { cache: 'no-store', credentials: 'same-origin', ...fetchInit };
  const parts = [];

  for (const part of build.parts || []) {
    const url = new URL(part.path, base).href;
    const r = await fetch(url, init);
    if (r.status === 401) {
      const err = new Error('auth');
      err.code = 'auth';
      throw err;
    }
    if (!r.ok) {
      throw new Error(`Не удалось загрузить ${part.path} (${r.status})`);
    }
    const data = new Uint8Array(await r.arrayBuffer());
    if (data.length < 4) {
      throw new Error(`Файл ${part.path} пустой или повреждён.`);
    }
    parts.push({ data, address: part.offset ?? 0 });
  }

  if (!parts.length) throw new Error('В сборке manifest нет файлов прошивки.');
  return parts;
}

/**
 * @param {{
 *   port: SerialPort,
 *   parts: { data: Uint8Array, address: number }[],
 *   eraseFlash?: boolean,
 *   onProgress?: (pct: number, stage: string) => void,
 *   onLog?: (line: string) => void,
 *   isAborted?: () => boolean,
 *   onChipDetected?: (chip: string) => void | Promise<void>,
 * }} opts
 */
export async function flashEspDevice({
  port,
  parts,
  eraseFlash = true,
  onProgress,
  onLog,
  isAborted,
  onChipDetected,
}) {
  const { ESPLoader, Transport } = await importEsptool();
  const transport = new Transport(port, true);
  const loader = new ESPLoader({
    transport,
    baudrate: 115200,
    terminal: {
      clean() {},
      writeLine() {},
      write() {},
    },
  });

  const totalBytes = parts.reduce((n, p) => n + p.data.byteLength, 0);
  const sizeKb = (totalBytes / 1024).toFixed(1);

  const abort = () => {
    if (isAborted?.()) throw new Error('Отменено');
  };

  try {
    onProgress?.(2, 'Подключение к загрузчику…');
    onLog?.('Подключение…');
    const chip = await loader.main();
    onLog?.(`Чип: ${chip}`);
    await onChipDetected?.(chip);
    abort();

    if (eraseFlash) {
      onProgress?.(8, 'Стирание flash…');
      onLog?.('Стирание flash…');
      await loader.eraseFlash();
      abort();
    }

    onProgress?.(12, 'Запись прошивки…');
    onLog?.(`Запись ${sizeKb} KB…`);

    const fileArray = parts.map((p) => ({ data: p.data, address: p.address }));
    await loader.writeFlash({
      fileArray,
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress(_fileIndex, written, total) {
        const pct = 12 + Math.floor((written / total) * 83);
        onProgress?.(pct, 'Запись прошивки…');
      },
    });
    abort();

    onProgress?.(98, 'Перезагрузка…');
    onLog?.('Перезагрузка устройства…');
    await loader.after('hard_reset');
    onProgress?.(100, 'Готово');

    return { chip, sizeKb };
  } finally {
    try {
      await transport.disconnect();
    } catch { /* ignore */ }
    await releaseSerialPorts();
  }
}

/**
 * Привязка к стандартной разметке диалога (#flash-overlay, #flash-dialog, …).
 * @param {{
 *   flashBtn: HTMLButtonElement,
 *   flashStatus?: HTMLElement,
 *   getFlashPackage: () => Promise<{ name: string, parts: { data: Uint8Array, address: number }[], sizeLabel?: string }>,
 *   doneMessage?: string,
 *   onReady?: () => void,
 * }} opts
 */
export function bindFlasherDialog({
  flashBtn,
  flashStatus,
  getFlashPackage,
  doneMessage = 'Прошивка записана. Нажмите RESET на плате или отключите USB.',
  onReady,
}) {
  const overlay = document.getElementById('flash-overlay');
  const dialog = document.getElementById('flash-dialog');
  const dialogTitle = document.getElementById('flash-dialog-title');
  const dialogText = document.getElementById('flash-dialog-text');
  const eraseWrap = document.getElementById('flash-erase-wrap');
  const eraseCheck = document.getElementById('flash-erase-check');
  const progressBlock = document.getElementById('flash-progress-block');
  const progressRing = document.getElementById('flash-progress-ring');
  const progressGlow = document.getElementById('flash-progress-glow');
  const progressBar = document.getElementById('flash-progress-bar');
  const progressStage = document.getElementById('flash-progress-stage');
  const progressPct = document.getElementById('flash-progress-pct');
  const FLASH_RING_R = 52;
  const FLASH_RING_C = 2 * Math.PI * FLASH_RING_R;

  function initProgressRing() {
    for (const el of [progressRing, progressGlow]) {
      if (!el) continue;
      el.style.strokeDasharray = String(FLASH_RING_C);
      el.style.strokeDashoffset = String(FLASH_RING_C);
    }
  }
  initProgressRing();
  const dialogBack = document.getElementById('flash-dialog-back');
  const dialogNext = document.getElementById('flash-dialog-next');
  const dialogClose = document.getElementById('flash-dialog-close');

  let selectedPort = null;
  let flashing = false;
  let abortFlash = false;
  let firmwareName = 'прошивку';
  let firmwareSizeLabel = '';
  let flashParts = null;
  let validateChipFn = null;

  function setStatus(text, kind) {
    if (!flashStatus) return;
    flashStatus.textContent = text;
    flashStatus.className = kind ? `status ${kind}` : 'status';
  }

  function setProgress(pct, stage) {
    const n = Math.max(0, Math.min(100, Math.round(pct)));
    const offset = FLASH_RING_C * (1 - n / 100);
    if (progressRing) progressRing.style.strokeDashoffset = String(offset);
    if (progressGlow) progressGlow.style.strokeDashoffset = String(offset);
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(n));
    if (progressPct) progressPct.textContent = `${n}%`;
    if (stage && progressStage) progressStage.textContent = stage;
    if (progressBlock && n > 0) progressBlock.classList.add('is-active');
  }

  function openDialog(state) {
    if (!overlay || !dialog) return;
    dialog.dataset.state = state;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeDialog() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    if (progressBlock) {
      progressBlock.hidden = true;
      progressBlock.classList.remove('is-active');
    }
    if (eraseWrap) eraseWrap.hidden = false;
    setProgress(0, 'Подготовка…');
    if (dialog) dialog.dataset.state = 'confirm';
    if (dialogTitle) dialogTitle.textContent = 'Установка прошивки';
    if (dialogText) {
      dialogText.innerHTML =
        `Стереть память перед установкой <strong>${firmwareName}</strong>? `
        + 'Все данные на устройстве будут удалены.';
    }
    if (dialogBack) {
      dialogBack.hidden = false;
      dialogBack.textContent = 'Назад';
    }
    if (dialogNext) {
      dialogNext.textContent = 'Далее';
      dialogNext.disabled = false;
    }
  }

  async function runFlash() {
    if (!flashParts?.length) throw new Error('Прошивка не загружена.');
    if (!selectedPort) throw new Error('COM-порт не выбран.');

    abortFlash = false;
    flashing = true;
    flashBtn.disabled = true;
    flashBtn.classList.add('is-busy');

    if (progressBlock) {
      progressBlock.hidden = false;
      progressBlock.classList.add('is-active');
    }
    if (eraseWrap) eraseWrap.hidden = true;
    if (dialogBack) dialogBack.hidden = true;
    if (dialogNext) dialogNext.disabled = true;
    if (dialogTitle) dialogTitle.textContent = 'Запись прошивки';
    if (dialogText) dialogText.textContent = 'Не закрывайте вкладку до завершения.';
    try {
      await flashEspDevice({
        port: selectedPort,
        parts: flashParts,
        eraseFlash: Boolean(eraseCheck?.checked),
        onProgress: setProgress,
        isAborted: () => abortFlash,
        onChipDetected: validateChipFn || undefined,
      });

      if (dialog) dialog.dataset.state = 'done';
      if (dialogTitle) dialogTitle.textContent = 'Установка завершена';
      if (dialogText) dialogText.textContent = doneMessage;
      if (dialogNext) {
        dialogNext.textContent = 'Готово';
        dialogNext.disabled = false;
      }
      setStatus('Прошивка записана.', 'ok');
    } finally {
      flashing = false;
      flashBtn.disabled = false;
      flashBtn.classList.remove('is-busy');
      selectedPort = null;
    }
  }

  async function onFlashClick() {
    if (flashing || flashBtn.disabled) return;

    const unsupported = unsupportedBrowserMessage();
    if (unsupported) {
      setStatus(unsupported, 'err');
      return;
    }

    try {
      setStatus('Выберите COM-порт в окне браузера…');
      const pkg = await getFlashPackage();
      flashParts = pkg.parts;
      validateChipFn = pkg.validateChip || null;
      firmwareName = pkg.name || 'прошивку';
      firmwareSizeLabel = pkg.sizeLabel || '';
      if (dialogText) {
        dialogText.innerHTML =
          `Стереть память перед установкой <strong>${firmwareName}</strong>? `
          + 'Все данные на устройстве будут удалены.';
      }

      selectedPort = await requestSerialPort();
      if (eraseCheck) eraseCheck.checked = true;
      openDialog('confirm');
      if (dialogNext) dialogNext.textContent = 'Начать запись';
      const sizeHint = firmwareSizeLabel ? ` ${firmwareSizeLabel}.` : '';
      setStatus(`Порт выбран.${sizeHint} Подтвердите стирание flash.`, 'ok');
    } catch (e) {
      if (e?.code === 'auth' || e?.message === 'auth') return;
      setStatus(e?.message || 'Не удалось начать прошивку', 'err');
      await releaseSerialPorts();
    }
  }

  async function onDialogNext() {
    if (dialog?.dataset.state === 'done') {
      closeDialog();
      return;
    }
    if (flashing) return;
    try {
      await runFlash();
    } catch (e) {
      if (dialog) dialog.dataset.state = 'error';
      if (dialogTitle) dialogTitle.textContent = 'Ошибка установки';
      if (dialogText) dialogText.textContent = e?.message || 'Произошла ошибка при прошивке.';
      if (dialogNext) {
        dialogNext.textContent = 'Закрыть';
        dialogNext.disabled = false;
      }
      if (dialogBack) {
        dialogBack.hidden = false;
        dialogBack.textContent = 'Назад';
      }
      setStatus(e?.message || 'Ошибка прошивки', 'err');
    }
  }

  function onDialogBack() {
    if (flashing) {
      abortFlash = true;
      return;
    }
    closeDialog();
    releaseSerialPorts();
    selectedPort = null;
    const hint = firmwareSizeLabel ? ` ${firmwareSizeLabel}` : '';
    setStatus(`Прошивка${hint} готова. Нажмите «Прошить».`, 'ok');
  }

  flashBtn?.addEventListener('click', onFlashClick);
  dialogNext?.addEventListener('click', onDialogNext);
  dialogBack?.addEventListener('click', onDialogBack);
  dialogClose?.addEventListener('click', onDialogBack);

  onReady?.();

  return { setStatus, closeDialog, enableFlash: (enabled) => { flashBtn.disabled = !enabled; } };
}
