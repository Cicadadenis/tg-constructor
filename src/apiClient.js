import { getCsrfTokenForRequest, resetCsrfPrefetch } from './csrf.js';
import { normalizeSessionUser, requireSessionUser } from './auth/sessionUser.js';
import { getDevBypassUser, isAuthBypassEnabled, resolveInitialSessionUser } from './auth/authBypass.js';
import { isDevLoggingEnabled } from './config/env.js';
import { reportApiFailure } from './debug/devLog.js';

export { normalizeSessionUser, requireSessionUser, isAuthenticatedUser } from './auth/sessionUser.js';
export { getDevBypassUser, isAuthBypassEnabled, resolveInitialSessionUser } from './auth/authBypass.js';

export const API_URL = import.meta.env.VITE_API_URL ?? '/api';

const DEV_MONITOR_SUFFIXES = ['/api/dev/log', '/api/dev/errors'];

function isDevMonitorRequestUrl(url) {
  const text = String(url ?? '');
  return DEV_MONITOR_SUFFIXES.some((suffix) => text.includes(suffix));
}

function reportApiFetchFailure(method, url, status, message) {
  if (!isDevLoggingEnabled()) return;
  reportApiFailure(method, url, status, message);
}

/** Resolve /api/... paths against VITE_API_URL (absolute or same-origin). */
export function resolveApiUrl(path) {
  const p = String(path ?? '').trim();
  if (!p) return API_URL;
  if (/^https?:\/\//i.test(p)) return p;
  const base = String(API_URL || '/api').replace(/\/$/, '');
  if (/^https?:\/\//i.test(base)) {
    const { origin } = new URL(base);
    if (p.startsWith('/api/')) return `${origin}${p}`;
    if (p.startsWith('/')) return `${origin}${p}`;
    return `${base}/${p.replace(/^\//, '')}`;
  }
  if (p.startsWith('/api/') || p === '/api') return p;
  if (p.startsWith('/')) return `${base}${p}`;
  return `${base}/${p.replace(/^\//, '')}`;
}

const MOBILE_VIEW_BREAKPOINT = 768;
const MOBILE_TOUCH_LANDSCAPE_MAX_WIDTH = 1024;
const JWT_KEY = 'cicada_jwt';

export function isMobileBuilderViewport() {
  if (typeof window === 'undefined') return false;
  const hasTouch = typeof navigator !== 'undefined'
    ? navigator.maxTouchPoints > 0
    : false;
  const hasCoarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  return window.innerWidth < MOBILE_VIEW_BREAKPOINT
    || ((hasTouch || hasCoarsePointer) && window.innerWidth < MOBILE_TOUCH_LANDSCAPE_MAX_WIDTH);
}

export function resolveApiAssetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (/^(?:data:|blob:|https?:\/\/)/i.test(url)) return url;
  if (!url.startsWith('/api/')) return url;
  try {
    const apiBase = new URL(API_URL, window.location.origin);
    return new URL(url, apiBase.origin).toString();
  } catch {
    return url;
  }
}

export function getStoredJwt() {
  return null;
}

export function storeJwt(token) {
  localStorage.removeItem(JWT_KEY);
}

export function clearJwt() {
  resetCsrfPrefetch();
  localStorage.removeItem(JWT_KEY);
}

function adminV2Headers(url) {
  const path = String(url || '');
  if (!path.includes('/api/admin/')) return {};
  const publicSuffixes = [
    '/api/admin/login-config',
    '/api/admin/login',
    '/api/admin/passkey/login-options',
    '/api/admin/passkey/login',
    '/api/admin/session',
    '/api/admin/logout',
    '/api/admin/ui',
  ];
  if (publicSuffixes.some((suffix) => path.includes(suffix))) return {};
  return { 'X-Admin-V2': '1' };
}

export async function apiFetch(url, options = {}, retryCsrf = true) {
  const resolvedUrl = resolveApiUrl(url);
  if (isDevMonitorRequestUrl(resolvedUrl)) {
    throw new Error('apiFetch: dev monitor endpoints must not use apiFetch');
  }
  const method = (options.method || 'GET').toUpperCase();
  const csrfHeaders = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    ? { 'x-csrf-token': await getCsrfTokenForRequest(API_URL) }
    : {};
  const mergedHeaders = { ...csrfHeaders, ...adminV2Headers(resolvedUrl), ...(options.headers || {}) };
  let res;
  try {
    res = await fetch(resolvedUrl, { credentials: 'include', ...options, headers: mergedHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    reportApiFetchFailure(method, resolvedUrl, 0, msg);
    throw new Error('⚠️ Сервер не запущен или недоступен');
  }

  if (res.status === 401) {
    clearJwt();
    localStorage.removeItem('cicada_session');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cicada:session-expired'));
    }
    throw new Error('⚠️ Сессия истекла — войдите заново');
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 204) return null;
    if (res.status === 502 || res.status === 503) {
      const errMsg = `⚠️ Сервер временно недоступен (${res.status}). Запустите backend: npm run server`;
      reportApiFetchFailure(method, resolvedUrl, res.status, errMsg);
      throw new Error(errMsg);
    }
    if (res.status === 500) {
      const errMsg = '⚠️ Внутренняя ошибка сервера (500)';
      reportApiFetchFailure(method, resolvedUrl, res.status, errMsg);
      throw new Error(errMsg);
    }
    if (res.status === 404) {
      const errMsg = '⚠️ Эндпоинт не найден (404)';
      reportApiFetchFailure(method, resolvedUrl, res.status, errMsg);
      throw new Error(errMsg);
    }
    const errMsg = '⚠️ Сервер не запущен или вернул неверный ответ';
    reportApiFetchFailure(method, resolvedUrl, res.status, errMsg);
    throw new Error(errMsg);
  }

  const data = await res.json();

  if (
    retryCsrf === true
    && res.status === 403
    && typeof data?.error === 'string'
    && data.error.includes('CSRF')
  ) {
    resetCsrfPrefetch();
    return apiFetch(url, options, false);
  }

  if (res.status >= 500) {
    const errMsg = data?.error || `⚠️ Внутренняя ошибка сервера (${res.status})`;
    reportApiFetchFailure(method, resolvedUrl, res.status, errMsg);
    throw new Error(errMsg);
  }

  if (data?.error) {
    reportApiFetchFailure(method, resolvedUrl, res.status, data.error);
    throw new Error(data.error);
  }
  return data;
}

export async function postJsonWithCsrf(url, body, retryCsrf = true) {
  const resolvedUrl = resolveApiUrl(url);
  if (isDevMonitorRequestUrl(resolvedUrl)) {
    throw new Error('postJsonWithCsrf: dev monitor endpoints must not use postJsonWithCsrf');
  }
  const token = await getCsrfTokenForRequest(API_URL);
  const res = await fetch(resolvedUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    body: JSON.stringify(body ?? {}),
  });
  if (
    retryCsrf === true
    && res.status === 403
  ) {
    const data = await res.clone().json().catch(() => ({}));
    if (typeof data?.error === 'string' && data.error.includes('CSRF')) {
      resetCsrfPrefetch();
      return postJsonWithCsrf(url, body, false);
    }
  }
  return res;
}

export function stripOauthLoginFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('oauth_login')) return;
  url.searchParams.delete('oauth_login');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export async function fetchOauthBootstrapUser() {
  const bypassUser = getDevBypassUser();
  if (bypassUser) return bypassUser;

  const params = new URLSearchParams();
  let oauthCode = null;
  if (typeof window !== 'undefined') {
    oauthCode = new URLSearchParams(window.location.search).get('oauth_login');
    if (oauthCode) params.set('code', oauthCode);
  }
  const qs = params.toString();
  const r = await fetch(`${resolveApiUrl('/api/auth/oauth-bootstrap')}${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  const data = await r.json().catch(() => ({}));
  if (data?.twofaRequired && data?.user) {
    const e = new Error('Требуется код 2FA');
    e.twofaRequired = true;
    e.user = normalizeSessionUser(data.user);
    throw e;
  }
  if (data?.error) {
    const e = new Error(data.error);
    e.oauthFailed = true;
    if (oauthCode) stripOauthLoginFromUrl();
    throw e;
  }
  if (data?.ok && data.user) {
    const user = normalizeSessionUser(data.user);
    if (!user) return null;
    stripOauthLoginFromUrl();
    return user;
  }
  if (oauthCode) {
    const e = new Error('Не удалось завершить вход. Повторите вход через Google или Telegram.');
    e.oauthFailed = true;
    stripOauthLoginFromUrl();
    throw e;
  }
  return null;
}

export async function completeOauth2FA(totp = '') {
  let path = '/api/auth/oauth-2fa/complete';
  if (typeof window !== 'undefined') {
    const code = new URLSearchParams(window.location.search).get('oauth_login');
    if (code) path = `${path}?code=${encodeURIComponent(code)}`;
  }
  const res = await postJsonWithCsrf(path, { totp });
  const data = await res.json().catch(() => ({}));
  if (data?.twofaRequired) {
    const e = new Error(data.error || 'Неверный код 2FA');
    e.twofaRequired = true;
    throw e;
  }
  if (data?.error) throw new Error(data.error);
  const user = requireSessionUser(data.user, 'Вход выполнен, но сервер не вернул профиль. Попробуйте снова.');
  stripOauthLoginFromUrl();
  return user;
}

export async function registerUser(name, email, password) {
  return await apiFetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
}

export async function loginUser(email, password, totp = '') {
  const res = await postJsonWithCsrf('/api/login', { email, password, totp });
  const data = await res.json().catch(() => ({}));
  if (data?.twofaRequired) {
    const e = new Error(data.error || 'Требуется код 2FA');
    e.twofaRequired = true;
    throw e;
  }
  if (data?.error) throw new Error(data.error);
  return requireSessionUser(data.user, 'Вход выполнен, но сервер не вернул профиль. Попробуйте снова.');
}

export async function forgotPassword(email) {
  return await apiFetch('/api/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, password) {
  return await apiFetch('/api/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
}

export async function requestEmailChange(userId, currentEmail, newEmail) {
  return await apiFetch('/api/request-email-change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, currentEmail, newEmail }),
  });
}

export async function confirmEmailChange(userId, code, newEmail) {
  return await apiFetch('/api/confirm-email-change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, code, newEmail }),
  });
}

export async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function updateUser(userId, updates, currentUser = null) {
  const data = await apiFetch('/api/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, updates }),
  });

  const rawUser = data?.user || {};
  const normalized = normalizeSessionUser({
    ...(currentUser || {}),
    ...rawUser,
    id: rawUser.id ?? currentUser?.id ?? userId,
  });
  if (!normalized) {
    throw new Error('Сервер не вернул профиль пользователя');
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, 'photo_url')) {
    normalized.photo_url = Object.prototype.hasOwnProperty.call(rawUser, 'photo_url')
      ? (rawUser.photo_url ?? null)
      : (updates.photo_url ?? null);
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, 'ui_language')) {
    normalized.uiLanguage = String(updates.ui_language || 'ru').toLowerCase();
  } else if (!normalized.uiLanguage && rawUser?.ui_language) {
    normalized.uiLanguage = String(rawUser.ui_language).toLowerCase();
  }

  return normalized;
}

export async function uploadAvatar(userId, dataUrl, currentUser = null) {
  const data = await apiFetch('/api/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, dataUrl }),
  });
  const rawUser = data?.user || {};
  const normalized = normalizeSessionUser({
    ...(currentUser || {}),
    ...rawUser,
    id: rawUser.id ?? currentUser?.id ?? userId,
  });
  if (!normalized) {
    throw new Error('Сервер не вернул профиль пользователя');
  }
  if (Object.prototype.hasOwnProperty.call(rawUser, 'photo_url')) {
    normalized.photo_url = rawUser.photo_url ?? null;
  }
  return normalized;
}

export function saveSession(user) {
  const normalized = normalizeSessionUser(user);
  if (normalized) {
    localStorage.setItem('cicada_session', JSON.stringify(normalized));
  } else {
    localStorage.removeItem('cicada_session');
  }
}

export function getSession() {
  try {
    const data = localStorage.getItem('cicada_session');
    if (!data) return null;
    const parsed = JSON.parse(data);
    const user = normalizeSessionUser(parsed);
    if (!user && parsed) {
      localStorage.removeItem('cicada_session');
    }
    return user;
  } catch {
    localStorage.removeItem('cicada_session');
    return null;
  }
}

export function clearSession() {
  resetCsrfPrefetch();
  localStorage.removeItem('cicada_session');
  clearJwt();
}

export async function fetchSessionUserFromServer() {
  const bypassUser = getDevBypassUser();
  if (bypassUser) return bypassUser;

  try {
    const data = await apiFetch('/api/me');
    return normalizeSessionUser(data?.user);
  } catch {
    return null;
  }
}
