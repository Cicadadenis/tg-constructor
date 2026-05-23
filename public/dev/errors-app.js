const API = '/api/dev/errors';

let errors = [];
let selectedId = null;
let paused = false;
let pollTimer = null;

const $ = (id) => document.getElementById(id);

const SOURCE_LABELS = {
  frontend: 'Фронтенд',
  api: 'API',
  backend: 'Бэкенд',
};

function sourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

function fmtTime(ms) {
  try {
    return new Date(ms).toLocaleString('ru-RU');
  } catch {
    return String(ms);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function filtered() {
  const f = $('filter').value;
  if (!f) return errors;
  return errors.filter((e) => e.source === f);
}

function renderStats(list) {
  const counts = { frontend: 0, api: 0, backend: 0 };
  for (const e of errors) counts[e.source] = (counts[e.source] || 0) + 1;
  $('stats').innerHTML = [
    `<span>Всего: <strong>${errors.length}</strong></span>`,
    `<span>Фронтенд: <strong>${counts.frontend}</strong></span>`,
    `<span>API: <strong>${counts.api}</strong></span>`,
    `<span>Бэкенд: <strong>${counts.backend}</strong></span>`,
    `<span>Показано: <strong>${list.length}</strong></span>`,
  ].join('');
}

function renderList(list) {
  const root = $('list');
  if (!list.length) {
    root.innerHTML = '<p class="empty"><span class="empty-icon">✓</span><br>Ошибок пока не обнаружено</p>';
    return;
  }
  root.innerHTML = list.map((e) => `
    <article class="error-item${e.id === selectedId ? ' active' : ''}" data-id="${escapeHtml(e.id)}">
      <div class="top">
        <span class="pill ${escapeHtml(e.source)}">${escapeHtml(sourceLabel(e.source))}</span>
        ${e.status != null ? `<span style="font-size:11px;color:var(--muted)">${e.status}</span>` : ''}
        <time>${escapeHtml(fmtTime(e.at))}</time>
      </div>
      <div class="msg">${escapeHtml(e.message)}</div>
    </article>
  `).join('');
  root.querySelectorAll('.error-item').forEach((el) => {
    el.addEventListener('click', () => {
      selectedId = el.dataset.id;
      render();
    });
  });
}

function renderDetail(item) {
  const panel = $('detail');
  if (!item) {
    panel.innerHTML = '<p class="empty"><span class="empty-icon">📋</span><br>Выберите ошибку из списка</p>';
    return;
  }
  const loc = item.url || item.path || '';
  const stack = item.stack || item.message;
  panel.innerHTML = `
    <div class="detail">
      <h2>${escapeHtml(item.message)}</h2>
      <div class="meta">
        <span><strong>ID</strong> ${escapeHtml(item.id)} · <strong>Источник</strong> ${escapeHtml(sourceLabel(item.source))}</span>
        <span><strong>Время</strong> ${escapeHtml(fmtTime(item.at))}</span>
        ${item.method ? `<span><strong>Метод</strong> ${escapeHtml(item.method)}</span>` : ''}
        ${loc ? `<span><strong>URL</strong> ${escapeHtml(loc)}</span>` : ''}
        ${item.status != null ? `<span><strong>Статус</strong> ${escapeHtml(item.status)}</span>` : ''}
      </div>
      <pre class="stack">${escapeHtml(stack)}</pre>
    </div>
  `;
}

function render() {
  const list = filtered();
  renderStats(list);
  renderList(list);
  const item = errors.find((e) => e.id === selectedId) || list[0];
  if (item && !selectedId) selectedId = item.id;
  renderDetail(errors.find((e) => e.id === selectedId));
  document.querySelectorAll('.error-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === selectedId);
  });
}

async function load() {
  try {
    const res = await fetch(API, { credentials: 'include' });
    if (res.status === 404) {
      $('offline').classList.add('show');
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    $('offline').classList.remove('show');
    const data = await res.json();
    errors = Array.isArray(data.errors) ? data.errors : [];
    render();
  } catch (err) {
    $('offline').classList.add('show');
    $('offline').textContent = `Панель недоступна — ${err.message}`;
  }
}

async function clearAll() {
  if (!confirm('Удалить все записанные ошибки?')) return;
  await fetch(API, { method: 'DELETE', credentials: 'include' });
  errors = [];
  selectedId = null;
  render();
}

function schedulePoll() {
  clearInterval(pollTimer);
  if (paused) return;
  pollTimer = setInterval(load, 2000);
}

$('filter').addEventListener('change', render);
$('refresh').addEventListener('click', load);
$('clear').addEventListener('click', clearAll);
$('pause').addEventListener('click', () => {
  paused = !paused;
  $('pause').textContent = paused ? 'Продолжить' : 'Пауза';
  schedulePoll();
  if (!paused) load();
});

load();
schedulePoll();
