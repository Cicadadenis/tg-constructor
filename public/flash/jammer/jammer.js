import {
  browserFlashSupported,
  releaseSerialPorts,
  unsupportedBrowserMessage,
  bindFlasherDialog,
  chipMatchesFamily,
} from '../cicada-flasher.js';

const BIN_URL = '/firmware/jammer/esp8266_deauther.bin';
const MIN_FIRMWARE_BYTES = 50 * 1024;
const ESP_IMAGE_MAGIC = 0xe9;
const FIRMWARE_NAME = 'Cicada ESP8266 Глушилка';

let firmwareBytes = null;
let firmwareSizeKb = '';

const flashBtn = document.getElementById('flash-btn');
const exitBtn = document.getElementById('exit-btn');

async function isEsp8266ImageBlob(blob) {
  if (blob.size < 4) return false;
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return head[0] === ESP_IMAGE_MAGIC;
}

async function verifyJammerFirmwareReady() {
  const br = await fetch(BIN_URL, { credentials: 'same-origin', cache: 'no-store' });
  if (br.status === 401) {
    const rt = location.pathname + location.search;
    try { sessionStorage.setItem('cicada_return_to', rt); } catch { /* ignore */ }
    location.href = `/?login=1&returnTo=${encodeURIComponent(rt)}`;
    throw new Error('auth');
  }
  if (br.status === 403) {
    throw new Error(
      'Прошивка глушилки доступна при подписке PRO от 14 дней. Оформите в Cicada Studio → Профиль.',
    );
  }
  if (!br.ok) {
    throw new Error(
      'Прошивка не найдена на сервере. Положите esp8266_deauther.bin и выполните npm run jammer:publish.',
    );
  }
  const blob = await br.blob();
  if (blob.size < MIN_FIRMWARE_BYTES || !(await isEsp8266ImageBlob(blob))) {
    throw new Error(
      'Сервер вернул не прошивку (часто HTML вместо .bin). Проверьте nginx: location /firmware/ → Node.',
    );
  }
  firmwareBytes = new Uint8Array(await blob.arrayBuffer());
  firmwareSizeKb = (blob.size / 1024).toFixed(0);
  const sizeHint = blob.size > 600 * 1024 ? ' Плата ≥1 MB flash (NodeMCU).' : '';
  return { sizeKb: firmwareSizeKb, sizeHint };
}

async function loadPremiumAccess() {
  const Sub = window.CicadaStudioSubscription;
  if (!Sub) return { allowed: false, minDays: 14, reason: 'no_pro' };
  try {
    return await Sub.resolveEspAccess(14);
  } catch {
    const cached = Sub.readSession();
    return cached ? Sub.espAccessFromUser(cached, 14) : { allowed: false, minDays: 14 };
  }
}

function premiumDeniedText(access) {
  const min = access?.minDays || 14;
  if (access?.daysLeft > 0 && access.daysLeft < min) {
    return (
      `Прошивка глушилки доступна при подписке PRO от ${min} дней (сейчас ${access.daysLeft} дн.). `
      + 'Оформите тариф «2 недели» или дольше в Cicada Studio → Профиль.'
    );
  }
  return (
    `Прошивка глушилки доступна при активной подписке PRO от ${min} дней. `
    + 'Оформите подписку в Cicada Studio → Профиль.'
  );
}

function handleExit() {
  if (window.CicadaFlashReturn?.handleExitClick) {
    window.CicadaFlashReturn.handleExitClick();
    return;
  }
  releaseSerialPorts().finally(() => location.replace('/esphome/'));
}

exitBtn?.addEventListener('click', handleExit);
window.addEventListener('beforeunload', () => { releaseSerialPorts(); });

const flasher = bindFlasherDialog({
  flashBtn,
  flashStatus: document.getElementById('flash-status'),
  getFlashPackage: async () => {
    if (!firmwareBytes?.length) throw new Error('Прошивка не загружена.');
    return {
      name: FIRMWARE_NAME,
      sizeLabel: `${firmwareSizeKb} KB`,
      parts: [{ data: firmwareBytes, address: 0 }],
      validateChip: (chip) => {
        if (!chipMatchesFamily(chip, 'ESP8266')) {
          throw new Error(`Ожидался ESP8266, обнаружено: ${chip}. Проверьте плату и кабель.`);
        }
      },
    };
  },
  doneMessage:
    'Прошивка записана. Нажмите RESET на плате или отключите USB. '
    + 'Появится Wi‑Fi сеть cicada3301 (пароль cicada3301).',
});

(async function init() {
  await releaseSerialPorts();

  const unsupported = unsupportedBrowserMessage();
  if (unsupported) {
    flasher.setStatus(unsupported, 'err');
    return;
  }

  const premium = await loadPremiumAccess();
  if (premium.reason === 'auth') return;
  if (!premium.allowed) {
    flasher.setStatus(premiumDeniedText(premium), 'err');
    return;
  }

  try {
    const { sizeKb, sizeHint } = await verifyJammerFirmwareReady();
    flasher.enableFlash(true);
    flasher.setStatus(
      `Прошивка ${sizeKb} KB готова.${sizeHint} Нажмите «Прошить» и выберите COM-порт.`,
      'ok',
    );
  } catch (e) {
    if (e?.message === 'auth') return;
    flasher.setStatus(e?.message || 'Не удалось подготовить прошивку', 'err');
  }
})();
