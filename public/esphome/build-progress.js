/**
 * Окно сборки bin — круговой прогресс + терминал лога внизу.
 */
const BuildProgress = (() => {
  const STEP_ORDER = ['upload', 'validate', 'compile', 'publish'];
  const RING_R = 52;
  const RING_C = 2 * Math.PI * RING_R;
  const MAX_TERMINAL_LINES = 160;

  let creepTimer = null;
  let creepValue = 0;
  let busy = false;
  let lastLogText = '';
  let compileStartedAnnounced = false;
  let jobAcceptedAnnounced = false;
  let buildFinished = false;
  let binDownloaded = false;
  let ringReady = false;
  let lastBuildResult = null;

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function classifyLine(line) {
    const s = String(line || '').trim();
    if (!s) return 'dim';
    if (/\b(error|failed|fatal|ошибк)\b/i.test(s)) return 'err';
    if (/\bwarn(ing)?\b/i.test(s)) return 'warn';
    if (/\b(success|succeeded|done|готов|complete)\b/i.test(s)) return 'ok';
    if (/^(Compiling|Linking|Building|CONFIGURING|esphome|pio |xtensa|cmake)/i.test(s)) return 'cmd';
    return 'info';
  }

  function syncTerminal(extraLines = []) {
    const term = el('buildProgressTerminal');
    if (!term) return;

    const chunks = [];
    if (lastLogText) chunks.push(lastLogText);
    for (const line of extraLines) {
      if (line) chunks.push(String(line));
    }

    if (!chunks.length) {
      term.innerHTML = '';
      return;
    }

    const lines = chunks.join('\n').split(/\r?\n/);
    const tail = lines.slice(-MAX_TERMINAL_LINES);

    term.innerHTML = tail.map((line) => {
      const kind = classifyLine(line);
      const text = escapeHtml(line) || '&nbsp;';
      return `<div class="esptool-line esptool-line--${kind}"><span class="esptool-line__m">${text}</span></div>`;
    }).join('');

    term.scrollTop = term.scrollHeight;
  }

  function appendTerminalNote(line, kind = 'info') {
    const term = el('buildProgressTerminal');
    if (!term) return;
    const row = document.createElement('div');
    row.className = `esptool-line esptool-line--${kind}`;
    row.innerHTML = `<span class="esptool-line__m">${escapeHtml(line)}</span>`;
    term.appendChild(row);
    while (term.children.length > MAX_TERMINAL_LINES) {
      term.removeChild(term.firstChild);
    }
    term.scrollTop = term.scrollHeight;
  }

  function initRing() {
    if (ringReady) return;
    const ring = el('buildProgressRing');
    const glow = el('buildProgressGlow');
    for (const node of [ring, glow]) {
      if (!node) continue;
      node.style.strokeDasharray = String(RING_C);
      node.style.strokeDashoffset = String(RING_C);
    }
    ringReady = Boolean(ring);
  }

  function setFill(percent) {
    initRing();
    const v = Math.max(0, Math.min(100, Math.round(percent)));
    const offset = RING_C * (1 - v / 100);
    const ring = el('buildProgressRing');
    const glow = el('buildProgressGlow');
    if (ring) ring.style.strokeDashoffset = String(offset);
    if (glow) glow.style.strokeDashoffset = String(offset);
    const pct = el('buildProgressPct');
    const bar = el('buildProgressBar');
    if (pct) pct.textContent = `${v}%`;
    if (bar) bar.setAttribute('aria-valuenow', String(v));
    const block = el('buildProgressRingBlock');
    if (block && v > 0) block.classList.add('is-active');
    return v;
  }

  function setStage(text) {
    const stage = el('buildProgressStage');
    if (stage) stage.textContent = text || '';
  }

  function setChipLabel() {
    const chip = el('buildProgressChip');
    if (!chip) return;
    const board = document.getElementById('board')?.value
      || document.querySelector('[name="board"]')?.value
      || '';
    const dev = typeof EspFirmwareTools !== 'undefined'
      ? EspFirmwareTools.resolveDeviceName()
      : '';
    chip.textContent = board || dev || 'ESPHome';
  }

  function setStep(activeStep, doneBefore = false) {
    const list = el('buildProgressSteps');
    if (!list) return;
    const idx = STEP_ORDER.indexOf(activeStep);
    list.querySelectorAll('li').forEach((li) => {
      const step = li.dataset.step;
      const si = STEP_ORDER.indexOf(step);
      li.classList.remove('is-active', 'is-done', 'is-pending', 'is-error');
      if (si < idx || (doneBefore && si <= idx)) li.classList.add('is-done');
      else if (step === activeStep) li.classList.add('is-active');
      else li.classList.add('is-pending');
    });
  }

  function setState(state) {
    const modal = el('buildProgressModal');
    if (modal) modal.dataset.state = state || 'running';
  }

  function formatBuildError(error) {
    const msg = String(error?.message || '').trim();
    if (error?.code === 'FIRMWARE_BUILD_TIMEOUT' || /timed out after \d+ms/i.test(msg) || /таймаут/i.test(msg)) {
      return 'Сборка заняла слишком много времени. Первая компиляция на сервере может длиться 20–30 минут — запустите сборку снова; повторные обычно быстрее.';
    }
    return msg || 'Ошибка сборки';
  }

  function ingestServerLog(raw) {
    lastLogText = String(raw || '').trim();
    syncTerminal();
  }

  function stopCreep() {
    if (creepTimer) {
      clearInterval(creepTimer);
      creepTimer = null;
    }
  }

  function startCreep() {
    stopCreep();
    creepValue = 2;
    setFill(creepValue);
    setStep('upload');

    creepTimer = setInterval(() => {
      if (!busy) return;
      const cap = 92;
      if (creepValue >= cap) return;
      const delta = creepValue < 20 ? 1.8 : creepValue < 50 ? 0.85 : creepValue < 78 ? 0.3 : 0.1;
      creepValue = Math.min(cap, creepValue + delta);
      setFill(creepValue);

      if (creepValue < 12) {
        setStep('upload');
        setStage('Отправка конфигурации…');
      } else if (creepValue < 28) {
        setStep('validate');
        setStage('Валидация esphome.yaml…');
      } else if (creepValue < 78) {
        setStep('compile');
        setStage('Компиляция прошивки…');
      } else {
        setStep('publish');
        setStage('Публикация firmware.bin…');
      }
    }, 520);
  }

  function hideAllActionButtons() {
    const closeBtn = el('buildProgressCloseBtn');
    const downloadBtn = el('buildProgressDownloadBtn');
    const flashBtn = el('buildProgressFlashBtn');
    if (closeBtn) closeBtn.hidden = true;
    if (downloadBtn) {
      downloadBtn.hidden = true;
      downloadBtn.disabled = false;
    }
    if (flashBtn) {
      flashBtn.hidden = true;
      flashBtn.disabled = false;
    }
  }

  function ensureBuildingUi() {
    if (buildFinished) return;
    const actions = el('buildProgressActions');
    if (actions) actions.hidden = true;
    hideAllActionButtons();
  }

  function open() {
    busy = true;
    buildFinished = false;
    binDownloaded = false;
    lastLogText = '';
    compileStartedAnnounced = false;
    jobAcceptedAnnounced = false;

    const overlay = el('buildProgressOverlay');
    if (!overlay) return;

    setState('running');
    setChipLabel();
    initRing();
    setFill(0);
    setStage('Инициализация…');
    setStep('upload');
    const ringBlock = el('buildProgressRingBlock');
    if (ringBlock) ringBlock.classList.add('is-active');
    ensureBuildingUi();
    syncTerminal();

    const hint = el('buildProgressHint');
    if (hint) hint.textContent = 'Не закрывайте вкладку до завершения.';

    overlay.hidden = false;
    overlay.removeAttribute('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-busy', 'true');
    startCreep();

    if (typeof appendDashboardLog === 'function') {
      appendDashboardLog('Сборка прошивки…', 'info');
    }
  }

  function close() {
    busy = false;
    buildFinished = false;
    binDownloaded = false;
    stopCreep();
    const ringBlock = el('buildProgressRingBlock');
    if (ringBlock) ringBlock.classList.remove('is-active');
    const overlay = el('buildProgressOverlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeAttribute('aria-busy');
    }
  }

  function showActions({ success = false, flash = false, download = false } = {}) {
    if (!buildFinished && success) return;

    const actions = el('buildProgressActions');
    const closeBtn = el('buildProgressCloseBtn');
    const downloadBtn = el('buildProgressDownloadBtn');
    const flashBtn = el('buildProgressFlashBtn');

    hideAllActionButtons();

    if (actions) actions.hidden = false;

    if (success) {
      if (downloadBtn) {
        downloadBtn.hidden = !download;
        downloadBtn.disabled = !download;
      }
      if (flashBtn) {
        flashBtn.hidden = !flash;
        flashBtn.disabled = !flash;
      }
    } else if (closeBtn) {
      closeBtn.hidden = false;
    }
  }

  function complete(data) {
    lastBuildResult = data;
    if (typeof EspFirmwareTools !== 'undefined' && EspFirmwareTools.rememberBuildResult) {
      EspFirmwareTools.rememberBuildResult(data);
    }
    busy = false;
    buildFinished = true;
    binDownloaded = false;
    stopCreep();
    setState('success');
    setStep('publish', true);
    setFill(100);

    const name = data?.meta?.deviceName || (typeof EspFirmwareTools !== 'undefined'
      ? EspFirmwareTools.resolveDeviceName()
      : 'device');
    const ver = data?.meta?.version || '—';

    if (data?.log) ingestServerLog(data.log);
    setStage('Готово');
    const hint = el('buildProgressHint');
    if (hint) {
      hint.textContent = `Прошивка ${name} · v${ver} готова. Скачайте bin, затем можно прошить.`;
    }

    appendTerminalNote(`✓ Сборка завершена: ${name} · v${ver}`, 'ok');
    showActions({ success: true, download: true, flash: false });

    if (typeof appendDashboardLog === 'function') {
      appendDashboardLog('Прошивка собрана', 'ok');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function capCreepWhileQueued() {
    if (creepValue > 28) {
      creepValue = 28;
      setFill(creepValue);
    }
  }

  function onPollUpdate(data) {
    if (!data) return;
    ensureBuildingUi();

    if (data.status === 'queued') {
      if (!jobAcceptedAnnounced) jobAcceptedAnnounced = true;
      const pos = data.queuePosition || 0;
      const qlen = data.queueLength || 0;
      const running = data.runningBuilds ?? 0;
      const max = data.maxConcurrent || 1;
      if (pos > 1) {
        setStage(`В очереди: ${pos}${qlen ? ` из ${qlen}` : ''}…`);
      } else if (running >= max) {
        setStage(`Ожидание слота (${running}/${max})…`);
      } else {
        setStage('Запуск сборки на сервере…');
      }
      setStep('validate');
      capCreepWhileQueued();
      if (data.log) ingestServerLog(data.log);
      return;
    }

    if (data.log) ingestServerLog(data.log);

    const compiling = data.status === 'compiling'
      || (data.status === 'running' && data.stage === 'building');
    if (compiling) {
      setStep('compile');
      setStage('Компиляция на сервере…');
      if (!compileStartedAnnounced) compileStartedAnnounced = true;
      if (creepValue < 35) {
        creepValue = 35;
        setFill(creepValue);
      }
      return;
    }
    if (data.stage === 'publishing') {
      setStep('publish');
      setStage('Публикация firmware.bin…');
    }
  }

  function fail(error) {
    busy = false;
    buildFinished = true;
    binDownloaded = false;
    stopCreep();
    setState('error');

    const msg = formatBuildError(error);
    setFill(Math.max(creepValue, 8));
    setStage(msg);

    const hint = el('buildProgressHint');
    if (hint) hint.textContent = msg;

    const list = el('buildProgressSteps');
    const active = list?.querySelector('li.is-active');
    if (active) {
      active.classList.remove('is-active');
      active.classList.add('is-error');
    }

    if (error?.log) ingestServerLog(error.log);
    appendTerminalNote(msg, 'err');

    showActions({ success: false });

    if (typeof appendDashboardLog === 'function') {
      appendDashboardLog(msg, 'err');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  async function onDownloadClick() {
    const downloadBtn = el('buildProgressDownloadBtn');
    if (!buildFinished || !downloadBtn || downloadBtn.hidden || downloadBtn.disabled) return;

    downloadBtn.disabled = true;
    appendTerminalNote('Скачивание firmware.bin…', 'cmd');

    try {
      if (typeof EspFirmwareTools === 'undefined' || !EspFirmwareTools.downloadBin) {
        throw new Error('Скачивание недоступно');
      }
      await EspFirmwareTools.downloadBin({
        downloadUrl: lastBuildResult?.downloadUrl,
        buildJob: lastBuildResult?.sessionId || lastBuildResult?.jobId,
      });
      binDownloaded = true;
      appendTerminalNote('Файл сохранён. Можно прошить устройство.', 'ok');
      showActions({ success: true, download: false, flash: true });
    } catch (err) {
      const msg = [err?.message, err?.hint].filter(Boolean).join(' ') || 'Не удалось скачать прошивку';
      appendTerminalNote(msg, 'err');
      downloadBtn.disabled = false;
      if (typeof appendDashboardLog === 'function') {
        appendDashboardLog(msg, 'err');
      }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function bindUi() {
    const overlay = el('buildProgressOverlay');
    const closeBtn = el('buildProgressCloseBtn');
    const downloadBtn = el('buildProgressDownloadBtn');
    const flashBtn = el('buildProgressFlashBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => close());
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => { onDownloadClick(); });
    }
    if (flashBtn) {
      flashBtn.addEventListener('click', async () => {
        if (!buildFinished || !binDownloaded || flashBtn.hidden || flashBtn.disabled) return;
        if (typeof EspFirmwareTools !== 'undefined' && EspFirmwareTools.openFlash) {
          const job = lastBuildResult?.sessionId || lastBuildResult?.jobId;
          await EspFirmwareTools.openFlash({
            buildJob: job,
            downloadUrl: lastBuildResult?.downloadUrl,
            apiEncryptionKey: lastBuildResult?.apiEncryptionKey,
          });
          return;
        }
        if (typeof flashBoard === 'function') await flashBoard();
      });
    }
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target !== overlay) return;
        if (!busy) close();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi);
  } else {
    bindUi();
  }

  return { open, close, complete, fail, onPollUpdate };
})();
