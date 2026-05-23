import { createDevBypassUser, DEV_BYPASS_USER_ID } from '../core/auth/devBypassUser.mjs';
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

export function getDevBypassUser() {
  if (!isAuthBypassEnabled()) return null;
  return createDevBypassUser();
}

export function applyDevAuthBypassToRequest(req) {
  const user = getDevBypassUser();
  if (!user?.id) return false;
  req.authUserId = DEV_BYPASS_USER_ID;
  req.authUser = user;
  req.user = user;
  req.authBypass = true;
  return true;
}

export function logAuthBypassStartupWarning() {
  if (!isAuthBypassEnabled()) return;
  console.warn(
    '[auth] AUTH_BYPASS=1 — local mock user injected (development only). Ignored when NODE_ENV=production.',
  );
}
