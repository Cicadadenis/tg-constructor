/**
 * Central environment detection for the Node.js backend.
 *
 * Modes:
 *   NODE_ENV=development — local dev (AUTH_BYPASS optional)
 *   NODE_ENV=production  — production (strict auth, no bypass)
 *
 * APP_ENV=production is kept as a legacy alias for existing deployments.
 */
export function readEnv(name) {
  return String(process.env[name] ?? '').trim();
}

export function parseTruthyFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

/** True when NODE_ENV or legacy APP_ENV is `production`. */
export function isProduction() {
  const nodeEnv = readEnv('NODE_ENV').toLowerCase();
  const appEnv = readEnv('APP_ENV').toLowerCase();
  return nodeEnv === 'production' || appEnv === 'production';
}

export function isDevelopment() {
  return !isProduction();
}

/** Resolved runtime mode (`development` | `production` | `test`). */
export function getNodeEnv() {
  if (isProduction()) return 'production';
  const nodeEnv = readEnv('NODE_ENV').toLowerCase();
  if (nodeEnv === 'test') return 'test';
  if (nodeEnv === 'development') return 'development';
  return 'development';
}

/** Dev-only structured terminal logging. */
export function isDevLoggingEnabled() {
  if (isProduction()) return false;
  if (getNodeEnv() === 'development') return true;
  return parseTruthyFlag(process.env.AUTH_BYPASS);
}

/** Dev-only AI Debug IDE — strict NODE_ENV=development (no AUTH_BYPASS in production). */
export function isDevIdeEnabled() {
  if (isProduction()) return false;
  return getNodeEnv() === 'development';
}

/** Local mock-user bypass — never honored in production. */
export function isAuthBypassEnabled() {
  if (isProduction()) return false;
  return parseTruthyFlag(process.env.AUTH_BYPASS);
}

/** ESPHome / jammer firmware runtime (off on Termux via setup.sh). */
export function isFirmwareRuntimeEnabled() {
  return !parseTruthyFlag(process.env.DISABLE_FIRMWARE_RUNTIME);
}

/**
 * Express `trust proxy` value. Never use bare `true` — express-rate-limit rejects it
 * (ERR_ERL_PERMISSIVE_TRUST_PROXY). Use hop count (1) behind a single reverse proxy.
 */
export function resolveTrustProxySetting() {
  const raw = readEnv('TRUST_PROXY').toLowerCase();
  if (['false', '0', 'off', 'no'].includes(raw)) return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (['true', '1', 'on', 'yes'].includes(raw)) {
    const hops = readEnv('TRUST_PROXY_HOPS');
    return /^\d+$/.test(hops) ? Number(hops) : 1;
  }
  if (readEnv('NODE_ENV').toLowerCase() === 'production') {
    const hops = readEnv('TRUST_PROXY_HOPS');
    return /^\d+$/.test(hops) ? Number(hops) : 1;
  }
  return false;
}
