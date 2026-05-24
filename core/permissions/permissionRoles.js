/**
 * Bot permission roles — admin / moderator / user (hierarchy).
 */

export const BOT_ROLES = Object.freeze(['admin', 'moderator', 'user']);

export const ROLE_RANK = Object.freeze({
  admin: 3,
  moderator: 2,
  user: 1,
});

/** @param {string} role */
export function normalizeBotRole(role) {
  const r = String(role || '').trim().toLowerCase();
  return BOT_ROLES.includes(r) ? r : null;
}

/**
 * @param {string} spec comma/space separated or single role
 * @returns {string[]}
 */
export function parseRoleList(spec) {
  const raw = String(spec ?? '').trim();
  if (!raw) return ['user'];
  const parts = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const n = normalizeBotRole(p);
    if (n && !out.includes(n)) out.push(n);
  }
  return out.length ? out : ['user'];
}

/**
 * Expand minimum role to all roles that satisfy hierarchy (inclusive).
 * @param {string} minRole
 * @returns {string[]}
 */
export function expandRoleRequirement(minRole) {
  const base = normalizeBotRole(minRole) || 'user';
  const minRank = ROLE_RANK[base] || 1;
  return BOT_ROLES.filter((r) => ROLE_RANK[r] >= minRank);
}

/**
 * @param {Record<string, unknown>} props
 * @returns {{ allowedRoles: string[], denyMessage: string }}
 */
export function parseRequireRoleProps(props) {
  const p = props && typeof props === 'object' ? props : {};
  const explicit = String(p.roles ?? '').trim();
  const allowedRoles = explicit
    ? parseRoleList(explicit)
    : expandRoleRequirement(String(p.role ?? 'user'));
  const denyMessage = String(
    p.message ?? p.deny_message ?? p.denyMessage ?? 'Недостаточно прав',
  ).trim();
  return { allowedRoles, denyMessage };
}

/**
 * @param {Record<string, unknown>} props
 * @returns {string | null} validation error
 */
export function validateRequireRoleProps(props) {
  const p = props && typeof props === 'object' ? props : {};
  const explicit = String(p.roles ?? '').trim();
  if (explicit) {
    const parts = explicit.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (!normalizeBotRole(part)) {
        return `Неизвестная роль «${part}». Допустимо: ${BOT_ROLES.join(', ')}`;
      }
    }
    return null;
  }
  const single = String(p.role ?? '').trim();
  if (single && !normalizeBotRole(single)) {
    return `Неизвестная роль «${single}». Допустимо: ${BOT_ROLES.join(', ')}`;
  }
  return null;
}

/** @param {string} userRole @param {readonly string[]} allowedRoles */
export function isRoleAllowed(userRole, allowedRoles) {
  const u = normalizeBotRole(userRole) || 'user';
  const allowed = new Set(
    (allowedRoles || []).map((r) => normalizeBotRole(r)).filter(Boolean),
  );
  return allowed.has(u);
}
