import { isAuthBypassEnabled as isBypassFromEnv } from '../auth/authBypass.js';

/** Browser build is production when Vite runs `vite build`. */
export function isProduction() {
  return import.meta.env.PROD;
}

export function isDevelopment() {
  return import.meta.env.DEV;
}

/** Mirrors backend AUTH_BYPASS — only in non-production Vite dev builds. */
export function isAuthBypassEnabled() {
  return isBypassFromEnv();
}

/** Dev-only unified error logging to backend terminal. */
export function isDevLoggingEnabled() {
  if (isProduction()) return false;
  if (isDevelopment()) return true;
  return isAuthBypassEnabled();
}
