/**
 * GraphDocument permission validation (require_role nodes).
 */

import { validateRequireRoleProps } from '../permissions/permissionRoles.js';

/**
 * @param {object} document GraphDocument
 * @returns {Array<{ code: string, message: string, nodeId?: string, severity: string }>}
 */
export function validateGraphPermissions(document) {
  const diagnostics = [];
  const nodes = document?.nodes && typeof document.nodes === 'object'
    ? Object.values(document.nodes)
    : [];

  for (const node of nodes) {
    if (String(node?.type || '').trim() !== 'require_role') continue;
    const data = node?.data && typeof node.data === 'object' ? node.data : {};
    const err = validateRequireRoleProps(data);
    if (err) {
      diagnostics.push({
        code: 'invalid_require_role',
        severity: 'error',
        message: err,
        nodeId: node.id,
      });
    }
  }

  return diagnostics;
}
