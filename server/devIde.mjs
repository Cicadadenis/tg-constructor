import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import { isDevIdeEnabled, readEnv } from '../core/env.mjs';
import { atomicWriteFile, readFileUtf8 } from '../services/secureFs.mjs';
import { sendHtmlWithCspNonce } from '../services/sendHtmlWithCspNonce.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEBUG_HTML = path.resolve(PROJECT_ROOT, 'public/debug.html');
const DEBUG_JS = path.resolve(PROJECT_ROOT, 'public/debug-ide-app.js');

export const DEV_IDE_FILE_API = '/api/files';
export const DEV_IDE_CHAT_API = '/api/ai/chat';

const BLOCKED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.svn',
  'dist',
  'coverage',
  '.cache',
  '__pycache__',
  '.cursor',
  '.dev-backups',
]);
const BLOCKED_FILE_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
]);
const BLOCKED_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx']);
const MAX_TREE_DEPTH = 10;
const MAX_TREE_ENTRIES = 2500;
const MAX_READ_BYTES = 512 * 1024;
const MAX_WRITE_BYTES = 512 * 1024;
const MAX_CHAT_CONTEXT_CHARS = 48_000;
const MAX_TREE_CONTEXT_CHARS = 14_000;
const CHAT_MANIFEST_FILES = ['package.json', 'server.mjs', 'vite.config.js', 'tsconfig.json'];

const ideJson = express.json({ limit: '600kb', strict: false });
const ideChatJson = express.json({ limit: '12mb', strict: false });

function trimEnv(value) {
  return String(value ?? '').trim();
}

function devIdeMiddleware(_req, res, next) {
  if (!isDevIdeEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
}

export function isDevIdeApiPath(pathname) {
  const p = String(pathname ?? '');
  const q = p.indexOf('?');
  const base = q >= 0 ? p.slice(0, q) : p;
  if (base === DEV_IDE_CHAT_API || base.startsWith(`${DEV_IDE_CHAT_API}/`)) return true;
  if (base === DEV_IDE_FILE_API || base.startsWith(`${DEV_IDE_FILE_API}/`)) return true;
  return false;
}

function isPathValidationError(err) {
  const m = String(err?.message ?? '');
  return /invalid|not allowed|outside|blocked|env files/i.test(m);
}

function normalizeRelPath(raw) {
  const text = String(raw ?? '').trim().replace(/\\/g, '/');
  if (!text || text.startsWith('/') || text.includes('\0')) {
    throw new Error('invalid path');
  }
  const parts = text.split('/').filter(Boolean);
  if (!parts.length) throw new Error('invalid path');
  for (const part of parts) {
    if (part === '.' || part === '..') throw new Error('invalid path segment');
    if (BLOCKED_DIR_NAMES.has(part)) throw new Error('path not allowed');
    if (part.startsWith('.') && part !== '.gitkeep') throw new Error('hidden paths blocked');
  }
  const baseName = parts[parts.length - 1];
  if (BLOCKED_FILE_NAMES.has(baseName)) throw new Error('file not allowed');
  const ext = path.extname(baseName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) throw new Error('file type not allowed');
  if (baseName.toLowerCase().includes('.env')) throw new Error('env files blocked');
  return parts.join('/');
}

function resolveIdeAbsolute(relPath) {
  const normalized = normalizeRelPath(relPath);
  const abs = path.resolve(PROJECT_ROOT, normalized);
  const rel = path.relative(PROJECT_ROOT, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('path outside project');
  }
  return { normalized, abs };
}

function isAllowedDirectoryEntry(name) {
  if (!name || name === '.' || name === '..') return false;
  if (name.startsWith('.') && name !== '.gitkeep') return false;
  if (BLOCKED_DIR_NAMES.has(name)) return false;
  if (BLOCKED_FILE_NAMES.has(name)) return false;
  if (name.toLowerCase().includes('.env')) return false;
  const ext = path.extname(name).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) return false;
  return true;
}

let treeCounter = 0;

async function readDirectoryNode(absDir, relDir, depth) {
  if (depth > MAX_TREE_DEPTH || treeCounter >= MAX_TREE_ENTRIES) return null;
  const entries = await fsp.readdir(absDir, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const children = [];
  for (const ent of entries) {
    if (treeCounter >= MAX_TREE_ENTRIES) break;
    if (!isAllowedDirectoryEntry(ent.name)) continue;

    const relPath = relDir ? `${relDir}/${ent.name}` : ent.name;
    try {
      normalizeRelPath(relPath);
    } catch {
      continue;
    }

    if (ent.isDirectory()) {
      treeCounter += 1;
      const sub = await readDirectoryNode(path.join(absDir, ent.name), relPath, depth + 1);
      children.push({
        name: ent.name,
        path: relPath,
        type: 'dir',
        children: sub?.children || [],
      });
    } else if (ent.isFile()) {
      treeCounter += 1;
      children.push({
        name: ent.name,
        path: relPath,
        type: 'file',
      });
    }
  }

  return { children };
}

async function buildFileTree() {
  treeCounter = 0;
  const roots = [];
  let entries = [];
  try {
    entries = await fsp.readdir(PROJECT_ROOT, { withFileTypes: true });
  } catch {
    return { roots, truncated: false };
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const ent of entries) {
    if (treeCounter >= MAX_TREE_ENTRIES) break;
    if (!isAllowedDirectoryEntry(ent.name)) continue;
    const rel = ent.name;
    try {
      normalizeRelPath(rel);
    } catch {
      continue;
    }
    if (ent.isDirectory()) {
      treeCounter += 1;
      const sub = await readDirectoryNode(path.join(PROJECT_ROOT, ent.name), rel, 1);
      roots.push({
        name: rel,
        path: rel,
        type: 'dir',
        children: sub?.children || [],
      });
    } else if (ent.isFile()) {
      treeCounter += 1;
      roots.push({ name: rel, path: rel, type: 'file' });
    }
  }
  return { roots, truncated: treeCounter >= MAX_TREE_ENTRIES };
}

function stripImageBase64(data) {
  const s = String(data ?? '').trim();
  const m = s.match(/^data:image\/[a-z0-9+.-]+;base64,(.+)$/i);
  return (m ? m[1] : s).slice(0, 2_400_000);
}

function normalizeUserBlocks(message) {
  const text = String(message?.content ?? '').trim().slice(0, 16_000);
  const images = Array.isArray(message?.images) ? message.images.slice(0, 4) : [];
  const blocks = [];
  for (const img of images) {
    const media = String(img?.media_type || 'image/jpeg').toLowerCase();
    if (!/^image\/(jpe?g|png|gif|webp)$/.test(media)) continue;
    const data = stripImageBase64(img?.data);
    if (!data) continue;
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: media, data },
    });
  }
  if (text) blocks.push({ type: 'text', text });
  if (!blocks.length) blocks.push({ type: 'text', text: '(скриншот)' });
  return blocks;
}

function openAiMessagesToAnthropic(messages) {
  const systemParts = [];
  const tail = [];
  for (const m of messages) {
    const role = m?.role;
    if (role === 'system') {
      systemParts.push(typeof m.content === 'string' ? m.content : String(m.content ?? ''));
      continue;
    }
    if (role === 'assistant') {
      tail.push({ role: 'assistant', content: String(m.content ?? '').slice(0, 16_000) });
      continue;
    }
    if (role === 'user') {
      if (Array.isArray(m.images) && m.images.length) {
        tail.push({ role: 'user', content: normalizeUserBlocks(m) });
      } else {
        tail.push({ role: 'user', content: String(m.content ?? '').slice(0, 16_000) });
      }
    }
  }
  const merged = [];
  for (const m of tail) {
    const last = merged[merged.length - 1];
    const canMerge = last
      && last.role === m.role
      && typeof last.content === 'string'
      && typeof m.content === 'string';
    if (canMerge) last.content = `${last.content}\n\n${m.content}`;
    else merged.push(m);
  }
  return {
    system: systemParts.length ? systemParts.join('\n\n') : undefined,
    messages: merged,
  };
}

function anthropicToText(data) {
  const blocks = data?.content;
  let text = '';
  if (Array.isArray(blocks)) {
    for (const b of blocks) {
      if (b?.type === 'text' && typeof b.text === 'string') text += b.text;
    }
  }
  return text;
}

async function callDevIdeAnthropic(messages, options = {}) {
  const apiKey = trimEnv(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) {
    const e = new Error('ANTHROPIC_API_KEY is not set in .env');
    e.httpStatus = 401;
    throw e;
  }
  let base = trimEnv(process.env.ANTHROPIC_BASE_URL) || 'https://api.anthropic.com/v1';
  base = base.replace(/\/+$/, '');
  const model = trimEnv(process.env.ANTHROPIC_MODEL) || 'claude-sonnet-4-6';
  const url = `${base}/messages`;
  const payload = openAiMessagesToAnthropic(messages);
  if (!payload.messages.length) throw new Error('Empty conversation');

  const body = {
    model,
    max_tokens: Number(options.max_tokens) > 0 ? Number(options.max_tokens) : 4096,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.2,
    messages: payload.messages,
  };
  if (payload.system) body.system = payload.system;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  const bodyText = await res.text();
  if (!res.ok) {
    let msg = `Anthropic HTTP ${res.status}`;
    try {
      const j = JSON.parse(bodyText);
      msg = j?.error?.message || j?.message || msg;
    } catch {
      if (bodyText) msg = bodyText.slice(0, 400);
    }
    const e = new Error(msg);
    e.httpStatus = res.status;
    throw e;
  }

  const data = JSON.parse(bodyText);
  return anthropicToText(data);
}

const devIdeAiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.DEV_IDE_AI_RATE_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'AI chat rate limit exceeded' });
  },
});

const devIdeWriteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.DEV_IDE_WRITE_RATE_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'File write rate limit exceeded' });
  },
});

const DEV_IDE_SYSTEM = `Ты — ассистент Cicada AI Debug IDE (только режим разработки).
Помогай разбирать, объяснять и исправлять код конструктора Telegram-ботов.
Правила:
- Отвечай по-русски, кратко и по делу.
- В контексте ниже могут быть дерево проекта, package.json и открытый файл — используй их.
- Не проси пользователя «прислать» или «вставить» файлы вручную, если структура уже в контексте.
- Для детального разбора конкретного модуля попроси открыть файл в проводнике (любой путь в репозитории, кроме node_modules и .env).
- Если приложены скриншоты — опиши, что видишь, и предложи исправления.
- Не утверждай, что файлы уже сохранены на диске.
- Правки кода — только в блоках с путём, например:
\`\`\`patch:src/example.js
// полный файл или diff
\`\`\`
- Команды терминала (npm, node, git и т.д.) — только в отдельных блоках, одна команда на строку:
\`\`\`bash
npm run dev:full
\`\`\`
- Не пиши команды просто текстом в абзаце — всегда в \`\`\`bash.
- Минимальные безопасные изменения.
- Не предлагай правки в .env, node_modules, .dev-backups.`;

async function readProjectFileForContext(relPath) {
  const { normalized, abs } = resolveIdeAbsolute(relPath);
  const st = await fsp.stat(abs);
  if (!st.isFile()) throw new Error('not a file');
  if (st.size > MAX_READ_BYTES) throw new Error('file too large');
  return { normalized, content: await readFileUtf8(abs, MAX_READ_BYTES) };
}

function formatTreeLines(nodes, depth = 0) {
  const lines = [];
  for (const node of nodes || []) {
    if (treeCounter > MAX_TREE_ENTRIES) break;
    const indent = '  '.repeat(depth);
    if (node.type === 'dir') {
      lines.push(`${indent}${node.name}/`);
      lines.push(...formatTreeLines(node.children, depth + 1));
    } else {
      lines.push(`${indent}${node.path}`);
    }
  }
  return lines;
}

async function buildProjectContextBlock({ includeProjectTree = false, includeManifest = false } = {}) {
  const parts = [];
  if (includeProjectTree) {
    treeCounter = 0;
    const tree = await buildFileTree();
    const lines = formatTreeLines(tree.roots);
    let text = lines.join('\n');
    if (text.length > MAX_TREE_CONTEXT_CHARS) {
      text = `${text.slice(0, MAX_TREE_CONTEXT_CHARS)}\n… (обрезано)`;
    }
    parts.push(
      `Дерево файлов проекта (весь репозиторий, кроме node_modules/.env — откройте файл в IDE для полного кода):\n\`\`\`\n${text || '(пусто)'}\n\`\`\``,
    );
    if (tree.truncated) parts.push('Примечание: полное дерево обрезано по лимиту записей.');
  }
  if (includeManifest) {
    for (const rel of CHAT_MANIFEST_FILES) {
      try {
        const { normalized, content } = await readProjectFileForContext(rel);
        const lang = rel.endsWith('.json') ? 'json' : 'text';
        parts.push(`${normalized}:\n\`\`\`${lang}\n${content.slice(0, 10_000)}\n\`\`\``);
      } catch {
        // skip missing or blocked
      }
    }
  }
  return parts.length ? `\n\n---\nКонтекст проекта\n\n${parts.join('\n\n')}` : '';
}

async function treeHandler(_req, res) {
  try {
    const tree = await buildFileTree();
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'tree failed' });
  }
}

async function readHandler(req, res) {
  try {
    const rel = req.query.path;
    const { normalized, abs } = resolveIdeAbsolute(rel);
    const st = await fsp.lstat(abs);
    if (!st.isFile()) {
      res.status(400).json({ error: 'not a file' });
      return;
    }
    if (st.size > MAX_READ_BYTES) {
      res.status(413).json({ error: `file too large (max ${MAX_READ_BYTES} bytes)` });
      return;
    }
    const content = await readFileUtf8(abs, MAX_READ_BYTES);
    res.json({ path: normalized, content, size: st.size });
  } catch (err) {
    const code = isPathValidationError(err) ? 400 : 500;
    res.status(code).json({ error: err instanceof Error ? err.message : 'read failed' });
  }
}

async function writeHandler(req, res) {
  try {
    const rel = req.body?.path;
    const content = typeof req.body?.content === 'string' ? req.body.content : null;
    if (content == null) {
      res.status(400).json({ error: 'content required' });
      return;
    }
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_WRITE_BYTES) {
      res.status(413).json({ error: `content too large (max ${MAX_WRITE_BYTES} bytes)` });
      return;
    }
    const { normalized, abs } = resolveIdeAbsolute(rel);
    const parent = path.dirname(abs);
    await fsp.mkdir(parent, { recursive: true });
    await atomicWriteFile(abs, content, 'utf8');
    res.json({ ok: true, path: normalized, size: bytes });
  } catch (err) {
    const code = isPathValidationError(err) ? 400 : 500;
    res.status(code).json({ error: err instanceof Error ? err.message : 'write failed' });
  }
}

async function chatHandler(req, res) {
  try {
    const {
      messages,
      filePath,
      fileContent,
      includeProjectTree = false,
      includeManifest = false,
    } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ error: 'messages array required' });
      return;
    }

    const convo = messages
      .slice(-24)
      .map((m) => {
        const role = m?.role === 'assistant' ? 'assistant' : m?.role === 'system' ? 'system' : 'user';
        if (role === 'user' && Array.isArray(m?.images) && m.images.length) {
          return {
            role,
            content: String(m?.content ?? '').slice(0, 16_000),
            images: m.images.slice(0, 4),
          };
        }
        return { role, content: String(m?.content ?? '').slice(0, 16_000) };
      })
      .filter((m) => {
        if (m.role === 'assistant') return Boolean(m.content?.trim());
        if (m.images?.length) return true;
        return Boolean(m.content?.trim());
      });

    const contextParts = [];
    if (includeProjectTree || includeManifest) {
      contextParts.push(await buildProjectContextBlock({ includeProjectTree, includeManifest }));
    }
    if (filePath && fileContent) {
      try {
        const { normalized } = resolveIdeAbsolute(filePath);
        const clipped = String(fileContent).slice(0, MAX_CHAT_CONTEXT_CHARS);
        contextParts.push(`\n\n---\nОткрытый файл: ${normalized}\n\`\`\`\n${clipped}\n\`\`\``);
      } catch {
        // ignore invalid path in context
      }
    }
    const contextBlock = contextParts.join('');

    const apiMessages = [
      { role: 'system', content: DEV_IDE_SYSTEM + contextBlock },
      ...convo.filter((m) => m.role !== 'system'),
    ];

    const reply = await callDevIdeAnthropic(apiMessages, { max_tokens: 4096 });
    res.json({
      reply,
      model: trimEnv(process.env.ANTHROPIC_MODEL) || 'claude-sonnet-4-6',
      provider: 'anthropic',
    });
  } catch (err) {
    const status = err?.httpStatus || 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'chat failed' });
  }
}

export function registerDevIdeRoutes(app) {
  const guard = [devIdeMiddleware];
  app.get(`${DEV_IDE_FILE_API}/tree`, guard, treeHandler);
  app.get(`${DEV_IDE_FILE_API}/read`, guard, readHandler);
  app.post(`${DEV_IDE_FILE_API}/write`, ideJson, guard, devIdeWriteRateLimit, writeHandler);
  app.post(DEV_IDE_CHAT_API, ideChatJson, guard, devIdeAiRateLimit, chatHandler);
}

function serveDebugIdePage(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  if (!isDevIdeEnabled()) {
    res.status(404).send('Not found');
    return;
  }
  sendHtmlWithCspNonce(res, DEBUG_HTML);
}

export function registerDevIdePage(app) {
  app.get('/debug-ide-app.js', (req, res) => {
    if (!isDevIdeEnabled()) {
      res.status(404).end();
      return;
    }
    res.sendFile(DEBUG_JS, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });
  app.get(/^\/debug(?:\.html)?\/?$/, serveDebugIdePage);
}

export function logDevIdeStartupBanner() {
  if (!isDevIdeEnabled()) return;
  const port = readEnv('API_PORT') || '3001';
  console.warn(`[dev-ide] AI Debug IDE → http://127.0.0.1:${port}/debug.html`);
}
