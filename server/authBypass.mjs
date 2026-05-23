import { createDevBypassUser } from '../core/auth/devBypassUser.mjs';
import {
  isAuthBypassEnabled,
  isDevelopment,
  isProduction,
} from '../core/env.mjs';

export { isAuthBypassEnabled, isDevelopment, isProduction } from '../core/env.mjs';

/** @deprecated Use isProduction() from core/env.mjs */
export function isProductionEnv() {
  return isProduction();
}

/** Sync fallback (tests / until DB is ready). */
export function getDevBypassUser() {
  if (!isAuthBypassEnabled()) return null;
  const email = String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
  const name = String(process.env.ADMIN_NAME || 'Admin').trim().slice(0, 64) || 'Admin';
  return createDevBypassUser({
    ...(email ? { email } : {}),
    name,
    role: 'admin',
    plan: 'pro',
  });
}

/**
 * Prefer seeded ADMIN_EMAIL user from PostgreSQL (stable id, projects, admin UI).
 * @param {(email: string) => Promise<object|null>} findByEmail
 */
export async function resolveDevBypassUser(findByEmail) {
  if (!isAuthBypassEnabled()) return null;
  const email = String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
  if (email && typeof findByEmail === 'function') {
    try {
      const row = await findByEmail(email);
      if (row?.id) return row;
    } catch {
      // DB not ready — use mock below
    }
  }
  return getDevBypassUser();
}

export function applyDevAuthBypassToRequest(req, user = null) {
  const resolved = user || getDevBypassUser();
  if (!resolved?.id) return false;
  req.authUserId = String(resolved.id);
  req.authUser = resolved;
  req.user = resolved;
  req.authBypass = true;
  return true;
}

export function logAuthBypassStartupWarning() {
  if (!isAuthBypassEnabled()) return;
  console.warn(
    '[auth] AUTH_BYPASS=1 — local mock user injected (development only). Ignored when NODE_ENV=production.',
  );
}
