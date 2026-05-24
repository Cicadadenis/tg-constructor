/**
 * Visual DB nodes → sqlite + aiogram async snippets.
 */

import { compileVisualDbNodeViaCapability } from './dbCapabilityCodegen.js';

const DB_NODE_TYPES = new Set([
  'db.get',
  'db.set',
  'db.query',
  'db.insert',
  'db.update',
]);

/** @param {string} type */
function isDbNodeType(type) {
  return DB_NODE_TYPES.has(String(type || '').trim());
}

function pyQuote(s) {
  return JSON.stringify(String(s ?? ''));
}

function pyIndent(n) {
  return '    '.repeat(Math.max(0, n || 0));
}

function escapePyKey(key) {
  const raw = String(key || 'var').trim();
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw) ? raw : `_${raw.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function normalizeBlockToVisualDb(block) {
  const payload = block?.props && typeof block.props === 'object' ? block.props : {};
  const type = String(block?.type || '').trim();
  if (!isDbNodeType(type)) return null;

  switch (type) {
    case 'db.get':
      return {
        id: block.id,
        type,
        key: String(payload.key ?? payload.name ?? block.id),
        varname: String(payload.varname ?? payload.var ?? 'value'),
        table: String(payload.table || 'kv_store'),
        payload,
      };
    case 'db.set':
      return {
        id: block.id,
        type,
        key: String(payload.key ?? payload.name ?? block.id),
        table: String(payload.table || 'kv_store'),
        values: payload.value !== undefined ? { value: payload.value } : { ...payload.values },
        payload,
      };
    case 'db.query':
      return {
        id: block.id,
        type,
        sql: String(payload.sql ?? payload.query ?? ''),
        varname: String(payload.varname ?? payload.var ?? 'rows'),
        payload,
      };
    case 'db.insert':
      return {
        id: block.id,
        type,
        table: String(payload.table || 'records'),
        values: { ...(payload.values || payload.row || {}) },
        payload,
      };
    case 'db.update':
      return {
        id: block.id,
        type,
        table: String(payload.table || 'records'),
        where: String(payload.where ?? payload.condition ?? '1=1'),
        values: { ...(payload.values || payload.set || {}) },
        payload,
      };
    default:
      return null;
  }
}

/**
 * SQLite runtime helpers injected once per generated bot module.
 */
export function emitSqliteDbRuntime() {
  return [
    'import aiosqlite',
    '',
    'DB_PATH = "bot_data.sqlite"',
    '',
    'async def _db_connect():',
    '    return await aiosqlite.connect(DB_PATH)',
    '',
    'async def db_get(key: str, default=None):',
    '    async with await _db_connect() as db:',
    '        await db.execute(',
    '            "CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)"',
    '        )',
    '        cur = await db.execute("SELECT value FROM kv_store WHERE key = ?", (key,))',
    '        row = await cur.fetchone()',
    '        await db.commit()',
    '    return row[0] if row else default',
    '',
    'async def db_set(key: str, value):',
    '    async with await _db_connect() as db:',
    '        await db.execute(',
    '            "CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)"',
    '        )',
    '        await db.execute(',
    '            "INSERT INTO kv_store(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",',
    '            (key, str(value)),',
    '        )',
    '        await db.commit()',
    '',
    'async def db_query(sql: str, params=()):',
    '    async with await _db_connect() as db:',
    '        cur = await db.execute(sql, params)',
    '        rows = await cur.fetchall()',
    '        await db.commit()',
    '    return rows',
    '',
    'async def db_insert(table: str, columns: list, values: list):',
    '    cols = ", ".join(columns)',
    '    placeholders = ", ".join("?" for _ in values)',
    '    sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"',
    '    async with await _db_connect() as db:',
    '        await db.execute(sql, values)',
    '        await db.commit()',
    '',
    'async def db_update(table: str, set_clause: str, where_clause: str, params=()):',
    '    sql = f"UPDATE {table} SET {set_clause} WHERE {where_clause}"',
    '    async with await _db_connect() as db:',
    '        await db.execute(sql, params)',
    '        await db.commit()',
    '',
  ].join('\n');
}

/**
 * @param {import('./visual_db_ir.ts').VisualDbGraph} graph
 */
export function emitVisualDbManifest(graph) {
  if (!graph?.nodes?.length) return '';
  const lines = ['# --- Visual DB IR ---'];
  for (const node of graph.nodes) {
    lines.push(
      `# DB ${node.type} ${node.id} table=${node.table ?? '-'} key=${node.key ?? '-'}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * @param {import('./visual_db_ir.ts').VisualDbNode} node
 * @param {{ indent?: number }} [ctx]
 */
export function compileVisualDbNode(node, ctx = {}) {
  return compileVisualDbNodeViaCapability(node, ctx);
}

export function compileDbBlock(block, ctx = {}) {
  const normalized = normalizeBlockToVisualDb({
    id: block?.id || 'db',
    type: block?.type,
    props: block?.props,
  });
  if (!normalized) return '';
  return compileVisualDbNode(normalized, ctx);
}

export function compileDbGet(block, ctx) {
  return compileDbBlock({ ...block, type: 'db.get' }, ctx);
}
export function compileDbSet(block, ctx) {
  return compileDbBlock({ ...block, type: 'db.set' }, ctx);
}
export function compileDbQuery(block, ctx) {
  return compileDbBlock({ ...block, type: 'db.query' }, ctx);
}
export function compileDbInsert(block, ctx) {
  return compileDbBlock({ ...block, type: 'db.insert' }, ctx);
}
export function compileDbUpdate(block, ctx) {
  return compileDbBlock({ ...block, type: 'db.update' }, ctx);
}

export function stackHasVisualDb(stacks) {
  for (const stack of stacks || []) {
    for (const b of stack?.blocks || []) {
      if (isDbNodeType(b?.type)) return true;
    }
  }
  return false;
}
