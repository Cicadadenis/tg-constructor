/** Минимальный срок активной PRO для сборки bin и прошивки глушилки (2 недели). */
export const ESP_PREMIUM_MIN_DAYS = 14;
const MS_PER_DAY = 86400000;

/** BIGINT из pg / BigInt → безопасное число для сравнений. */
export function coerceMillis(value) {
  if (value == null || value === '') return null;
  try {
    const n = typeof value === 'bigint' ? Number(value) : Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ plan?: string, subscriptionExp?: number|null, role?: string, banned?: boolean }|null} user
 */
export function getEspPremiumAccess(user) {
  const minDays = ESP_PREMIUM_MIN_DAYS;
  if (!user || user.banned) {
    return {
      allowed: false,
      daysLeft: 0,
      minDays,
      plan: 'trial',
      subscriptionExp: null,
      reason: 'no_user',
    };
  }
  if (user.role === 'admin') {
    return {
      allowed: true,
      daysLeft: 999,
      minDays,
      plan: 'pro',
      subscriptionExp: user.subscriptionExp ?? null,
      reason: 'admin',
    };
  }
  const now = Date.now();
  const exp = coerceMillis(user.subscriptionExp);
  const plan = String(user.plan || '').trim().toLowerCase();
  const active = plan === 'pro' && exp != null && exp > now;
  const daysLeft = active ? Math.ceil((exp - now) / MS_PER_DAY) : 0;
  const allowed = active && daysLeft >= minDays;
  return {
    allowed,
    daysLeft,
    minDays,
    plan: active ? 'pro' : (user.plan || 'trial'),
    subscriptionExp: exp,
    reason: allowed ? 'ok' : (active ? 'subscription_too_short' : 'no_pro'),
  };
}

export function espPremiumDeniedMessage(access) {
  const minDays = access?.minDays ?? ESP_PREMIUM_MIN_DAYS;
  if (access?.daysLeft > 0 && access.daysLeft < minDays) {
    return `Доступно при подписке PRO от ${minDays} дней (сейчас осталось ${access.daysLeft} дн.). Оформите тариф «2 недели» или дольше в Cicada Studio → Профиль.`;
  }
  return `Доступно при активной подписке PRO от ${minDays} дней. Оформите подписку в Cicada Studio → Профиль.`;
}
