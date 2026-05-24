/**
 * Unified runtime ctx — Python helpers and handler preamble.
 * ctx = { user, message, callback, state, vars: {} }
 */

import { pyQuote, pyIndent, escapePyKey } from './utils.js';

/** Runtime helpers injected once per generated bot module. */
export function emitRuntimeContextRuntime() {
  return [
    'def build_runtime_ctx(',
    '    message=None,',
    '    callback=None,',
    '    state=None,',
    ') -> dict:',
    '    user = None',
    '    if callback is not None and getattr(callback, "from_user", None):',
    '        user = callback.from_user',
    '    elif message is not None and getattr(message, "from_user", None):',
    '        user = message.from_user',
    '    return {',
    '        "user": user,',
    '        "message": message,',
    '        "callback": callback,',
    '        "state": state,',
    '        "vars": dict(_RUNTIME_CTX_DEFAULTS),',
    '    }',
    '',
    'def ctx_set_var(ctx: dict, name: str, value) -> None:',
    '    ctx["vars"][str(name)] = value',
    '',
    'def ctx_get_var(ctx: dict, name: str, default=None):',
    '    return ctx["vars"].get(str(name), default)',
    '',
    'async def ctx_sync_state_key(ctx: dict, key: str, varname: str | None = None) -> None:',
    '    st = ctx.get("state")',
    '    if st is None:',
    '        return',
    '    data = await st.get_data()',
    '    value = data.get(str(key))',
    '    target = str(varname) if varname else str(key)',
    '    ctx["vars"][target] = value',
    '',
    'async def ctx_persist_state_key(ctx: dict, key: str, value) -> None:',
    '    st = ctx.get("state")',
    '    if st is None:',
    '        return',
    '    await st.update_data(**{str(key): value})',
    '    ctx["vars"][str(key)] = value',
    '',
  ].join('\n');
}

/**
 * @param {Record<string, string>} defaults Python expr per var name
 */
export function emitRuntimeContextDefaults(defaults) {
  if (!defaults || !Object.keys(defaults).length) {
    return '_RUNTIME_CTX_DEFAULTS: dict = {}\n';
  }
  const lines = ['_RUNTIME_CTX_DEFAULTS: dict = {'];
  for (const [name, expr] of Object.entries(defaults)) {
    lines.push(`    ${pyQuote(name)}: ${expr},`);
  }
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {boolean} isCallback
 * @param {number} indent
 */
export function emitHandlerContextPreamble(isCallback, indent = 1) {
  const ind = pyIndent(indent);
  if (isCallback) {
    return [
      `${ind}ctx = build_runtime_ctx(`,
      `${ind}    message=callback.message,`,
      `${ind}    callback=callback,`,
      `${ind}    state=state,`,
      `${ind})`,
    ].join('\n');
  }
  return `${ind}ctx = build_runtime_ctx(message=message, callback=None, state=state)`;
}

/**
 * @param {string} name
 * @param {string} valueExpr already transpiled Python expr
 * @param {number} indent
 */
export function emitCtxSetVar(name, valueExpr, indent = 0) {
  const ind = pyIndent(indent);
  return `${ind}ctx_set_var(ctx, ${pyQuote(String(name).trim())}, ${valueExpr})`;
}

/**
 * @param {string} name
 * @param {string} targetVar python ident to assign
 * @param {number} indent
 */
export function emitCtxGetVar(name, targetVar, indent = 0) {
  const ind = pyIndent(indent);
  const target = escapePyKey(targetVar || name);
  return `${ind}${target} = ctx_get_var(ctx, ${pyQuote(String(name).trim())})`;
}

/**
 * Local aliases for DSL / conditions: `name = ctx_get_var(ctx, "name")`
 * @param {string[]} names
 * @param {number} indent
 */
export function emitCtxLocalAliases(names, indent = 0) {
  const ind = pyIndent(indent);
  const unique = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))];
  return unique.map((name) => emitCtxGetVar(name, name, indent)).join('\n');
}
