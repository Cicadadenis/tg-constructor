import { isAuthBypassEnabled } from './authBypass.mjs';

/** Stable empty payloads for AUTH_BYPASS / DB-degraded responses. */
export const DEV_BYPASS_API_DEFAULTS = Object.freeze({
  projects: Object.freeze({ projects: [] }),
  libraries: Object.freeze({ libraries: [] }),
  bots: Object.freeze([]),
  unread: Object.freeze({ unread: 0 }),
  plans: Object.freeze({ plans: null, degraded: true }),
});

export function normalizeAuthUserId(value) {
  if (value == null) return '';
  const id = String(value).trim();
  return id || '';
}

export function getRequestAuthUserId(req) {
  return normalizeAuthUserId(req?.authUserId);
}

/** Mirror req.authUser → req.user for route handlers expecting Passport-style shape. */
export function attachAuthenticatedUser(req) {
  if (!req) return false;
  const userId = getRequestAuthUserId(req);
  if (!userId) {
    req.user = undefined;
    return false;
  }
  if (req.authUser?.id != null) {
    req.user = req.authUser;
    return true;
  }
  if (req.authBypass) {
    const bypassUser = req.authUser ?? req.user ?? null;
    if (bypassUser?.id != null) {
      req.user = bypassUser;
      req.authUser = bypassUser;
      return true;
    }
  }
  req.user = { id: userId };
  return true;
}

/**
 * Ensures requireUserAuth ran successfully.
 * @returns {{ userId: string, bypass: boolean, user: object|null }} or null if 401 sent
 */
export function requireRequestAuthContext(req, res) {
  const userId = getRequestAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Необходима авторизация' });
    return null;
  }
  attachAuthenticatedUser(req);
  const user = req.authUser ?? req.user ?? null;
  if (user != null && user.id != null && normalizeAuthUserId(user.id) !== userId) {
    res.status(401).json({ error: 'Сессия недействительна. Войдите снова.' });
    return null;
  }
  attachAuthenticatedUser(req);
  return {
    userId,
    bypass: Boolean(req.authBypass),
    user: user && user.id != null ? user : (req.user?.id != null ? req.user : null),
  };
}

export function isDatabaseUnavailableError(err) {
  if (!err || typeof err !== 'object') return false;
  const code = String(err.code || '');
  return (
    code === 'ECONNREFUSED'
    || code === 'ENOTFOUND'
    || code === 'ETIMEDOUT'
    || code === 'ECONNRESET'
    || code === '28P01'
    || code === '3D000'
    || code === '57P03'
    || code === '08001'
    || code === '08006'
    || code === '53300'
  );
}

export function authVerificationFailureStatus(err) {
  return isDatabaseUnavailableError(err) ? 503 : 401;
}

/** Auth middleware DB/JWT failures → 401 (or 503 if DB down), never 500. */
export function sendAuthVerificationFailed(
  res,
  err,
  message = 'Сессия недействительна. Войдите снова.',
) {
  const status = authVerificationFailureStatus(err);
  const body = status === 503
    ? { error: 'Сервис временно недоступен. Повторите позже.' }
    : { error: message };
  return res.status(status).json(body);
}

/**
 * Data routes: bypass → empty payload; dev + DB down → dev fallback; else 503/500.
 * Never throws.
 */
export function respondDatastoreRoute(res, routeLabel, err, options = {}) {
  const {
    bypass = false,
    bypassPayload = null,
    devFallback = null,
    productionMessage = 'Ошибка базы данных',
    never500 = false,
  } = options;

  if (bypass && bypassPayload != null) {
    return res.status(200).json(bypassPayload);
  }

  if (isAuthBypassEnabled() && devFallback != null) {
    return res.status(200).json(devFallback);
  }

  const safeMsg = err instanceof Error ? err.message : String(err || '');
  console.error(routeLabel, safeMsg);

  if (isDatabaseUnavailableError(err) || never500) {
    return res.status(503).json({ error: 'База данных временно недоступна' });
  }

  return res.status(500).json({ error: productionMessage });
}

/** Auth-protected read routes: empty/degraded payload, never 500 for missing user/DB. */
export function respondAuthProtectedRead(res, routeLabel, err, options = {}) {
  return respondDatastoreRoute(res, routeLabel, err, { never500: true, ...options });
}
