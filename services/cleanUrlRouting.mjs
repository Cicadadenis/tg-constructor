import fs from 'fs';
import path from 'path';
import { sendHtmlWithCspNonce } from './sendHtmlWithCspNonce.mjs';

/** Paths that must never be rewritten or stripped of `.html`. */
const REDIRECT_EXCLUDE_PREFIXES = ['/api/', '/firmware/'];

/**
 * @param {string} pathname — req.path (no query)
 * @returns {string|null} canonical path for 301, or null to skip
 */
export function cleanUrlRedirectTarget(pathname) {
  if (!pathname || !pathname.endsWith('.html')) return null;
  for (const prefix of REDIRECT_EXCLUDE_PREFIXES) {
    if (pathname.startsWith(prefix)) return null;
  }
  if (pathname === '/index.html' || pathname.endsWith('/index.html')) {
    const dir = pathname.slice(0, -'index.html'.length);
    return dir.length > 1 ? (dir.endsWith('/') ? dir : `${dir}/`) : '/';
  }
  const bare = pathname.slice(0, -5);
  return bare || '/';
}

function firstExistingFile(candidates) {
  for (const fp of candidates) {
    try {
      if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return fp;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Clean URL layer: 301 away from `.html`, serve directory indexes, try `$uri.html` fallback.
 * Register after API/firmware route handlers, before `express.static('dist')`.
 */
export function registerCleanUrlRouting(app, { distRoot = 'dist', publicRoot = 'public' } = {}) {
  const dist = path.resolve(distRoot);
  const pub = path.resolve(publicRoot);

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const target = cleanUrlRedirectTarget(req.path);
    if (!target || target === req.path) return next();
    const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(301, `${target}${qs}`);
  });

  const directoryPages = [
    {
      pattern: /^\/esphome\/?$/,
      candidates: [
        path.join(pub, 'esphome', 'index.html'),
        path.join(dist, 'esphome', 'index.html'),
      ],
    },
  ];

  for (const { pattern, candidates } of directoryPages) {
    app.all(pattern, (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).send('Method Not Allowed');
      const fp = firstExistingFile(candidates);
      if (!fp) return next();
      return res.sendFile(fp);
    });
  }

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const p = req.path;
    if (p.startsWith('/api') || p.startsWith('/firmware')) return next();
    const base = path.basename(p);
    if (base.includes('.') && base !== '') return next();
    const rel = p.replace(/^\//, '');
    const fp = firstExistingFile([
      path.join(dist, rel + '.html'),
      path.join(pub, rel + '.html'),
    ]);
    if (!fp) return next();
    return sendHtmlWithCspNonce(res, fp);
  });
}
