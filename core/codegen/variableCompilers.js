/**
 * set_variable / get_variable and ctx-backed legacy variable blocks.
 */

import { pyQuote, pyIndent, escapePyKey } from './utils.js';
import {
  emitCtxSetVar,
  emitCtxGetVar,
} from './runtimeContextCodegen.js';

function dslRhsToPython(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'None';
  if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  if (raw.toLowerCase() === 'true') return 'True';
  if (raw.toLowerCase() === 'false') return 'False';
  if (raw === '[]' || raw === '{}') return raw;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw;
  }
  if (/^[\w\u0400-\u04FF][\w\u0400-\u04FF.]*$/.test(raw)) return raw;
  return pyQuote(raw);
}

export function compileSetVariable(block, ctx) {
  const p = block?.props || {};
  const name = String(p.name ?? p.varname ?? p.key ?? 'var').trim();
  const value = dslRhsToPython(p.value);
  return emitCtxSetVar(name, value, ctx?.indent ?? 0);
}

export function compileGetVariable(block, ctx) {
  const p = block?.props || {};
  const name = String(p.name ?? p.key ?? '').trim();
  const target = escapePyKey(String(p.varname ?? p.name ?? (name || 'var')));
  const ind = pyIndent(ctx?.indent ?? 0);
  if (!name) {
    return `${ind}# get_variable: missing name`;
  }
  return emitCtxGetVar(name, target, ctx?.indent ?? 0);
}

/** Legacy remember → ctx.vars */
export function compileRememberCtx(block, ctx) {
  const p = block?.props || {};
  const name = String(p.varname ?? p.name ?? 'var').trim();
  const value = dslRhsToPython(p.value);
  return emitCtxSetVar(name, value, ctx?.indent ?? 0);
}

/** Legacy get (FSM) → sync into ctx.vars */
export function compileGetCtx(block, ctx) {
  const p = block?.props || {};
  const key = String(p.key ?? '').trim();
  const varname = String(p.varname ?? key ?? 'var').trim();
  const ind = pyIndent(ctx?.indent ?? 0);
  if (!key) {
    return `${ind}# get: missing key`;
  }
  return [
    `${ind}await ctx_sync_state_key(ctx, ${pyQuote(key)}, ${pyQuote(varname)})`,
    emitCtxGetVar(varname, varname, ctx?.indent ?? 0),
  ].join('\n');
}

/** Legacy save → ctx.vars + FSM */
export function compileSaveCtx(block, ctx) {
  const p = block?.props || {};
  const key = String(p.key ?? '').trim();
  const value = dslRhsToPython(p.value);
  const ind = pyIndent(ctx?.indent ?? 0);
  return `${ind}await ctx_persist_state_key(ctx, ${pyQuote(key)}, ${value})`;
}

/** Legacy set_global / save_global → ctx.vars only */
export function compileSetGlobalCtx(block, ctx) {
  const p = block?.props || {};
  const name = String(p.varname ?? p.name ?? p.key ?? 'var').trim();
  const value = dslRhsToPython(p.value);
  return emitCtxSetVar(name, value, ctx?.indent ?? 0);
}

export function compileSaveGlobalCtx(block, ctx) {
  const p = block?.props || {};
  const key = String(p.key ?? p.varname ?? '').trim();
  const value = dslRhsToPython(p.value);
  return emitCtxSetVar(key, value, ctx?.indent ?? 0);
}
