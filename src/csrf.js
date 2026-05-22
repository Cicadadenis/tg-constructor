let csrfCache = null;
let inflight = null;

const CSRF_COOKIE_NAME = 'csrf_token';

export function resetCsrfPrefetch() {
  csrfCache = null;
  inflight = null;
}

function readCsrfCookie() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function csrfEndpoint(apiBaseOrRequestUrl = import.meta.env.VITE_API_URL || '/api') {
  const raw = String(apiBaseOrRequestUrl || import.meta.env.VITE_API_URL || '/api').trim();
  const absolute = /^https?:\/\//i.test(raw);
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(raw.startsWith('/') || absolute ? raw : `/${raw}`, fallbackOrigin);
  const path = url.pathname.replace(/\/+$/, '') || '/api';
  const apiIndex = path.indexOf('/api/');

  if (path.endsWith('/api')) {
    url.pathname = `${path}/csrf-token`;
  } else if (apiIndex >= 0) {
    url.pathname = `${path.slice(0, apiIndex + 4)}/csrf-token`;
  } else {
    url.pathname = `${path}/csrf-token`;
  }
  url.search = '';

  return absolute ? url.toString() : url.pathname;
}

function cacheToken(endpoint, token) {
  if (!token || typeof token !== 'string' || token.length < 48) return null;
  csrfCache = { endpoint, token };
  return token;
}

/** Токен для заголовка x-csrf-token (cookie выставляет GET /api/csrf-token). */
export async function getCsrfTokenForRequest(apiBaseOrRequestUrl = import.meta.env.VITE_API_URL || '/api') {
  const endpoint = csrfEndpoint(apiBaseOrRequestUrl);
  if (csrfCache?.endpoint === endpoint) return csrfCache.token;

  const cookieToken = readCsrfCookie();
  if (cookieToken) {
    const cached = cacheToken(endpoint, cookieToken);
    if (cached) return cached;
  }

  if (!inflight || inflight.endpoint !== endpoint) {
    const promise = fetch(endpoint, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 500 || r.status === 502 || r.status === 503) {
            throw new Error(
              'CSRF: API-сервер не запущен. В отдельном терминале: npm run server  (или npm run dev:full)',
            );
          }
          throw new Error('CSRF: не удалось получить токен');
        }
        const d = await r.json().catch(() => ({}));
        const token = d?.csrfToken || readCsrfCookie();
        const cached = cacheToken(endpoint, token);
        if (!cached) throw new Error('CSRF: неверный ответ сервера');
        return cached;
      })
      .catch((err) => {
        if (err instanceof TypeError) {
          throw new Error(
            'CSRF: API-сервер недоступен. Запустите npm run server  (или npm run dev:full)',
          );
        }
        throw err;
      })
      .finally(() => {
        inflight = null;
      });
    inflight = { endpoint, promise };
  }
  return inflight.promise;
}

/** Bootstrap: prefetch CSRF before any mutating API call. */
export function prefetchCsrfToken(apiBaseOrRequestUrl) {
  return getCsrfTokenForRequest(apiBaseOrRequestUrl);
}
