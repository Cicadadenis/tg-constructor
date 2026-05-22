/** Dashboard UI layer for ESPHome Constructor */
(function () {
  const SENSOR_ICONS = {
    relay: 'power', dht22: 'thermometer', door: 'door-open', button: 'circle-dot',
    pir: 'person-standing', mq4: 'wind', mq135: 'cloud', soil: 'sprout',
    ds18b20: 'thermometer-snowflake', pwmled: 'lightbulb', ultrasonic: 'ruler',
    default: 'cpu',
  };

  let sessionStart = Date.now();
  let prevMetrics = {};
  let logLines = [];

  function $(id) { return document.getElementById(id); }

  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
    return Math.abs(h);
  }

  function sparklineSvg(seed, w = 120, h = 32) {
    const pts = [];
    let v = (seed % 40) + 30;
    for (let i = 0; i < 12; i++) {
      v += ((seed + i * 17) % 11) - 5;
      v = Math.max(8, Math.min(92, v));
      pts.push(v);
    }
    const step = w / (pts.length - 1);
    const d = pts.map((p, i) => `${i * step},${h - (p / 100) * h}`).join(' L ');
    return `<svg class="sensor-card__spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path d="M ${d}" fill="none" stroke="url(#sg)" stroke-width="1.5" stroke-linecap="round"/>
      <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs>
    </svg>`;
  }

  function demoValue(item) {
    const s = hashSeed(item.type + item.name);
    if (item.type === 'dht22') return `${(18 + (s % 120) / 10).toFixed(1)}°C`;
    if (item.type === 'relay' || item.type === 'button' || item.type === 'door' || item.type === 'pir')
      return s % 2 ? 'ON' : 'OFF';
    if (item.type === 'pwmled') return `${s % 100}%`;
    return `${(s % 1000) / 10}`;
  }

  function gaugePct(item) {
    return hashSeed(item.type + item.display) % 100;
  }

  function flashEl(el) {
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 900);
  }

  function formatUptime(ms) {
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}ч ${m}м`;
    if (m > 0) return `${m}м ${s}с`;
    return `${s}с`;
  }

  window.appendDashboardLog = function (message, level = 'info') {
    const stream = $('activityLog');
    if (!stream) return;
    const t = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    logLines.unshift({ t, message, level });
    if (logLines.length > 80) logLines.length = 80;
    stream.innerHTML = logLines.map((l, i) => `
      <div class="log-line${i === 0 ? ' log-line--new' : ''}">
        <span class="log-time">${l.t}</span>
        <span class="log-msg log-msg--${l.level === 'ok' ? 'ok' : l.level === 'warn' ? 'warn' : l.level === 'err' ? 'err' : ''}">${l.message}</span>
      </div>`).join('');
    if (window.lucide) lucide.createIcons();
  };

  window.updateStatusHeader = function () {
    const dev = $('devName')?.value.trim() || '';
    const ssid = $('ssid')?.value.trim() || '';
    const online = dev && ssid;
    const pill = $('statusOnline');
    const pillIcon = $('statusOnlineIcon');
    const uptimeEl = $('statusUptime');
    const wifiLabel = $('statusWifiLabel');
    const wifiBar = $('statusWifiBar');

    if (pill) {
      pill.textContent = online ? 'В сети' : 'Не в сети';
      pill.className = 'status-card__value ' + (online ? 'status-card__value--ok' : 'status-card__value--warn');
    }
    if (pillIcon) {
      pillIcon.className = 'status-card__icon ' + (online ? 'status-card__icon--online' : 'status-card__icon--offline');
      pillIcon.innerHTML = online ? '<i data-lucide="wifi"></i>' : '<i data-lucide="wifi-off"></i>';
    }
    if (uptimeEl) {
      const up = formatUptime(Date.now() - sessionStart);
      if (prevMetrics.uptime !== up) flashEl(uptimeEl.closest('.status-card'));
      prevMetrics.uptime = up;
      uptimeEl.textContent = up;
    }
    const signal = online ? Math.min(100, 40 + ssid.length * 4 + (assigned?.length || 0) * 6) : 0;
    if (wifiLabel) {
      if (prevMetrics.wifi !== signal) flashEl(wifiBar?.closest('.status-card'));
      prevMetrics.wifi = signal;
      wifiLabel.textContent = online ? `${signal}% · ${ssid}` : 'Не настроено';
    }
    if (wifiBar) wifiBar.style.width = signal + '%';
    if (window.lucide) lucide.createIcons();
  };

  window.renderSensorDashboardCards = function (items) {
    const cont = $('assigned');
    if (!cont) return;
    if (!items.length) {
      cont.innerHTML = '<div class="empty-state"><i data-lucide="radio"></i><p>Датчики не добавлены</p></div>';
      if (window.lucide) lucide.createIcons();
      return;
    }
    cont.innerHTML = '<div class="sensor-grid">' + items.map((item, i) => {
      const icon = SENSOR_ICONS[item.type] || SENSOR_ICONS.default;
      const val = demoValue(item);
      const pct = gaugePct(item);
      const seed = hashSeed(item.name + item.type);
      const proto = item.protocol ? item.protocol.toUpperCase() : 'GPIO';
      return `
        <article class="sensor-card" data-sensor-idx="${i}">
          <div class="sensor-card__top">
            <div class="sensor-card__icon"><i data-lucide="${icon}"></i></div>
            <div style="position:relative;display:flex;align-items:center;justify-content:center;width:48px;height:48px;">
              <div class="gauge" style="--pct:${pct}"><span>${pct}</span></div>
            </div>
          </div>
          <p class="sensor-card__name">${item.name}</p>
          <p class="sensor-card__meta">${proto} · ${item.display}</p>
          <p class="sensor-card__value">${val}</p>
          ${sparklineSvg(seed)}
          <button type="button" class="remove-btn" style="position:absolute;top:8px;right:8px" onclick="removeComp(${i})" aria-label="Удалить">×</button>
        </article>`;
    }).join('') + '</div>';
    if (window.lucide) lucide.createIcons();
  };

  window.renderBusMetrics = function () {
    const host = $('busMetrics');
    if (!host || typeof analyzeBuses !== 'function') return;
    const bus = analyzeBuses();
    const rows = [];
    if (bus.needI2C) rows.push({ label: 'I2C', val: `SDA ${bus.i2c.sda}`, pct: 100 });
    if (bus.needUart) rows.push({ label: 'UART', val: `TX ${bus.uart.tx}`, pct: 85 });
    if (bus.needOneWire) rows.push({ label: '1-Wire', val: bus.oneWirePin, pct: 70 });
    if (!rows.length) rows.push({ label: 'Шины', val: 'Ожидание', pct: 0 });
    host.innerHTML = rows.map(r => `
      <div class="mini-metric">
        <div class="mini-metric__label">${r.label}</div>
        <div class="mini-metric__value">${r.val}</div>
        <div class="progress-bar"><div class="progress-bar__fill" style="width:${r.pct}%"></div></div>
      </div>`).join('');
  };

  window.initDashboardUi = function () {
    appendDashboardLog('Конструктор ESPHome загружен', 'ok');
    updateStatusHeader();

    ['devName', 'ssid', 'wifiPass', 'board'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('input', updateStatusHeader);
      if (el) el.addEventListener('change', updateStatusHeader);
    });

    setInterval(() => {
      updateStatusHeader();
      if (typeof assigned !== 'undefined' && assigned.length) {
        renderSensorDashboardCards(assigned);
      }
    }, 4000);

    if (window.lucide) lucide.createIcons();
  };
})();
