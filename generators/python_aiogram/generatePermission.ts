import type { ExecutionGraph } from "../../core/execution/executionContract";

/**
 * Manifest comments for require_role nodes in execution scaffold.
 */
export function generatePermissionPython(execution: ExecutionGraph): string {
  const lines: string[] = [];
  for (const node of execution.nodes) {
    if (node.type !== "require_role") continue;
    const data =
      node.data && typeof node.data === "object"
        ? (node.data as Record<string, unknown>)
        : {};
    const role = String(data.role ?? "user");
    const roles = String(data.roles ?? "");
    lines.push(
      `# REQUIRE_ROLE ${node.id} role=${role}${roles ? ` roles=${roles}` : ""}`,
    );
  }
  if (!lines.length) return "";
  return `# --- permissions (admin / moderator / user) ---\n${lines.join("\n")}\n`;
}
