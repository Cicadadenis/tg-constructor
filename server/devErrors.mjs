import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDevLoggingEnabled } from '../core/env.mjs';
import { logApi, logBackend, logFrontend } from './devLog.mjs';

export const DEV_ERRORS_PATH = '/api/dev/errors';
export const DEV_ERRORS_PAGE = '/dev/errors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_HTML = path.resolve(__dirname, '../public/dev/errors.html');

const MAX_STORED = 200;
/** @type {import('./devErrors.mjs').DevErrorRecord[]} */
const store = [];
let nextId = 1;
let ingestDepth = 0;

const devErrorsJson = express.json({
  limit: '64kb',
  strict: false,
});

/** @typedef {'frontend'|'api'|'backend'} DevErrorSource */

function compactText(value, max = 8000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
    .slice(0, max);
}

function normalizeSource(raw) {
  const type = String(raw ?? 'frontend').toLowerCase();
  if (type === 'api') return 'api';
  if (type === 'backend') return 'backend';
  return 'frontend';
}

export function isDevErrorsApiPath(pathname) {
  const p = String(pathname ?? '');
  const q = p.indexOf('?');
  const base = q >= 0 ? p.slice(0, q) : p;
  return base === DEV_ERRORS_PATH || base.endsWith(DEV_ERRORS_PATH);
}

function mirrorToTerminal(record) {
  if (!isDevLoggingEnabled()) return;
  if (record.source === 'api') {
    logApi(record.method, record.url || record.path, record.status, record.message);
    return;
  }
  if (record.source === 'backend') {
    logBackend(record.stack ? `${record.message}\n${record.stack}` : record.message);
    return;
  }
  const text = record.stack ? `${record.message}\n${record.stack}` : record.message;
  logFrontend(text);
}

/**
 * @param {object} input
 * @param {{ skipTerminal?: boolean }} [opts]
 */
export function ingestDevError(input, opts = {}) {
  if (!isDevLoggingEnabled()) return null;
  if (ingestDepth > 0) return null;

  const message = compactText(input?.message);
  if (!message) return null;

  const source = normalizeSource(input?.source ?? input?.type);
  const record = {
    id: String(nextId += 1),
    at: Number.isFinite(input?.at) ? Number(input.at) : Date.now(),
    source,
    message,
    stack: input?.stack ? compactText(input.stack, 16_000) : undefined,
    method: input?.method ? String(input.method).toUpperCase() : undefined,
    url: input?.url ? compactText(input.url, 2048) : undefined,
    status: input?.status == null || input?.status === ''
      ? undefined
      : Number(input.status) || 0,
    path: input?.path ? compactText(input.path, 2048) : undefined,
  };

  ingestDepth += 1;
  try {
    store.unshift(record);
    if (store.length > MAX_STORED) store.length = MAX_STORED;
    if (!opts.skipTerminal) mirrorToTerminal(record);
    return record;
  } finally {
    ingestDepth = Math.max(0, ingestDepth - 1);
  }
}

function parseBody(req) {
  const raw = req.body;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return { message: raw.slice(0, 8000) };
    }
  }
  return {};
}

function ingestHandler(req, res) {
  try {
    if (isDevLoggingEnabled()) {
      const body = parseBody(req);
      ingestDevError(body);
    }
  } catch {
    // swallow
  }
  if (!res.headersSent) res.status(204).end();
}

function listHandler(_req, res) {
  if (!isDevLoggingEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({
    errors: store,
    total: store.length,
    max: MAX_STORED,
  });
}

function clearHandler(_req, res) {
  if (!isDevLoggingEnabled()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  store.length = 0;
  res.status(204).end();
}

export function registerDevErrorsRoutes(app) {
  app.post(DEV_ERRORS_PATH, devErrorsJson, ingestHandler);
  app.get(DEV_ERRORS_PATH, listHandler);
  app.delete(DEV_ERRORS_PATH, clearHandler);

  app.use(DEV_ERRORS_PATH, (err, req, res, next) => {
    if (err && (req.method === 'POST' || req.method === 'DELETE')) {
      if (!res.headersSent) res.status(req.method === 'POST' ? 204 : 404).end();
      return;
    }
    next(err);
  });
}

export function registerDevErrorsPage(app) {
  app.get(/^\/dev\/errors\/?$/, (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    if (!isDevLoggingEnabled()) {
      res.status(404).send('Not found');
      return;
    }
    res.sendFile(DASHBOARD_HTML, (err) => {
      if (err && !res.headersSent) res.status(404).send('Not found');
    });
  });
}

export function ingestBackendRouteError(err, req) {
  if (!err) return null;
  const path = String(req?.originalUrl || req?.url || req?.path || '');
  const q = path.indexOf('?');
  const base = q >= 0 ? path.slice(0, q) : path;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack || undefined) : undefined;
  return ingestDevError({
    source: 'backend',
    message: message || 'Unknown backend error',
    stack,
    method: req?.method,
    path: base,
    status: 500,
    at: Date.now(),
  });
}
