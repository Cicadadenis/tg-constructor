/**
 * require_role → aiogram middleware + handler guards (ctx.vars._role).
 */

import { pyQuote, pyIndent } from './utils.js';
import {
  parseRequireRoleProps,
  validateRequireRoleProps,
} from '../permissions/permissionRoles.js';

/** Runtime: role store + middleware + checks. */
export function emitPermissionMiddlewareRuntime() {
  return [
    'ROLE_RANK: dict[str, int] = {"user": 1, "moderator": 2, "admin": 3}',
    'BOT_ROLES: tuple[str, ...] = ("admin", "moderator", "user")',
    '_ROLE_STORE: dict[int, str] = {}',
    '',
    'async def resolve_user_role(user_id: int | None) -> str:',
    '    if user_id is None:',
    '        return "user"',
    '    return _ROLE_STORE.get(int(user_id), "user")',
    '',
    'def user_has_required_role(ctx: dict, allowed_roles: tuple[str, ...]) -> bool:',
    '    role = str(ctx.get("vars", {}).get("_role", "user")).lower()',
    '    return role in allowed_roles',
    '',
    'from aiogram import BaseMiddleware',
    '',
    'class RolePermissionMiddleware(BaseMiddleware):',
    '    async def __call__(self, handler, event, data):',
    '        user = getattr(event, "from_user", None)',
    '        if user is None and isinstance(event, CallbackQuery):',
    '            user = event.from_user',
    '        uid = int(user.id) if user else None',
    '        data["user_role"] = await resolve_user_role(uid)',
    '        return await handler(event, data)',
    '',
  ].join('\n');
}

export function emitPermissionMiddlewareRegistration() {
  return [
    'router.message.middleware(RolePermissionMiddleware())',
    'router.callback_query.middleware(RolePermissionMiddleware())',
  ].join('\n');
}

/** Sync ctx.vars._role from middleware data (after build_runtime_ctx). */
export function emitCtxRoleFromMiddleware(indent = 1) {
  const ind = pyIndent(indent);
  return `${ind}ctx_set_var(ctx, "_role", data.get("user_role", "user"))`;
}

/**
 * @param {object} block
 * @param {{ indent?: number, inCallbackHandler?: boolean }} ctx
 */
export function compileRequireRole(block, ctx = {}) {
  const err = validateRequireRoleProps(block?.props);
  if (err) {
    return `${pyIndent(ctx.indent ?? 0)}# require_role: ${err}`;
  }
  const { allowedRoles, denyMessage } = parseRequireRoleProps(block?.props || {});
  const ind = pyIndent(ctx.indent ?? 0);
  const allowedPy = `(${allowedRoles.map((r) => pyQuote(r)).join(', ')})`;
  const target = ctx.inCallbackHandler ? 'callback.message' : 'message';
  const msg = pyQuote(denyMessage);
  return [
    `${ind}if not user_has_required_role(ctx, ${allowedPy}):`,
    `${ind}    await ${target}.answer(${msg})`,
    `${ind}    return`,
  ].join('\n');
}

export { validateRequireRoleProps };

/** @param {object[]} stacks */
export function stackHasRequireRole(stacks) {
  for (const stack of stacks || []) {
    for (const b of stack?.blocks || []) {
      if (b?.type === 'require_role') return true;
    }
  }
  return false;
}

/** @param {object[]} stacks @returns {string[]} */
export function collectRequireRoleIssues(stacks) {
  const issues = [];
  for (const stack of stacks || []) {
    for (const b of stack?.blocks || []) {
      if (b?.type !== 'require_role') continue;
      const err = validateRequireRoleProps(b?.props);
      if (err) {
        issues.push({
          code: 'INVALID_REQUIRE_ROLE',
          message: err,
          nodeId: b.id,
          blockType: 'require_role',
        });
      }
    }
  }
  return issues;
}
