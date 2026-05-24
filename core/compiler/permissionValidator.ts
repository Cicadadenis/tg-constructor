import { validateRequireRoleProps } from "../permissions/permissionRoles.js";

export function validatePermissionNodes(nodes: Array<{ id?: string; type?: string; data?: Record<string, unknown> }>) {
  const errors: Array<{ nodeId: string; message: string }> = [];

  for (const node of nodes || []) {
    if (String(node?.type || "").trim() !== "require_role") continue;
    const payload =
      node.data && typeof node.data === "object" ? node.data : {};
    const err = validateRequireRoleProps(payload);
    if (err) {
      errors.push({
        nodeId: String(node.id || "require_role"),
        message: err,
      });
    }
  }

  return errors;
}
