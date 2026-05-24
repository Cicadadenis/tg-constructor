import type { ExecutionGraph } from "../../core/execution/executionContract";
import { resolveNodeCapability } from "../../core/capabilities/resolveNodeCapability.js";
import {
  DEFAULT_EXECUTION_POLICY,
  type ExecutionPolicy,
} from "../../core/execution/executionPolicy";
import { sortEdges } from "../../core/execution/executionContract";
import { buildFsmGraph } from "../../core/execution/fsmGraph";
import { buildVisualDbGraphFromBotNodes } from "../../core/db/visual_db_ir";
import {
  emitSqliteDbRuntime,
  emitVisualDbManifest,
} from "../../core/db/dbCodegen.js";
import { generateFsmPython } from "./generateFSM";
import { generateForeachPython } from "./generateForeach";
import { generatePermissionPython } from "./generatePermission";
import { emitRuntimeContextRuntime } from "../../core/codegen/runtimeContextCodegen.js";

function executionNodesToDbSources(execution: ExecutionGraph) {
  return execution.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    payload:
      node.data && typeof node.data === "object"
        ? { ...(node.data as Record<string, unknown>) }
        : {},
  }));
}

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
 * Generate aiogram scaffold from prepared ExecutionGraph.
 * FSM is graph-based (fsm.state / fsm.input / transition edges).
 */
export function generateAiogramBot(
  execution: ExecutionGraph,
  _policy: ExecutionPolicy = DEFAULT_EXECUTION_POLICY,
): string {
  const edgeManifest = sortEdges(execution.edges)
    .map(formatEdgeLine)
    .join("\n");

  const fsmGraph = buildFsmGraph(execution);
  const fsmSection = generateFsmPython(fsmGraph);
  const foreachSection = generateForeachPython(execution);
  const permissionSection = generatePermissionPython(execution);
  const hasHandlers = execution.nodes.some((n) => {
    const caps = resolveNodeCapability(n.type, { nodeId: n.id });
    return (
      caps.triggers.length > 0
      || caps.primaryAction === "route"
      || caps.primaryAction === "send_message"
    );
  });
  const runtimeCtxSection = hasHandlers
    ? `# --- runtime ctx (user, message, callback, state, vars) ---\n${emitRuntimeContextRuntime()}\n`
    : "";
  const visualDb = buildVisualDbGraphFromBotNodes(
    executionNodesToDbSources(execution),
  );
  const dbManifest = emitVisualDbManifest(visualDb);
  const dbRuntime =
    visualDb.nodeCount > 0 ? `\n${emitSqliteDbRuntime()}\n` : "";

  const fsmImports =
    fsmSection.includes("StatesGroup") || fsmSection.includes("State()")
      ? "from aiogram.fsm.state import State, StatesGroup\n"
      : "";

  return `# EXECUTION GRAPH VERSION: ${execution.version}

from aiogram import Router
${fsmImports}
router = Router()

# --- execution graph (source of truth) ---
${edgeManifest || "# (no edges)"}
${runtimeCtxSection}${permissionSection}${dbManifest}${dbRuntime}${foreachSection}${fsmSection ? `\n${fsmSection}` : ""}`;
}
