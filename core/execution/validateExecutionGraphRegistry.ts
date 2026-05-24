/**
 * Registry enforcement for Execution Graph nodes (fail-fast, no unknown types).
 */

import { assertRegisteredBlockType } from "../../src/constructor/graph_document/graph_node_payload.js";
import { isIntentOnlyNodeType } from "../runtime/execution/executionNodeTypes.mjs";
import {
  assertBlockCapabilitiesRegistered,
  hasBlockCapabilities,
} from "../registry/blockCapabilities.js";
import type { ExecutionGraph } from "./executionContract.js";
import { ExecutionGraphValidationError } from "./validateExecutionGraphCore.js";

export type ExecutionRegistryValidationCode =
  | "UNKNOWN_NODE_TYPE"
  | "UNREGISTERED_CAPABILITY";

export function validateExecutionGraphRegistry(
  execution: ExecutionGraph,
): void {
  for (const node of execution.nodes) {
    const nodeId = String(node.id || "").trim();
    const rawType = String(node.type || "").trim();

    if (isIntentOnlyNodeType(rawType)) {
      throw new ExecutionGraphValidationError(
        "UNKNOWN_NODE_TYPE",
        `Execution node "${nodeId}": intent-only type "${rawType}" cannot reach execution graph`,
        { nodeId, type: rawType },
      );
    }

    try {
      assertRegisteredBlockType(rawType, { nodeId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ExecutionGraphValidationError(
        "UNKNOWN_NODE_TYPE",
        message,
        { nodeId, type: rawType },
      );
    }

    if (!hasBlockCapabilities(rawType)) {
      throw new ExecutionGraphValidationError(
        "UNREGISTERED_CAPABILITY",
        `Execution node "${nodeId}": no capability map for type "${rawType}"`,
        { nodeId, type: rawType },
      );
    }

    try {
      assertBlockCapabilitiesRegistered(rawType);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ExecutionGraphValidationError(
        "UNREGISTERED_CAPABILITY",
        message,
        { nodeId, type: rawType },
      );
    }
  }
}
