/**
 * Visual DB capabilities — Python emit by db_* action id (no node.type switch).
 */

import { pyIndent, pyQuote, escapePyKey } from '../codegen/utils.js';
import {
  emitCapabilityPython,
  registerCapabilityEmitter,
} from '../codegen/capabilityPythonRegistry.js';
import { CAPABILITY_ACTIONS } from '../capabilities/capabilityIds.ts';

function dbNodePayload(block) {
  const p = block?.payload ?? block?.props ?? block ?? {};
  return p;
}

function emitDbRead(block, ctx = {}) {
  const ind = pyIndent(ctx.indent ?? 0);
  const node = dbNodePayload(block);
  const varname = escapePyKey(node.varname || 'value');
  const key = pyQuote(node.key || node.id);
  return `${ind}${varname} = await db_get(${key})`;
}

function emitDbWrite(block, ctx = {}) {
  const ind = pyIndent(ctx.indent ?? 0);
  const node = dbNodePayload(block);
  const key = pyQuote(node.key || node.id);
  const value = node.value !== undefined ? node.value : '';
  return `${ind}await db_set(${key}, ${pyQuote(String(value))})`;
}

function emitDbQuery(block, ctx = {}) {
  const ind = pyIndent(ctx.indent ?? 0);
  const node = dbNodePayload(block);
  const varname = escapePyKey(node.varname || 'rows');
  const sql = pyQuote(node.sql || 'SELECT 1');
  return `${ind}${varname} = await db_query(${sql})`;
}

function emitDbInsert(block, ctx = {}) {
  const ind = pyIndent(ctx.indent ?? 0);
  const node = dbNodePayload(block);
  const table = pyQuote(node.table || 'records');
  const values = node.values || {};
  const cols = Object.keys(values);
  const vals = cols.map((c) => pyQuote(values[c]));
  return `${ind}await db_insert(${table}, ${pyQuote(cols)}, [${vals.join(', ')}])`;
}

function emitDbUpdate(block, ctx = {}) {
  const ind = pyIndent(ctx.indent ?? 0);
  const node = dbNodePayload(block);
  const table = pyQuote(node.table || 'records');
  const values = node.values || {};
  const setParts = Object.entries(values).map(
    ([k, v]) => `${k} = ${pyQuote(String(v))}`,
  );
  const setClause = setParts.join(', ') || 'value = value';
  const where = node.where || '1=1';
  return `${ind}await db_update(${table}, ${pyQuote(setClause)}, ${pyQuote(where)})`;
}

export function registerDbCapabilityEmitters() {
  registerCapabilityEmitter(CAPABILITY_ACTIONS.DB_READ, emitDbRead);
  registerCapabilityEmitter(CAPABILITY_ACTIONS.DB_WRITE, emitDbWrite);
  registerCapabilityEmitter(CAPABILITY_ACTIONS.DB_QUERY, emitDbQuery);
  registerCapabilityEmitter(CAPABILITY_ACTIONS.DB_INSERT, emitDbInsert);
  registerCapabilityEmitter(CAPABILITY_ACTIONS.DB_UPDATE, emitDbUpdate);
}

/**
 * @param {import('./visual_db_ir.ts').VisualDbNode} node
 * @param {{ indent?: number }} [ctx]
 */
const DB_TYPE_TO_CAPABILITY = Object.freeze({
  'db.get': CAPABILITY_ACTIONS.DB_READ,
  'db.set': CAPABILITY_ACTIONS.DB_WRITE,
  'db.query': CAPABILITY_ACTIONS.DB_QUERY,
  'db.insert': CAPABILITY_ACTIONS.DB_INSERT,
  'db.update': CAPABILITY_ACTIONS.DB_UPDATE,
});

export function compileVisualDbNodeViaCapability(node, ctx = {}) {
  const capabilityId = DB_TYPE_TO_CAPABILITY[node.type];
  if (!capabilityId) {
    throw new Error(`Unknown visual DB node type: ${node.type}`);
  }
  const block = {
    type: node.type,
    id: node.id,
    payload: { ...node.payload, ...node },
    props: { ...node.payload, ...node },
  };
  return emitCapabilityPython(capabilityId, block, ctx);
}
