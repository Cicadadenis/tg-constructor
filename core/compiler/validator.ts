import {
  assertBlockCapabilitiesRegistered,
  getBlockCapabilities,
} from "../registry/blockCapabilities.js";
import { validatePermissionNodes } from "./permissionValidator";

export function validateGraph(ast: any) {
  const ids = new Set<string>();

  for (const node of ast.nodes || []) {
    if (!node?.id) {
      throw new Error("ExecutionGraph node is missing id");
    }
    if (ids.has(node.id)) {
      throw new Error("Duplicate node id: " + node.id);
    }

    ids.add(node.id);

    const blockType = String(node?.type || "").trim();
    if (!blockType) {
      throw new Error(`ExecutionGraph node "${node.id}" is missing type`);
    }
    assertBlockCapabilitiesRegistered(blockType);
    const caps = getBlockCapabilities(blockType);
    if (!Array.isArray(caps.outputs)) {
      throw new Error(
        `ExecutionGraph node "${node.id}": invalid capabilities.outputs`,
      );
    }
  }

  const permissionErrors = validatePermissionNodes(ast.nodes || []);
  if (permissionErrors.length) {
    const first = permissionErrors[0];
    throw new Error(
      `Permission validation failed for node "${first.nodeId}": ${first.message}`,
    );
  }

  return true;
}
