/**
 * Русификация диалогов esp-web-tools (в библиотеке нет встроенного i18n).
 * Lit перерисовывает UI — наблюдаем shadow DOM и периодически обновляем строки.
 */
(function () {
  const EXACT = new Map([
    ['Erase device', 'Стереть память устройства'],
    ['Back', 'Назад'],
    ['Next', 'Далее'],
    ['Close', 'Закрыть'],
    ['Cancel', 'Отмена'],
    ['Try Again', 'Повторить'],
    ['Install', 'Установить'],
    ['Skip', 'Пропустить'],
    ['Connecting', 'Подключение…'],
    ['Error', 'Ошибка'],
    ['Failed', 'Ошибка'],
    ['No port selected', 'Порт не выбран'],
    ['Erase User Data', 'Стереть пользовательские данные'],
    ['Confirm Installation', 'Подтверждение установки'],
    ['Installing', 'Установка'],
    ['Preparing installation', 'Подготовка к установке'],
    ['Erasing', 'Стирание памяти'],
    ['Wrapping up', 'Завершение'],
    ['Installation complete!', 'Установка завершена!'],
    ['Installation failed', 'Ошибка установки'],
    ['Disconnected', 'Соединение разорвано'],
    ['Configure Wi-Fi', 'Настройка Wi‑Fi'],
    ['Connect to Wi-Fi', 'Подключить к Wi‑Fi'],
    ['Change Wi-Fi', 'Сменить Wi‑Fi'],
    ['Scanning for networks', 'Поиск сетей…'],
    ['Trying to connect', 'Подключение к сети…'],
    ['Network', 'Сеть'],
    ['Network Name', 'Имя сети'],
    ['Password', 'Пароль'],
    ['Unable to connect', 'Не удалось подключиться'],
    ['Timeout', 'Тайм-аут'],
    ['Device connected to the network!', 'Устройство подключено к сети!'],
    ['Failed to download manifest', 'Не удалось загрузить manifest'],
    [
      'Failed to initialize. Try resetting your device or holding the BOOT button while clicking INSTALL.',
      'Не удалось подключиться к загрузчику. Зажмите BOOT, нажмите RESET, отпустите RESET, через 1–2 с отпустите BOOT и нажмите «Установить» снова.',
    ],
    ['Improv Wi-Fi Serial not detected', 'Improv Wi‑Fi на устройстве не найден (прошивка без Improv — это нормально)'],
    ['An error occurred.', 'Произошла ошибка.'],
    ['Initializing Improv Serial', 'Инициализация Improv…'],
    ['Connect', 'Подключить'],
    ['Visit Device', 'Открыть устройство'],
    ['View Logs', 'Журнал'],
    ['Logs & Console', 'Журнал и консоль'],
    ['Show Logs', 'Показать журнал'],
    ['Fund Development by Nabu Casa', 'Поддержать Nabu Casa'],
    ['Add to Home Assistant', 'Добавить в Home Assistant'],
    [
      'This will take a minute. Keep this page visible to prevent slow down',
      'Это займёт около минуты. Не закрывайте страницу — иначе прошивка замедлится.',
    ],
    [
      'This will take a minute. Keep this page visible to prevent slowdown',
      'Это займёт около минуты. Не закрывайте страницу — иначе прошивка замедлится.',
    ],
    [
      'This will take a minute. Keep this page visible to prevent slowing down',
      'Это займёт около минуты. Не закрывайте страницу — иначе прошивка замедлится.',
    ],
  ]);

  const PATTERNS = [
    [
      /^Do you want to erase the device before installing (.+)\? All data on the device will be lost\.$/,
      'Стереть память перед установкой «$1»? Все данные на устройстве будут удалены.',
    ],
    [
      /^Do you want to reset your device and erase all user data from your device\?$/,
      'Сбросить устройство и удалить все пользовательские данные?',
    ],
    [
      /^Do you want to (update to|install) (.+)\?$/,
      (_, action, name) =>
        action === 'update to'
          ? `Обновить до «${name}»?`
          : `Установить «${name}»?`,
    ],
    [/^Connected to (.+)$/, 'Подключено: $1'],
    [/^Install (.+)$/, 'Установить $1'],
    [
      /^Your device is running (.+)\s+(.+)\.$/,
      'На устройстве: $1 $2.',
    ],
    [
      /^Serial port is not readable\/writable\. Close any other application using it and try again\.$/,
      'Порт занят другой программой. Закройте её и повторите.',
    ],
    [
      /^Serial port is not ready\. Close any other application using it and try again\.$/,
      'Порт не готов. Закройте другие программы (монитор порта, Arduino IDE) и повторите.',
    ],
    [
      /^Read timeout exceeded$/,
      'Тайм-аут: устройство не ответило в режиме прошивки. Зажмите BOOT при подключении или выберите другой COM-порт.',
    ],
    [
      /^No serial data received\.?$/,
      'С порта не пришло данных — проверьте кабель, драйвер USB-UART и что порт не занят другой программой.',
    ],
    [
      /^All data on the device will be erased\.$/,
      'Все данные на устройстве будут стёрты.',
    ],
    [/^(\d+)%$/, '$1\u00a0%'],
  ];

  const NO_PORT_RU = `Если порт не отображается в списке, проверьте:

1. Устройство подключено к этому компьютеру (где открыт браузер).
2. На плате горит индикатор питания (если есть).
3. USB-кабель поддерживает передачу данных, а не только зарядку.
4. Установлены драйверы для чипа (CP2102, CH340/CH341, CH9102 и т.д.) — ссылки ниже в диалоге.
5. На Linux: пользователь в группе dialout.`;

  function translateLine(text) {
    const trimmed = text.trim();
    if (!trimmed) return text;

    if (EXACT.has(trimmed)) {
      return text.replace(trimmed, EXACT.get(trimmed));
    }

    for (const [re, repl] of PATTERNS) {
      const m = trimmed.match(re);
      if (m) {
        const out = typeof repl === 'function'
          ? repl(...m)
          : trimmed.replace(re, repl);
        return text.replace(trimmed, out);
      }
    }

    if (trimmed.includes("If you didn't select a port because you didn't see your device")) {
      return NO_PORT_RU;
    }
    if (trimmed.startsWith('Make sure that the device is connected')) return '';
    if (trimmed.startsWith('Most devices have a tiny light')) return '';
    if (trimmed.startsWith('Make sure that the USB cable')) return '';
    if (trimmed.startsWith('Make sure you have the right drivers')) {
      return 'Установите драйверы USB-UART для вашего чипа:';
    }
    if (trimmed.includes('CP2102 drivers:')) return 'Драйверы CP2102:';
    if (trimmed.includes('CH342, CH343, CH9102')) return 'Драйверы CH9102 / CH343:';
    if (trimmed.includes('CH340, CH341 drivers:')) return 'Драйверы CH340 / CH341:';
    if (trimmed === 'Windows & Mac') return 'Windows и Mac';

    return text;
  }

  function applyToTextNode(node) {
    const next = translateLine(node.textContent);
    if (next !== node.textContent) node.textContent = next;
  }

  function applyToElementAttrs(el) {
    for (const attr of ['aria-label', 'title', 'placeholder', 'label']) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      const t = translateLine(v);
      if (t !== v) el.setAttribute(attr, t);
    }
  }

  const observedRoots = new WeakSet();

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) return;
    observedRoots.add(root);
    const observer = new MutationObserver(scheduleScan);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function walkNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      applyToTextNode(node);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = /** @type {Element} */ (node);
    applyToElementAttrs(el);

    if (el.shadowRoot) {
      observeRoot(el.shadowRoot);
      walkNode(el.shadowRoot);
    }
    for (const child of el.childNodes) walkNode(child);
  }

  const HOST_SELECTORS = [
    'esp-web-install-button',
    'ewt-install-dialog',
    'ewt-no-port-picked-dialog',
    'ewt-dialog',
    'ewt-page-progress',
  ].join(', ');

  function scanAll() {
    walkNode(document.body);
    document.querySelectorAll(HOST_SELECTORS).forEach((host) => {
      if (host.shadowRoot) {
        observeRoot(host.shadowRoot);
        walkNode(host.shadowRoot);
      }
    });
    document.querySelectorAll('*').forEach((el) => {
      if (!el.shadowRoot || el.matches(HOST_SELECTORS)) return;
      const tag = el.tagName.toLowerCase();
      if (tag.startsWith('ewt-') || tag.includes('esp-web')) {
        observeRoot(el.shadowRoot);
        walkNode(el.shadowRoot);
      }
    });
  }

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scanAll();
    });
  }

  let pollTimer = null;

  function hookAttachShadow() {
    if (Element.prototype.__flashI18nPatched) return;
    const native = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function patchedAttachShadow(init) {
      const opts = init && typeof init === 'object' ? { ...init, mode: 'open' } : { mode: 'open' };
      const root = native.call(this, opts);
      observeRoot(root);
      scheduleScan();
      return root;
    };
    Element.prototype.__flashI18nPatched = true;
  }

  function start() {
    hookAttachShadow();
    scanAll();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    if (!pollTimer) {
      pollTimer = setInterval(scanAll, 400);
    }
  }

  function watchInstaller(host) {
    if (!host) return;
    if (host.shadowRoot) {
      observeRoot(host.shadowRoot);
      walkNode(host.shadowRoot);
    }
    scheduleScan();
  }

  window.FlashI18n = { start, scanAll, watchInstaller };
})();
