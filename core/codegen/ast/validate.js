/**
 * Validated AST — every node type must have a registered compiler.
 */

import { getCompiler } from '../registry.js';
import { AstValidationError } from '../errors.js';
import { ROOT_CHUNK_TYPES, EVENT_HANDLER_TYPES } from '../constants.js';

function walk(nodes, errors, path = '') {
  for (const node of nodes || []) {
    const type = String(node?.type ?? '').trim();
    const id = node?.id || '?';
    const p = path ? `${path}/${id}:${type}` : `${id}:${type}`;

    const needsCompiler =
      !ROOT_CHUNK_TYPES.has(type)
      || type === 'block';

    if (!type) {
      errors.push({ path: p, type: '(missing)', message: 'AST node is missing type' });
      continue;
    }
    if (needsCompiler && !getCompiler(type) && !EVENT_HANDLER_TYPES.has(type) && type !== 'else') {
      errors.push({ path: p, type, message: `Missing compiler for block type: ${type}` });
    }

    if (node.children?.length) walk(node.children, errors, p);
  }
}

/**
 * @param {object[]} astRoots
 * @returns {{ ok: boolean, errors: object[] }}
 */
export function validateNormalizedAst(astRoots) {
  const errors = [];
  walk(astRoots, errors);
  return { ok: errors.length === 0, errors };
}

/**
 * @param {object[]} astRoots
 */
export function assertValidAst(astRoots) {
  const result = validateNormalizedAst(astRoots);
  if (!result.ok) {
    const first = result.errors[0];
    throw new AstValidationError(first.message, { blockType: first.type, nodeId: first.path });
  }
}
