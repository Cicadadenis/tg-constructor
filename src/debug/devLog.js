import { isDevLoggingEnabled } from '../config/env.js';
import { resolveApiUrl } from '../apiClient.js';

const DEV_ERRORS_PATH = '/api/dev/errors';
const DEV_LOG_PATH = '/api/dev/log';
let initialized = false;
let reportingDepth = 0;
let devLogInflight = 0;
let devLogBackoffUntil = 0;
let devLogCircuitOpen = false;
const MAX_DEV_LOG_INFLIGHT = 2;
const DEV_LOG_BACKOFF_MS = 15_000;
const MAX_REPORTS_PER_WINDOW = 30;
let reportWindowStart = 0;
let reportWindowCount = 0;

export { isDevLoggingEnabled };

/** Native fetch — never the patched interceptor (prevents recursive /api/dev/log storms). */
let nativeFetch = null;

function getNativeFetch() {
  if (nativeFetch) return nativeFetch;
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const bound = window.fetch.__cicadaNativeFetch || window.fetch;
    nativeFetch = bound.bind(window);
    return nativeFetch;
  }
  if (typeof globalThis.fetch === 'function') {
    nativeFetch = globalThis.fetch.bind(globalThis);
    return nativeFetch;
  }
  return null;
}

function isDevMonitorUrl(url) {
  const text = String(url ?? '');
  if (!text) return false;
  if (text.includes(DEV_ERRORS_PATH) || text.includes(DEV_LOG_PATH)) return true;
  try {
    const resolvedErrors = resolveApiUrl(DEV_ERRORS_PATH);
    const resolvedLog = resolveApiUrl(DEV_LOG_PATH);
    return text === resolvedErrors
      || text.endsWith(DEV_ERRORS_PATH)
      || text === resolvedLog
      || text.endsWith(DEV_LOG_PATH);
  } catch {
    return text.includes(DEV_ERRORS_PATH) || text.includes(DEV_LOG_PATH);
  }
}

function shouldReportUrl(url) {
  if (isDevMonitorUrl(url)) return false;
  if (reportingDepth > 0) return false;
  if (devLogCircuitOpen) return false;
  if (Date.now() < devLogBackoffUntil) return false;
  return true;
}

function allowReportBurst() {
  const now = Date.now();
  if (now - reportWindowStart > 10_000) {
    reportWindowStart = now;
    reportWindowCount = 0;
  }
  if (reportWindowCount >= MAX_REPORTS_PER_WINDOW) {
    devLogCircuitOpen = true;
    devLogBackoffUntil = now + DEV_LOG_BACKOFF_MS;
    return false;
  }
  reportWindowCount += 1;
  return true;
}

function resolveRequestMeta(input, init) {
  if (typeof input === 'string') {
    return {
      url: input,
      method: (init?.method || 'GET').toUpperCase(),
    };
  }
  if (input instanceof Request) {
    return {
      url: input.url,
      method: (init?.method || input.method || 'GET').toUpperCase(),
    };
  }
  return {
    url: String(input ?? ''),
    method: (init?.method || 'GET').toUpperCase(),
  };
}

function buildErrorPayload(source, fields = {}) {
  return {
    source,
    at: Date.now(),
    ...fields,
  };
}

function sendDevError(payload) {
  if (!isDevLoggingEnabled()) return;
  if (devLogCircuitOpen) return;
  if (!allowReportBurst()) return;
  if (devLogInflight >= MAX_DEV_LOG_INFLIGHT) return;

  const fetchImpl = getNativeFetch();
  if (!fetchImpl) return;

  const body = JSON.stringify(payload);
  const url = resolveApiUrl(DEV_ERRORS_PATH);

  devLogInflight += 1;

  const release = () => {
    devLogInflight = Math.max(0, devLogInflight - 1);
  };

  const onDevLogFailure = () => {
    devLogBackoffUntil = Date.now() + DEV_LOG_BACKOFF_MS;
    devLogCircuitOpen = true;
    setTimeout(() => {
      devLogCircuitOpen = false;
    }, DEV_LOG_BACKOFF_MS);
  };

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) {
        release();
        return;
      }
    }
  } catch {
    // fall through to fetch
  }

  fetchImpl(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok && res.status !== 204) onDevLogFailure();
    })
    .catch(onDevLogFailure)
    .finally(release);
}

export function reportFrontend(message, extra = {}) {
  if (!shouldReportUrl(DEV_ERRORS_PATH)) return;
  reportingDepth += 1;
  try {
    const text = String(message ?? 'Unknown frontend error');
    sendDevError(buildErrorPayload('frontend', {
      message: text,
      stack: extra.stack || (text.includes('\n') ? text : undefined),
      ...extra,
    }));
  } finally {
    reportingDepth = Math.max(0, reportingDepth - 1);
  }
}

export function reportApiFailure(method, url, status, message, extra = {}) {
  if (!shouldReportUrl(url)) return;
  reportingDepth += 1;
  try {
    sendDevError(buildErrorPayload('api', {
      method,
      url,
      status,
      message: message || `HTTP ${status || 0} ${method} ${url}`,
      ...extra,
    }));
  } finally {
    reportingDepth = Math.max(0, reportingDepth - 1);
  }
}

function installFetchInterceptor() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  if (window.fetch.__cicadaDevLogPatched) return;

  const originalFetch = window.fetch.bind(window);
  if (!window.fetch.__cicadaNativeFetch) {
    window.fetch.__cicadaNativeFetch = originalFetch;
  }
  nativeFetch = originalFetch;

  const patchedFetch = async (input, init) => {
    const { url, method } = resolveRequestMeta(input, init);
    if (isDevMonitorUrl(url)) {
      return originalFetch(input, init);
    }
    try {
      const response = await originalFetch(input, init);
      if (response.status >= 400 && shouldReportUrl(url)) {
        reportApiFailure(method, url, response.status);
      }
      return response;
    } catch (err) {
      if (shouldReportUrl(url)) {
        const msg = err instanceof Error ? err.message : String(err);
        reportApiFailure(method, url, 0, msg);
      }
      throw err;
    }
  };

  patchedFetch.__cicadaDevLogPatched = true;
  patchedFetch.__cicadaNativeFetch = originalFetch;
  window.fetch = patchedFetch;
}

function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  const prevOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const msg = error instanceof Error
      ? error.message
      : String(message ?? 'Unknown error');
    const stack = error instanceof Error
      ? (error.stack || undefined)
      : undefined;
    const location = source ? ` at ${source}:${lineno}:${colno}` : '';
    reportFrontend(msg + location, { stack });
    if (typeof prevOnError === 'function') {
      return prevOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof Error) {
      reportFrontend(reason.message, { stack: reason.stack });
      return;
    }
    reportFrontend(String(reason ?? 'Unhandled promise rejection'));
  });
}

export function initDevErrorLogging() {
  if (initialized || !isDevLoggingEnabled()) return;
  initialized = true;
  getNativeFetch();
  installFetchInterceptor();
  installGlobalErrorHandlers();
}
