/** Stable dev-only user id (never used in production when bypass is disabled). */
export const DEV_BYPASS_USER_ID = 'dev-bypass-user';

/**
 * Mock session user for local development (AUTH_BYPASS).
 * Shape matches server safeUser() / client normalizeSessionUser().
 */
export function createDevBypassUser(overrides = {}) {
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  return {
    id: DEV_BYPASS_USER_ID,
    name: 'Dev User',
    email: 'dev@localhost',
    verified: true,
    plan: 'pro',
    subscriptionExp: Date.now() + yearMs,
    role: 'admin',
    accessLevel: 'basic',
    banned: false,
    uiLanguage: 'ru',
    photo_url: null,
    test_token: null,
    authMethod: 'dev_bypass',
    ...overrides,
  };
}

export const DEV_BYPASS_USER = Object.freeze(createDevBypassUser());
