/**
 * Session user shape — single place to validate API/auth responses before UI state.
 */

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> & { id: string } | null}
 */
export function normalizeSessionUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id != null ? String(raw.id).trim() : '';
  if (!id) return null;
  return { ...raw, id };
}

/**
 * @param {unknown} raw
 * @param {string} [message]
 */
export function requireSessionUser(raw, message = 'Сессия пользователя недействительна. Войдите снова.') {
  const user = normalizeSessionUser(raw);
  if (!user) throw new Error(message);
  return user;
}

export function isAuthenticatedUser(user) {
  return normalizeSessionUser(user) != null;
}
