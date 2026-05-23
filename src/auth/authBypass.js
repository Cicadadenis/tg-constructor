import { createDevBypassUser } from '../../core/auth/devBypassUser.mjs';
import { normalizeSessionUser } from './sessionUser.js';

function parseAuthBypassFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

/**
 * Client-side dev bypass — requires a non-production Vite build (import.meta.env.DEV).
 * VITE_AUTH_BYPASS is injected from AUTH_BYPASS in vite.config.js (development mode only).
 * Never active in production builds regardless of env vars.
 */
export function isAuthBypassEnabled() {
  if (import.meta.env.PROD || !import.meta.env.DEV) return false;
  return parseAuthBypassFlag(import.meta.env.VITE_AUTH_BYPASS);
}

export function getDevBypassUser() {
  if (!isAuthBypassEnabled()) return null;
  return normalizeSessionUser(createDevBypassUser());
}

/** Apply bypass user to module-level session when enabled. */
export function resolveInitialSessionUser(getSessionFn) {
  if (isAuthBypassEnabled()) {
    const bypass = getDevBypassUser();
    if (bypass) return bypass;
  }
  return typeof getSessionFn === 'function' ? getSessionFn() : null;
}
