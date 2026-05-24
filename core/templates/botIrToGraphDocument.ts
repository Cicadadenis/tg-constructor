/**
 * Bot IR → GraphDocument (editor / compile pipeline input).
 */

import type { BotIRGraph } from "../ir/bot_ir.js";
import type { GraphDocumentInput } from "../ir/bot_ir.js";
import type { TemplateNodeLayout } from "./templateTypes.js";

function layoutFromMetadata(
  ir: BotIRGraph,
  nodeId: string,
  index: number,
): TemplateNodeLayout {
  const positions = ir.context.metadata?.nodePositions;
  if (
    positions &&
    typeof positions === "object" &&
    nodeId in (positions as Record<string, TemplateNodeLayout>)
  ) {
    const pos = (positions as Record<string, TemplateNodeLayout>)[nodeId];
    if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
      return { x: pos.x, y: pos.y };
    }
  }
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: col * 280, y: row * 140 };
}

/**
 * Project Bot IR nodes/edges back to a GraphDocument seed (positions from metadata or grid).
 */
export function botIRToGraphDocument(ir: BotIRGraph): GraphDocumentInput {
  const templateId = ir.context.metadata?.systemTemplate;
  return {
    schema_version: ir.context.schemaVersion,
    viewport: { ...ir.context.viewport },
    metadata: {
      ...ir.context.metadata,
      generatedFrom: "bot_ir",
      ...(templateId ? { systemTemplate: templateId } : {}),
    },
    nodes: ir.nodes.map((node, index) => {
      const layout = layoutFromMetadata(ir, node.id, index);
      return {
        id: node.id,
        type: node.type,
        position: layout,
        data: { ...node.payload },
      };
    }),
    edges: ir.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      ...(edge.label ? { label: edge.label } : {}),
      ...(edge.condition ? { condition: edge.condition } : {}),
      ...(edge.invalid ? { invalid: true } : {}),
      ...(edge.invalidReason ? { invalidReason: edge.invalidReason } : {}),
    })),
  };
}
