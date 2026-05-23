const API_FILES = '/api/files';
const API_CHAT = '/api/ai/chat';
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
    setOffline('Нужен вход администратора. Откройте /admin, войдите, затем обновите эту страницу.');
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
    content: 'Ассистент готов. Включите «Дерево проекта» для обзора всего кода, откройте файл слева или прикрепите скриншот (Ctrl+Enter — отправить).',
  };
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

async function openFile(path) {
  if (dirty && !confirm('Отменить несохранённые изменения?')) return;
  try {
    setSaveStatus('Загрузка…');
    const data = await api(`${API_FILES}/read?path=${encodeURIComponent(path)}`);
    openPath = data.path;
    dirty = false;
    $('editor').value = data.content;
    $('editor').disabled = false;
    $('saveBtn').disabled = false;
    $('currentPath').textContent = openPath;
    setSaveStatus('');
    markActiveFileInTree();
    $('editor').focus();
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
    return (
      `<div class="code-block"${patchAttr}>` +
      `<div class="code-block-head"><span class="code-block-label">${label}</span>` +
      `<button type="button" class="code-copy-btn">Копировать</button></div>` +
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
    return `<div class="msg ${m.role}">${body}${patchHtml}</div>`;
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
  $('chatInput').value = '';

  const images = pendingImages.splice(0);
  renderAttachPreview();

  const userMsg = {
    role: 'user',
    content: text || (images.length ? '(скриншот)' : ''),
    ...(images.length ? { images } : {}),
  };
  chatHistory.push(userMsg);
  renderChat();

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

initChats();
loadTree();
