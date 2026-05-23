const API_FILES = '/api/files';
const API_CHAT = '/api/ai/chat';
const API_DEV = '/api/dev';
const AUTO_OPS_KEY = 'cicada-debug-ide-auto-ops-v1';
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 1_800_000;
const CHATS_STORAGE_KEY = 'cicada-debug-ide-chats-v1';
const MAX_CHAT_SESSIONS = 40;

const $ = (id) => document.getElementById(id);
let openPath = null;
let dirty = false;
/** @type {object[]} active session messages (same ref as session.messages) */
let chatHistory = [];
let sending = false;
/** @type {{ activeId: string|null, sessions: { id: string, title: string, createdAt: number, updatedAt: number, messages: object[] }[] }} */
let chatStore = { activeId: null, sessions: [] };
/** @type {{ media_type: string, data: string }[]} */
let pendingImages = [];
/** @type {Set<string>} */
const collapsedDirs = new Set();
/** @type {object[]} */
let lastTreeRoots = [];

function setOffline(msg) {
  const el = $('offline');
  if (msg) {
    el.textContent = msg;
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (res.status === 404) {
    setOffline('IDE отладки выключена. Локально: npm run dev:full. На сервере: DEV_IDE_ADMIN=1 в .env.');
    throw new Error('недоступно');
  }
  if (res.status === 403) {
    setOffline(
      'Нужен вход администратора: откройте /admin (ключ ADMIN_KEY или Google как admin), войдите, затем обновите эту страницу (F5).',
    );
    throw new Error('forbidden');
  }
  setOffline('');
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function defaultSystemMessage() {
  return {
    role: 'system',
    content:
      'Ассистент готов. IDE открывает файлы, читает логи/порты (ops:pm2-logs, ops:ports), гоняет тесты (ops:test-devIde). Спросите «покажи логи» или «проверь порты». Ctrl+Enter — отправить.',
  };
}

function isAutoOpsEnabled() {
  const el = $('autoOps');
  return el ? el.checked : true;
}

async function runOpsAction(action, params = {}) {
  return api(`${API_DEV}/run`, {
    method: 'POST',
    body: JSON.stringify({ action, params }),
  });
}

function formatOpsResultMarkdown(result) {
  const body = [result.stdout, result.stderr].filter(Boolean).join('\n--- stderr ---\n').trim() || '(пусто)';
  return `**ops:${result.action}** — ${result.label} (exit ${result.exitCode}, ${result.durationMs}ms)\n\`\`\`\n${body}\n\`\`\``;
}

function extractOpsDirectivesFromText(text) {
  const actions = [];
  const seen = new Set();
  for (const m of String(text || '').matchAll(/\bops:([a-z0-9-]+)(?::(\d+))?/gi)) {
    const action = m[1].toLowerCase();
    const key = `${action}:${m[2] || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push({ action, params: m[2] ? { lines: Number(m[2]) } : {} });
  }
  return actions;
}

function mapBashLineToOpsAction(line) {
  const s = String(line || '').trim().replace(/\s+/g, ' ');
  if (!s || s.startsWith('#')) return null;
  const rules = [
    [/^pm2\s+jlist$/i, 'pm2-list', {}],
    [/^pm2\s+list$/i, 'pm2-list', {}],
    [/^pm2\s+logs(?:\s+\S+)?(?:\s+--lines\s+(\d+))?/i, 'pm2-logs', (m) => (m[1] ? { lines: Number(m[1]) } : {})],
    [/^ss\s+-tlnp$/i, 'ports', {}],
    [/^netstat\s+-tlnp$/i, 'ports', {}],
    [/^node\s+--test\s+tests\/server\/devIde\.test\.mjs$/i, 'test-devIde', {}],
    [/^node\s+--test\s+tests\/env\/env\.test\.mjs$/i, 'test-env', {}],
    [/^node\s+--check\s+server\.mjs$/i, 'check-server', {}],
    [/^npm\s+run\s+test:compiler$/i, 'npm-test-compiler', {}],
    [/^npm\s+run\s+test:runtime$/i, 'npm-test-runtime', {}],
    [/^df\s+-h$/i, 'disk-free', {}],
  ];
  for (const [re, action, paramsFn] of rules) {
    const m = s.match(re);
    if (m) return { action, params: typeof paramsFn === 'function' ? paramsFn(m) : paramsFn };
  }
  return null;
}

function firstOpsFromBashCode(code) {
  for (const line of String(code || '').split('\n')) {
    const mapped = mapBashLineToOpsAction(line);
    if (mapped) return mapped;
  }
  return null;
}

async function autoRunOpsFromText(text) {
  if (!isAutoOpsEnabled()) return;
  const directives = extractOpsDirectivesFromText(text);
  if (!directives.length) return;

  const outputs = [];
  for (const d of directives.slice(0, 5)) {
    try {
      const result = await runOpsAction(d.action, d.params);
      outputs.push(formatOpsResultMarkdown(result));
    } catch (err) {
      outputs.push(`**ops:${d.action}** — ошибка: ${err.message}`);
    }
  }
  if (!outputs.length) return;

  chatHistory.push({
    role: 'assistant',
    content: `**Результат на сервере:**\n\n${outputs.join('\n\n')}`,
    opsResult: true,
  });
  renderChat();
  touchActiveSession();
}

async function executeOpsButton(btn) {
  const action = btn.dataset.opsAction;
  if (!action || btn.classList.contains('running')) return;
  const params = {};
  if (btn.dataset.opsLines) params.lines = Number(btn.dataset.opsLines);
  btn.classList.add('running');
  btn.textContent = '…';
  try {
    const result = await runOpsAction(action, params);
    chatHistory.push({
      role: 'assistant',
      content: formatOpsResultMarkdown(result),
      opsResult: true,
    });
    renderChat();
    touchActiveSession();
    btn.textContent = 'Готово';
    btn.classList.add('done');
  } catch (err) {
    btn.textContent = 'Ошибка';
    setSaveStatus(err.message, 'err');
  } finally {
    btn.classList.remove('running');
    setTimeout(() => {
      btn.textContent = 'Выполнить';
      btn.classList.remove('done');
    }, 2000);
  }
}

const OPEN_INTENT_RE = /(?:открой|открыть|найди|найти|покажи|показать|где\s+файл|where\s+is|open|find|grep)\b/i;
const SKIP_SYMBOL_RE = /^(function|const|let|var|import|export|return|async|await|undefined|null|true|false|if|else|for|while|class|interface|type|enum)$/i;

function scorePathMatchClient(filePath, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return 0;
  const p = String(filePath || '').toLowerCase();
  const base = p.split('/').pop() || p;
  if (p === q) return 100;
  if (p.endsWith(`/${q}`)) return 92;
  if (base === q) return 88;
  if (base.includes(q)) return 72;
  if (p.includes(q)) return 55;
  return 0;
}

function collectAllFiles(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.type === 'file') out.push(node.path);
    else if (node.type === 'dir') collectAllFiles(node.children, out);
  }
  return out;
}

function extractPathQueriesFromText(text) {
  const queries = [];
  const seen = new Set();
  const add = (raw) => {
    let q = String(raw || '').trim().replace(/^['"`]+|['"`]+$/g, '');
    q = q.replace(/[.,;:!?]+$/g, '').trim();
    if (!q || q.length < 2 || seen.has(q)) return;
    seen.add(q);
    queries.push(q);
  };

  for (const m of String(text || '').matchAll(/```open:([^\n`]+)/gi)) add(m[1]);
  for (const m of String(text || '').matchAll(/\bopen:([^\s`'"]+)/gi)) add(m[1]);
  for (const m of String(text || '').matchAll(/`([^`\n]+\.[a-z0-9]{1,8})`/gi)) add(m[1]);
  for (const m of String(text || '').matchAll(
    /(?:^|\n)\s*[-*]\s+([^\n`]*?\.(?:jsx?|tsx?|mjs|cjs|py|json|md|html|css))\s*$/gim,
  )) add(m[1]);
  for (const m of String(text || '').matchAll(
    /(?:^|\s)((?:[\w.-]+\/)+[\w.-]+\.(?:jsx?|tsx?|mjs|cjs|py|json|md|html|css))/gm,
  )) add(m[1]);
  return queries;
}

function extractSymbolQueriesFromText(text) {
  const queries = [];
  const seen = new Set();
  const src = String(text || '');
  const add = (raw) => {
    const q = String(raw || '').trim();
    if (!q || q.length < 4 || seen.has(q) || SKIP_SYMBOL_RE.test(q)) return;
    seen.add(q);
    queries.push(q);
  };

  for (const m of src.matchAll(/`([A-Za-z_$][\w$]{4,})`/g)) add(m[1]);
  for (const m of src.matchAll(/\b([a-z][\w$]*[A-Z][\w$]*|[A-Z][a-z]+[A-Z][\w$]*)\b/g)) add(m[1]);
  const intent = OPEN_INTENT_RE.test(src);
  if (intent) {
    for (const m of src.matchAll(/\b([A-Za-z_$][\w$]{5,})\b/g)) {
      if (SKIP_SYMBOL_RE.test(m[1])) continue;
      add(m[1]);
    }
  }
  return queries;
}

function extractFileQueriesFromText(text, { symbols = false } = {}) {
  const paths = extractPathQueriesFromText(text);
  if (!symbols) return paths;
  const merged = [...paths];
  const seen = new Set(paths.map((q) => q.toLowerCase()));
  for (const sym of extractSymbolQueriesFromText(text)) {
    const key = sym.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(sym);
  }
  return merged;
}

function expandDirsForPath(filePath) {
  const parts = String(filePath || '').split('/');
  parts.pop();
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    collapsedDirs.delete(acc);
  }
}

async function resolveBestFile(query) {
  const q = String(query || '').trim();
  if (!q) return null;

  const local = collectAllFiles(lastTreeRoots)
    .map((filePath) => ({ path: filePath, score: scorePathMatchClient(filePath, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  if (local.length && local[0].score >= 85) return local[0].path;

  try {
    const data = await api(`${API_FILES}/search?q=${encodeURIComponent(q)}`);
    const hit = data?.matches?.[0];
    if (hit?.path) return hit.path;
  } catch {
    // search optional
  }

  return local[0]?.path || null;
}

async function autoOpenFromText(text, { force = false, symbols = false } = {}) {
  const hasIntent = OPEN_INTENT_RE.test(String(text || ''));
  const queries = extractFileQueriesFromText(text, { symbols: symbols || hasIntent });
  if (!queries.length) return [];

  const shouldRun = force || hasIntent;
  if (!shouldRun && queries.every((q) => !q.includes('/') && !/\.[a-z0-9]{1,8}$/i.test(q))) {
    return [];
  }

  const opened = [];
  const tried = new Set();

  for (const query of queries) {
    if (opened.length >= 3) break;
    const key = query.toLowerCase();
    if (tried.has(key)) continue;
    tried.add(key);

    const filePath = await resolveBestFile(query);
    if (!filePath) continue;

    expandDirsForPath(filePath);
    renderExplorer();
    await openFile(filePath, { auto: true });
    opened.push({ query, path: filePath });
  }

  if (opened.length) {
    const last = opened[opened.length - 1];
    setSaveStatus(`Открыт: ${last.path}`, 'ok');
  }

  return opened;
}

function newSessionId() {
  return `c${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getActiveSession() {
  return chatStore.sessions.find((s) => s.id === chatStore.activeId) || null;
}

function syncChatHistoryFromActive() {
  const s = getActiveSession();
  chatHistory = s ? s.messages : [];
}

function serializeMessagesForStorage(messages) {
  return (messages || []).map((m) => ({
    role: m.role,
    content: m.content,
    patches: m.patches,
  }));
}

function loadChatsFromStorage() {
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.sessions) || !data.sessions.length) return null;
    return data;
  } catch {
    return null;
  }
}

function persistChats() {
  try {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify({
      activeId: chatStore.activeId,
      sessions: chatStore.sessions.map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messages: serializeMessagesForStorage(s.messages),
      })),
    }));
  } catch (err) {
    console.warn('[debug-ide] не удалось сохранить историю чатов', err);
  }
}

function deriveChatTitle(messages) {
  const user = messages.find((m) => m.role === 'user' && String(m.content || '').trim());
  if (!user) return 'Новый чат';
  const raw = String(user.content).trim().replace(/\s+/g, ' ');
  return raw.length > 50 ? `${raw.slice(0, 50)}…` : raw;
}

function formatChatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function touchActiveSession() {
  const s = getActiveSession();
  if (!s) return;
  s.updatedAt = Date.now();
  s.title = deriveChatTitle(s.messages);
  persistChats();
  renderChatSessions();
}

function renderChatSessions() {
  const root = $('chatSessions');
  const countEl = $('chatCount');
  if (!root) return;
  const sorted = [...chatStore.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  if (countEl) countEl.textContent = sorted.length ? `(${sorted.length})` : '';
  if (!sorted.length) {
    root.innerHTML = '<p style="padding:8px;color:var(--muted);font-size:12px">Нет чатов</p>';
    return;
  }
  root.innerHTML = sorted.map((s) => `
    <div class="chat-session-item${s.id === chatStore.activeId ? ' active' : ''}" data-id="${esc(s.id)}">
      <span class="title">${esc(s.title || 'Чат')}</span>
      <span class="meta">${esc(formatChatTime(s.updatedAt))}</span>
      <button type="button" class="del" data-del="${esc(s.id)}" title="Удалить чат">×</button>
    </div>
  `).join('');
  root.querySelectorAll('.chat-session-item').forEach((el) => {
    el.addEventListener('click', () => switchChat(el.dataset.id));
  });
  root.querySelectorAll('button[data-del]').forEach((btn) => {
    btn.addEventListener('click', (e) => deleteChat(btn.dataset.del, e));
  });
}

function createNewChat(focusInput = true) {
  const session = {
    id: newSessionId(),
    title: 'Новый чат',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [defaultSystemMessage()],
  };
  chatStore.sessions.unshift(session);
  chatStore.activeId = session.id;
  while (chatStore.sessions.length > MAX_CHAT_SESSIONS) {
    chatStore.sessions.pop();
  }
  syncChatHistoryFromActive();
  pendingImages = [];
  renderAttachPreview();
  renderChat();
  renderChatSessions();
  persistChats();
  if (focusInput) $('chatInput')?.focus();
}

function switchChat(id) {
  if (!id || id === chatStore.activeId || sending) return;
  if (!chatStore.sessions.some((s) => s.id === id)) return;
  chatStore.activeId = id;
  syncChatHistoryFromActive();
  pendingImages = [];
  renderAttachPreview();
  renderChat();
  renderChatSessions();
  persistChats();
}

function deleteChat(id, e) {
  e?.stopPropagation();
  if (!confirm('Удалить этот чат из истории?')) return;
  const wasActive = chatStore.activeId === id;
  chatStore.sessions = chatStore.sessions.filter((s) => s.id !== id);
  if (!chatStore.sessions.length) {
    createNewChat(false);
    return;
  }
  if (wasActive) {
    chatStore.activeId = chatStore.sessions[0].id;
    syncChatHistoryFromActive();
    renderChat();
  }
  renderChatSessions();
  persistChats();
}

function initChats() {
  const stored = loadChatsFromStorage();
  if (stored?.sessions?.length) {
    chatStore = {
      activeId: stored.activeId || stored.sessions[0].id,
      sessions: stored.sessions.map((s) => ({
        id: s.id,
        title: s.title || 'Чат',
        createdAt: s.createdAt || Date.now(),
        updatedAt: s.updatedAt || Date.now(),
        messages: Array.isArray(s.messages) && s.messages.length
          ? s.messages
          : [defaultSystemMessage()],
      })),
    };
    if (!chatStore.sessions.some((s) => s.id === chatStore.activeId)) {
      chatStore.activeId = chatStore.sessions[0].id;
    }
    syncChatHistoryFromActive();
    renderChat();
    renderChatSessions();
    return;
  }
  createNewChat(false);
}

function setSaveStatus(text, kind = '') {
  const el = $('saveStatus');
  el.textContent = text;
  el.className = 'status' + (kind ? ` ${kind}` : '');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function renderTreeNode(node, depth = 0) {
  const indent = depth * 12;
  if (node.type === 'dir') {
    const collapsed = collapsedDirs.has(node.path);
    const childHtml = (node.children || []).map((c) => renderTreeNode(c, depth + 1)).join('');
    return `
      <div class="tree-item dir${collapsed ? ' collapsed' : ''}" style="--indent:${indent}px" data-path="${esc(node.path)}" data-type="dir" title="Свернуть / развернуть">
        <span class="icon">${collapsed ? '▸' : '▾'}</span><span>${esc(node.name)}</span>
      </div>
      <div class="tree-children${collapsed ? ' collapsed' : ''}" data-parent="${esc(node.path)}">${childHtml}</div>
    `;
  }
  return `
    <div class="tree-item file${openPath === node.path ? ' active' : ''}" style="--indent:${indent}px" data-path="${esc(node.path)}" data-type="file" title="Открыть для редактирования">
      <span class="icon">📄</span><span>${esc(node.name)}</span>
    </div>
  `;
}

function toggleDir(path) {
  const row = $('explorer').querySelector(`.tree-item.dir[data-path="${CSS.escape(path)}"]`);
  const block = $('explorer').querySelector(`.tree-children[data-parent="${CSS.escape(path)}"]`);
  if (!row || !block) return;
  const willCollapse = !collapsedDirs.has(path);
  if (willCollapse) collapsedDirs.add(path);
  else collapsedDirs.delete(path);
  row.classList.toggle('collapsed', willCollapse);
  block.classList.toggle('collapsed', willCollapse);
  const icon = row.querySelector('.icon');
  if (icon) icon.textContent = willCollapse ? '▸' : '▾';
  updateToggleTreeAllBtn();
}

function collectDirPaths(nodes, out = []) {
  for (const n of nodes || []) {
    if (n.type === 'dir') {
      out.push(n.path);
      collectDirPaths(n.children, out);
    }
  }
  return out;
}

function allDirPaths() {
  return collectDirPaths(lastTreeRoots);
}

function isTreeFullyCollapsed() {
  const dirs = allDirPaths();
  return dirs.length > 0 && dirs.every((p) => collapsedDirs.has(p));
}

function updateToggleTreeAllBtn() {
  const btn = $('toggleTreeAll');
  if (!btn) return;
  const collapsed = isTreeFullyCollapsed();
  btn.textContent = collapsed ? 'Раскрыть всё' : 'Свернуть всё';
  btn.title = collapsed ? 'Развернуть все папки' : 'Свернуть все папки';
}

function renderExplorer() {
  const html = lastTreeRoots.map((r) => renderTreeNode(r, 0)).join('');
  $('explorer').innerHTML = html || '<p style="padding:12px;color:#858585">Дерево пустое</p>';
  bindExplorer();
  updateToggleTreeAllBtn();
}

function expandAllDirs() {
  collapsedDirs.clear();
  renderExplorer();
}

function collapseAllDirs() {
  collapsedDirs.clear();
  for (const p of allDirPaths()) collapsedDirs.add(p);
  renderExplorer();
}

function toggleTreeAll() {
  if (isTreeFullyCollapsed()) expandAllDirs();
  else collapseAllDirs();
}

function bindExplorer() {
  $('explorer').querySelectorAll('.tree-item.dir').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDir(el.dataset.path);
    });
  });
  $('explorer').querySelectorAll('.tree-item.file').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openFile(el.dataset.path);
    });
  });
}

async function loadTree() {
  try {
    const data = await api(`${API_FILES}/tree`);
    lastTreeRoots = data.roots || [];
    renderExplorer();
    if (data.truncated) {
      setOffline('Дерево обрезано (слишком много файлов).');
    }
  } catch (err) {
    lastTreeRoots = [];
    $('explorer').innerHTML = `<p style="padding:12px;color:#f48771">${esc(err.message)}</p>`;
    updateToggleTreeAllBtn();
  }
}

function markActiveFileInTree() {
  document.querySelectorAll('.tree-item.file').forEach((el) => {
    el.classList.toggle('active', el.dataset.path === openPath);
  });
}

async function openFile(path, opts = {}) {
  if (!opts.auto && dirty && !confirm('Отменить несохранённые изменения?')) return;
  try {
    if (!opts.auto) setSaveStatus('Загрузка…');
    const data = await api(`${API_FILES}/read?path=${encodeURIComponent(path)}`);
    openPath = data.path;
    dirty = false;
    $('editor').value = data.content;
    $('editor').disabled = false;
    $('saveBtn').disabled = false;
    $('currentPath').textContent = openPath;
    if (!opts.auto) setSaveStatus('');
    markActiveFileInTree();
    if (!opts.auto) $('editor').focus();
    const row = $('explorer').querySelector(`.tree-item.file[data-path="${CSS.escape(openPath)}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  } catch (err) {
    setSaveStatus(err.message, 'err');
  }
}

async function saveFile() {
  if (!openPath) return;
  $('saveBtn').disabled = true;
  setSaveStatus('Сохранение…');
  try {
    await api(`${API_FILES}/write`, {
      method: 'POST',
      body: JSON.stringify({ path: openPath, content: $('editor').value }),
    });
    dirty = false;
    setSaveStatus('Сохранено', 'ok');
  } catch (err) {
    setSaveStatus(err.message, 'err');
  } finally {
    $('saveBtn').disabled = false;
  }
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxSide = 1600;
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        if (width >= height) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        } else {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const b64 = dataUrl.split(',')[1] || '';
      if (b64.length * 0.75 > MAX_IMAGE_BYTES) {
        reject(new Error('Изображение слишком большое после сжатия'));
        return;
      }
      resolve({ media_type: 'image/jpeg', data: b64 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = url;
  });
}

async function addImageFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    if (pendingImages.length >= MAX_IMAGES) {
      alert(`Максимум ${MAX_IMAGES} изображения за сообщение`);
      break;
    }
    try {
      const img = await resizeImage(file);
      pendingImages.push(img);
    } catch (err) {
      alert(err.message || 'Ошибка изображения');
    }
  }
  renderAttachPreview();
}

function renderAttachPreview() {
  const root = $('attachPreview');
  if (!pendingImages.length) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = pendingImages.map((img, i) => `
    <div class="attach-item">
      <img src="data:${img.media_type};base64,${img.data}" alt="скрин ${i + 1}" />
      <button type="button" data-idx="${i}" title="Удалить">×</button>
    </div>
  `).join('');
  root.querySelectorAll('button[data-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingImages.splice(Number(btn.dataset.idx), 1);
      renderAttachPreview();
    });
  });
}

function imagesToHtml(images) {
  if (!images?.length) return '';
  return `<div class="msg-images">${images.map((img) =>
    `<img src="data:${esc(img.media_type)};base64,${img.data}" alt="скриншот" />`
  ).join('')}</div>`;
}

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'powershell', 'ps1', 'cmd']);

function codeBlockLabel(lang, file) {
  if (file) return file.trim();
  if (SHELL_LANGS.has(lang)) return 'Команда';
  if (lang === 'patch' || lang === 'diff') return 'Патч';
  if (lang) return lang;
  return 'Код';
}

function parseMarkdownLite(text) {
  let html = esc(text);
  html = html.replace(/```([\w-]+)?(?::([^\n`]+))?\r?\n?([\s\S]*?)```/gi, (_m, langRaw, fileRaw, codeRaw) => {
    const lang = (langRaw || '').toLowerCase();
    const file = (fileRaw || '').trim();
    const code = codeRaw.trim();
    const label = esc(codeBlockLabel(lang, file));
    const patchPath = file || (lang === 'patch' || lang === 'diff' ? '' : '');
    const patchAttr = patchPath ? ` data-patch-path="${esc(patchPath)}"` : '';
    const bashOps = SHELL_LANGS.has(lang) ? firstOpsFromBashCode(code) : null;
    const runBtn = bashOps
      ? `<button type="button" class="code-run-btn" data-ops-action="${esc(bashOps.action)}"${
        bashOps.params?.lines ? ` data-ops-lines="${esc(String(bashOps.params.lines))}"` : ''
      }>Выполнить</button>`
      : '';
    return (
      `<div class="code-block"${patchAttr}>` +
      `<div class="code-block-head"><span class="code-block-label">${label}</span>` +
      `<div class="code-block-actions"><button type="button" class="code-copy-btn">Копировать</button>${runBtn}</div></div>` +
      `<pre class="code-block-body"><code>${esc(code)}</code></pre></div>`
    );
  });
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function extractPatchesFromReply(reply) {
  const patches = [];
  const re = /```(?:patch|diff)?(?::([^\n`]+))?\r?\n?([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(reply))) {
    const p = (m[1] || '').trim();
    if (!p) continue;
    patches.push({ path: p, content: m[2].trim() });
  }
  return patches;
}

function applyPatch(patch) {
  const applyToEditor = () => {
    $('editor').value = patch.content;
    dirty = true;
    $('editor').disabled = false;
    $('saveBtn').disabled = false;
    setSaveStatus('Патч в редакторе — нажмите «Сохранить»', 'ok');
  };
  if (openPath === patch.path) {
    applyToEditor();
    return;
  }
  if (!confirm(`Применить патч к ${patch.path}?`)) return;
  openFile(patch.path).then(applyToEditor).catch(() => {
    openPath = patch.path;
    $('currentPath').textContent = patch.path;
    applyToEditor();
  });
}

function renderChat() {
  const root = $('chatMessages');
  root.innerHTML = chatHistory.map((m, msgIdx) => {
    if (m.role === 'system') {
      return `<div class="msg system">${esc(m.content)}</div>`;
    }
    let body = '';
    if (m.role === 'user') {
      body = esc(m.content || '');
      if (m.images?.length) body += imagesToHtml(m.images);
    } else if (m.role === 'assistant') {
      body = parseMarkdownLite(m.content);
    }
    let patchHtml = '';
    if (m.role === 'assistant' && m.patches?.length) {
      patchHtml = '<div class="patch-bar">' + m.patches.map((p, i) =>
        `<button type="button" data-msg-idx="${msgIdx}" data-patch-idx="${i}">Применить: ${esc(p.path)}</button>`
      ).join('') + '</div>';
    }
    const opsCls = m.opsResult ? ' ops-result' : '';
    return `<div class="msg ${m.role}${opsCls}">${body}${patchHtml}</div>`;
  }).join('');
  root.scrollTop = root.scrollHeight;

  root.querySelectorAll('[data-patch-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const msg = chatHistory[Number(btn.dataset.msgIdx)];
      const patch = msg?.patches?.[Number(btn.dataset.patchIdx)];
      if (patch) applyPatch(patch);
    });
  });

  root.querySelectorAll('.code-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.closest('.code-block')?.querySelector('.code-block-body code');
      const text = code?.textContent || '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Скопировано';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Копировать';
          btn.classList.remove('copied');
        }, 1600);
      } catch {
        btn.textContent = 'Ошибка';
        setTimeout(() => { btn.textContent = 'Копировать'; }, 1600);
      }
    });
  });

  root.querySelectorAll('.code-run-btn').forEach((btn) => {
    btn.addEventListener('click', () => executeOpsButton(btn));
  });
}

function buildOutboundMessages() {
  return chatHistory
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      if (m.role === 'user' && m.images?.length) {
        return { role: 'user', content: m.content || '', images: m.images };
      }
      return { role: m.role, content: m.content };
    });
}

async function sendChat() {
  const text = $('chatInput').value.trim();
  if ((!text && !pendingImages.length) || sending) return;
  const userText = text;
  $('chatInput').value = '';

  const images = pendingImages.splice(0);
  renderAttachPreview();

  const userMsg = {
    role: 'user',
    content: userText || (images.length ? '(скриншот)' : ''),
    ...(images.length ? { images } : {}),
  };
  chatHistory.push(userMsg);
  renderChat();

  await autoOpenFromText(userText, { force: OPEN_INTENT_RE.test(userText) });

  const body = { messages: buildOutboundMessages() };
  if ($('includeProject')?.checked) {
    body.includeProjectTree = true;
    body.includeManifest = true;
  }
  if ($('includeFile').checked && openPath) {
    body.filePath = openPath;
    body.fileContent = $('editor').value;
  }

  sending = true;
  $('sendChat').disabled = true;
  chatHistory.push({ role: 'assistant', content: '…' });
  renderChat();

  try {
    const data = await api(API_CHAT, { method: 'POST', body: JSON.stringify(body) });
    chatHistory.pop();
    const reply = data.reply || '';
    const patches = extractPatchesFromReply(reply);
    chatHistory.push({ role: 'assistant', content: reply, patches });
    await autoOpenFromText(reply, { force: true, symbols: false });
    await autoRunOpsFromText(reply);
  } catch (err) {
    chatHistory.pop();
    chatHistory.push({ role: 'assistant', content: `Ошибка: ${err.message}` });
  } finally {
    sending = false;
    $('sendChat').disabled = false;
    renderChat();
    touchActiveSession();
  }
}

$('editor').addEventListener('input', () => {
  dirty = true;
  setSaveStatus('Изменён');
});
$('saveBtn').addEventListener('click', saveFile);
$('refreshTree').addEventListener('click', loadTree);
$('toggleTreeAll').addEventListener('click', toggleTreeAll);
$('newChat').addEventListener('click', () => createNewChat(true));
$('sendChat').addEventListener('click', sendChat);
$('pickImage').addEventListener('click', () => $('imageInput').click());
$('imageInput').addEventListener('change', (e) => {
  addImageFiles(e.target.files);
  e.target.value = '';
});
$('clearChat').addEventListener('click', () => {
  const s = getActiveSession();
  if (!s) return;
  s.messages.length = 0;
  s.messages.push(defaultSystemMessage());
  syncChatHistoryFromActive();
  renderChat();
  touchActiveSession();
});
$('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    sendChat();
  }
});
$('chatInput').addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  const files = [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  if (files.length) {
    e.preventDefault();
    addImageFiles(files);
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
});

const autoOpsEl = $('autoOps');
if (autoOpsEl) {
  const savedAutoOps = localStorage.getItem(AUTO_OPS_KEY);
  if (savedAutoOps === '0') autoOpsEl.checked = false;
  autoOpsEl.addEventListener('change', () => {
    localStorage.setItem(AUTO_OPS_KEY, autoOpsEl.checked ? '1' : '0');
  });
}

initChats();
loadTree();
