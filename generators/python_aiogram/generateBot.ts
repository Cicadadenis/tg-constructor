import type { ExecutionGraph } from "../../core/execution/executionContract";
import {
  DEFAULT_EXECUTION_POLICY,
  type ExecutionPolicy,
} from "../../core/execution/executionPolicy";
import { sortEdges } from "../../core/execution/executionContract";

function formatEdgeLine(edge: {
  from: string;
  to: string;
  trigger: string;
  condition?: string;
}): string {
  const condition =
    edge.condition !== undefined && edge.condition !== ""
      ? `:${edge.condition}`
      : "";
  return `# EDGE: ${edge.from} -> ${edge.to} [${edge.trigger}${condition}]`;
}

/**
 * Generate aiogram scaffold from prepared ExecutionGraph edges only.
 * Expects graph that already passed prepareExecutionGraph.
 */
export function generateAiogramBot(
  execution: ExecutionGraph,
  _policy: ExecutionPolicy = DEFAULT_EXECUTION_POLICY,
): string {
  const edgeManifest = sortEdges(execution.edges)
    .map(formatEdgeLine)
    .join("\n");

  return `# EXECUTION GRAPH VERSION: ${execution.version}

from aiogram import Router

router = Router()

# --- execution graph (source of truth) ---
${edgeManifest || "# (no edges)"}
`;
}
