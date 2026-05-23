import { createDevBypassUser } from '../../core/auth/devBypassUser.mjs';
import { normalizeSessionUser } from './sessionUser.js';

function parseAuthBypassFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

/**
 * Client-side bypass when VITE_AUTH_BYPASS=1 (local WSL/Termux install; set at `vite build` from .env).
 */
export function isAuthBypassEnabled() {
  return parseAuthBypassFlag(import.meta.env.VITE_AUTH_BYPASS);
}

export function getDevBypassUser() {
  if (!isAuthBypassEnabled()) return null;
  const email = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
  const name = String(import.meta.env.VITE_ADMIN_NAME || 'Admin').trim().slice(0, 64) || 'Admin';
  return normalizeSessionUser(createDevBypassUser({
    ...(email ? { email } : {}),
    name,
    role: 'admin',
    plan: 'pro',
  }));
}

/** Apply bypass user to module-level session when enabled. */
export function resolveInitialSessionUser(getSessionFn) {
  if (isAuthBypassEnabled()) {
    const bypass = getDevBypassUser();
    if (bypass) return bypass;
  }
  return typeof getSessionFn === 'function' ? getSessionFn() : null;
}
