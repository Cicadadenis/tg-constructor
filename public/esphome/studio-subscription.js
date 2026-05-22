/**
 * Те же данные о подписке, что в Cicada Studio (App.jsx, ProfileModal).
 * Источник: localStorage cicada_session + GET /api/me (findById на сервере).
 */
window.CicadaStudioSubscription = (function () {
  const SESSION_KEY = 'cicada_session';
  const MS_PER_DAY = 86400000;

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Как hasActiveProSubscription в src/App.jsx */
  function hasActivePro(user) {
    return Boolean(
      user &&
        user.plan === 'pro' &&
        user.subscriptionExp != null &&
        Number(user.subscriptionExp) > Date.now(),
    );
  }

  /** Как /api/subscription/status — daysLeft для отображения */
  function daysLeft(user) {
    if (!hasActivePro(user)) return 0;
    return Math.ceil((Number(user.subscriptionExp) - Date.now()) / MS_PER_DAY);
  }

  /**
   * PRO для ESPHome (bin + глушилка): активная подписка Studio + минимум minDays дней.
   * @param {object|null} user
   * @param {number} [minDays=14]
   */
  function espAccessFromUser(user, minDays) {
    const min = Number(minDays) > 0 ? Number(minDays) : 14;
    if (!user || user.banned) {
      return {
        allowed: false,
        daysLeft: 0,
        minDays: min,
        plan: 'trial',
        subscriptionExp: null,
        reason: 'no_user',
        hasActivePro: false,
      };
    }
    if (user.role === 'admin') {
      return {
        allowed: true,
        daysLeft: 999,
        minDays: min,
        plan: 'pro',
        subscriptionExp: user.subscriptionExp ?? null,
        reason: 'admin',
        hasActivePro: true,
      };
    }
    const activePro = hasActivePro(user);
    const left = activePro ? daysLeft(user) : 0;
    const allowed = activePro && left >= min;
    return {
      allowed,
      daysLeft: left,
      minDays: min,
      plan: activePro ? 'pro' : (user.plan || 'trial'),
      subscriptionExp: user.subscriptionExp ?? null,
      reason: allowed ? 'ok' : (activePro ? 'subscription_too_short' : 'no_pro'),
      hasActivePro: activePro,
    };
  }

  /** GET /api/me — тот же ответ, что синхронизирует Studio */
  async function fetchUser() {
    const res = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
    if (res.status === 401) return { user: null, auth: false };
    if (!res.ok) return { user: null, auth: true, error: true };
    const data = await res.json().catch(function () { return {}; });
    return { user: data.user || null, auth: true };
  }

  async function resolveEspAccess(minDays) {
    const cached = readSession();
    const fromCache = cached ? espAccessFromUser(cached, minDays) : null;

    const me = await fetchUser();
    if (!me.auth) {
      return { allowed: false, daysLeft: 0, minDays: minDays || 14, reason: 'auth' };
    }
    if (me.user) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(me.user));
      } catch { /* ignore */ }
      return espAccessFromUser(me.user, minDays);
    }
    if (fromCache) return fromCache;
    return espAccessFromUser(null, minDays);
  }

  return {
    readSession,
    hasActivePro,
    daysLeft,
    espAccessFromUser,
    fetchUser,
    resolveEspAccess,
  };
})();
