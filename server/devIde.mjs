import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import { isDevIdeEnabled, readEnv } from '../core/env.mjs';
import { atomicWriteFile, readFileUtf8 } from '../services/secureFs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEBUG_HTML = path.resolve(PROJECT_ROOT, 'public/debug.html');

export const DEV_IDE_FILE_API = '/api/files';
export const DEV_IDE_CHAT_API = '/api/ai/chat';

const ALLOWED_ROOTS = ['src', 'server', 'public'];
const BLOCKED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.svn',
  'dist',
  'coverage',
  '.cache',
  '__pycache__',
  '.cursor',
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

const ideJson = express.json({ limit: '600kb', strict: false });

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
  const root = parts[0];
  if (!ALLOWED_ROOTS.includes(root)) throw new Error('path outside allowed roots');
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
  for (const rootName of ALLOWED_ROOTS) {
    const abs = path.join(PROJECT_ROOT, rootName);
    try {
      const st = await fsp.stat(abs);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    const node = await readDirectoryNode(abs, rootName, 1);
    roots.push({
      name: rootName,
      path: rootName,
      type: 'dir',
      children: node?.children || [],
    });
  }
  return { roots, truncated: treeCounter >= MAX_TREE_ENTRIES };
}

function openAiMessagesToAnthropic(messages) {
  const systemParts = [];
  const tail = [];
  for (const m of messages) {
    const role = m.role;
    const content = typeof m.content === 'string' ? m.content : String(m.content ?? '');
    if (role === 'system') systemParts.push(content);
    else if (role === 'user' || role === 'assistant') tail.push({ role, content });
  }
  const merged = [];
  for (const m of tail) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`;
    else merged.push({ role: m.role, content: m.content });
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

const DEV_IDE_SYSTEM = `You are the Cicada AI Debug IDE assistant (development only).
Help the developer analyze, explain, and fix code in this Telegram bot constructor project.
Rules:
- Be concise and technical.
- When suggesting code changes, NEVER claim you saved files.
- Propose patches in fenced blocks with a path label on the first line, e.g.:
\`\`\`patch:src/example.js
// full file or unified diff
\`\`\`
- Prefer minimal, safe fixes.
- No shell commands, no network calls, no instructions to edit files outside src/, server/, or public/.
- If context is missing, ask clarifying questions.`;

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
    const { messages, filePath, fileContent } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ error: 'messages array required' });
      return;
    }

    const convo = messages
      .slice(-24)
      .map((m) => ({
        role: m?.role === 'assistant' ? 'assistant' : m?.role === 'system' ? 'system' : 'user',
        content: String(m?.content ?? '').slice(0, 16_000),
      }))
      .filter((m) => m.content.trim());

    let contextBlock = '';
    if (filePath && fileContent) {
      try {
        const { normalized } = resolveIdeAbsolute(filePath);
        const clipped = String(fileContent).slice(0, MAX_CHAT_CONTEXT_CHARS);
        contextBlock = `\n\n---\nOpen file: ${normalized}\n\`\`\`\n${clipped}\n\`\`\``;
      } catch {
        // ignore invalid path in context
      }
    }

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
  app.post(DEV_IDE_CHAT_API, ideJson, guard, devIdeAiRateLimit, chatHandler);
}

export function registerDevIdePage(app) {
  app.get(/^\/debug\.html$/, (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    if (!isDevIdeEnabled()) {
      res.status(404).send('Not found');
      return;
    }
    res.sendFile(DEBUG_HTML, (err) => {
      if (err && !res.headersSent) res.status(404).send('Not found');
    });
  });
}

export function logDevIdeStartupBanner() {
  if (!isDevIdeEnabled()) return;
  const port = readEnv('API_PORT') || '3001';
  console.warn(`[dev-ide] AI Debug IDE → http://127.0.0.1:${port}/debug.html`);
}
