import type { ExecutionGraph } from "../../core/execution/executionContract";

/**
 * Manifest comments for foreach nodes in the execution-graph scaffold.
 */
export function generateForeachPython(execution: ExecutionGraph): string {
  const lines: string[] = [];
  for (const node of execution.nodes) {
    if (node.type !== "foreach") continue;
    const data =
      node.data && typeof node.data === "object"
        ? (node.data as Record<string, unknown>)
        : {};
    const list = String(data.list ?? data.collection ?? "products");
    const item = String(data.var ?? data.item ?? "product");
    const output = String(data.output ?? data.mode ?? "body");
    lines.push(
      `# FOREACH ${node.id} list=${list} item=${item} output=${output}`,
    );
  }
  if (!lines.length) return "";
  return `# --- foreach (list → item context) ---\n${lines.join("\n")}\n`;
}
