import express from 'express';
import {
  isDevLoggingEnabled as isBackendDevLoggingEnabled,
} from '../core/env.mjs';

export const DEV_LOG_PATH = '/api/dev/log';

export { isDevLoggingEnabled } from '../core/env.mjs';

/** In-process guard against re-entrant dev-log handling. */
let devLogHandlingDepth = 0;

const devLogJson = express.json({
  limit: '32kb',
  strict: false,
});

export function isDevLogApiPath(path) {
  const p = String(path ?? '');
  const q = p.indexOf('?');
  const base = q >= 0 ? p.slice(0, q) : p;
  if (base === DEV_LOG_PATH || base.endsWith(DEV_LOG_PATH)) return true;
  if (base === '/api/dev/errors' || base.endsWith('/api/dev/errors')) return true;
  if (base === '/api/ai/chat' || base.startsWith('/api/ai/chat/')) return true;
  if (base === '/api/files' || base.startsWith('/api/files/')) return true;
  return false;
}

function compactLine(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function writeTagged(tag, message) {
  try {
    const text = compactLine(message);
    if (!text) {
      console.error(`[${tag}]`);
      return;
    }
    const lines = text.split('\n');
    console.error(`[${tag}] ${lines[0]}`);
    for (let i = 1; i < lines.length; i += 1) {
      console.error(`         ${lines[i]}`);
    }
  } catch {
    console.error(`[${tag}] (log write failed)`);
  }
}

export function logFrontend(message) {
  if (!isBackendDevLoggingEnabled()) return;
  writeTagged('FRONTEND', message);
}

export function logApi(method, url, status, detail) {
  if (!isBackendDevLoggingEnabled()) return;
  if (isDevLogApiPath(url)) return;
  try {
    const verb = String(method || 'GET').toUpperCase();
    const endpoint = compactLine(url) || '?';
    const code = status == null || status === '' ? '?' : String(status);
    const suffix = detail ? ` — ${compactLine(detail)}` : '';
    console.error(`[API] ${verb} ${endpoint} ${code}${suffix}`);
  } catch {
    console.error('[API] (log write failed)');
  }
}

export function logBackend(errOrMessage) {
  if (!isBackendDevLoggingEnabled()) return;
  try {
    if (errOrMessage instanceof Error) {
      writeTagged('BACKEND', errOrMessage.stack || `${errOrMessage.name}: ${errOrMessage.message}`);
      return;
    }
    writeTagged('BACKEND', errOrMessage);
  } catch {
    console.error('[BACKEND] (log write failed)');
  }
}

function requestPath(req) {
  const raw = req.originalUrl || req.url || req.path || '';
  const q = raw.indexOf('?');
  return q >= 0 ? raw.slice(0, q) : raw;
}

function parseDevLogBody(req) {
  const raw = req.body;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return { type: 'frontend', message: raw.slice(0, 8000) };
    }
  }
  return {};
}

function ingestDevLogPayload(body) {
  if (devLogHandlingDepth > 0) return;
  devLogHandlingDepth += 1;
  try {
    const type = String(body.type || body.source || 'frontend').toLowerCase();
    const payload = {
      source: type,
      message: body.message,
      stack: body.stack,
      method: body.method,
      url: body.url,
      path: body.path,
      status: body.status,
      at: body.at,
    };
    import('./devErrors.mjs')
      .then((mod) => mod.ingestDevError(payload))
      .catch(() => {
        const message = compactLine(body.message);
        if (type === 'api') {
          logApi(body.method, body.url, body.status, message || undefined);
        } else if (type === 'backend') {
          logBackend(message || 'Unknown backend message');
        } else {
          logFrontend(message || 'Unknown frontend error');
        }
      });
  } finally {
    devLogHandlingDepth = Math.max(0, devLogHandlingDepth - 1);
  }
}

/** Always ends the response — never calls next(err), never touches auth. */
function devLogHandler(req, res) {
  try {
    if (isBackendDevLoggingEnabled()) {
      ingestDevLogPayload(parseDevLogBody(req));
    }
  } catch {
    // swallow — dev log must never crash or cascade
  }
  if (!res.headersSent) {
    res.status(204).end();
  }
}

/**
 * Mount dev log before any auth/CSRF/global JSON middleware.
 * No req.user, no pool, no session — terminal output only.
 */
export function registerDevLogRoutes(app) {
  app.post(DEV_LOG_PATH, devLogJson, devLogHandler);

  app.use(DEV_LOG_PATH, (err, req, res, next) => {
    if (err && req.method === 'POST') {
      if (!res.headersSent) res.status(204).end();
      return;
    }
    next(err);
  });
}

export function devApiRequestLogger(req, res, next) {
  if (!isBackendDevLoggingEnabled()) return next();
  const path = requestPath(req);
  if (!path.startsWith('/api') || isDevLogApiPath(path)) return next();

  res.on('finish', () => {
    if (isDevLogApiPath(path)) return;
    const { statusCode } = res;
    logApi(req.method, path, statusCode);
    if (statusCode >= 400) {
      import('./devErrors.mjs')
        .then((mod) => mod.ingestDevError({
          source: 'api',
          method: req.method,
          path,
          status: statusCode,
          message: `HTTP ${statusCode} ${req.method} ${path}`,
        }, { skipTerminal: true }))
        .catch(() => {});
    }
  });
  next();
}

export function devErrorHandler(err, req, res, next) {
  const path = requestPath(req);
  const isDevLogRoute = isDevLogApiPath(path);

  if (isDevLogRoute) {
    if (!res.headersSent) res.status(204).end();
    return undefined;
  }

  if (err) {
    if (isBackendDevLoggingEnabled()) {
      try {
        import('./devErrors.mjs')
          .then((mod) => mod.ingestBackendRouteError(err, req))
          .catch(() => {
            logBackend(err);
            if (path.startsWith('/api') && !res.headersSent) {
              logApi(req.method, path, 500, err instanceof Error ? err.message : String(err));
            }
          });
      } catch {
        console.error('[error]', err instanceof Error ? err.message : String(err));
      }
    } else {
      const safe = err instanceof Error ? err.message : String(err);
      console.error('[error]', safe);
    }
  }

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({ error: 'Произошла ошибка. Попробуйте позже.' });
}

export function logDevLoggingStartupBanner() {
  if (!isBackendDevLoggingEnabled()) return;
  console.warn('[dev-log] Unified error logging enabled → [FRONTEND] [API] [BACKEND] in this terminal');
  console.warn('[dev-log] Error dashboard: http://127.0.0.1:' + (process.env.API_PORT || '3001') + '/dev/errors');
}

/** Wrap async route handlers so rejections reach devErrorHandler. */
export function wrapAsyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
