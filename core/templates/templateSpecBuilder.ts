/**
 * Helpers for building system template GraphDocument specs.
 */

import type { GraphDocumentEdgeInput, GraphDocumentNodeInput } from "../ir/bot_ir.js";
import type { SystemTemplateId, SystemTemplateSpec, TemplateNodeLayout } from "./templateTypes.js";

let edgeSeq = 0;

export function resetTemplateSpecBuilder() {
  edgeSeq = 0;
}

export function tplNode(
  id: string,
  type: string,
  data: Record<string, unknown>,
  layout: TemplateNodeLayout,
): GraphDocumentNodeInput {
  return {
    id,
    type,
    position: { x: layout.x, y: layout.y },
    data: { ...data },
  };
}

export function tplEdge(
  source: string,
  target: string,
  ports: { sourcePort?: string; targetPort?: string } = {},
): GraphDocumentEdgeInput {
  edgeSeq += 1;
  return {
    id: `e_${source}_${target}_${edgeSeq}`,
    source,
    target,
    sourcePort: ports.sourcePort ?? "flow",
    targetPort: ports.targetPort ?? "flow",
  };
}

export function tplSpec(
  id: SystemTemplateId,
  meta: { title: string; description: string; tags?: string[] },
  nodes: GraphDocumentNodeInput[],
  edges: GraphDocumentEdgeInput[],
): SystemTemplateSpec {
  return {
    schema_version: 2,
    viewport: { x: 0, y: 0, zoom: 1 },
    metadata: {
      systemTemplate: id,
      title: meta.title,
      description: meta.description,
      tags: meta.tags ?? [],
      templateVersion: "1.0",
      nodePositions: Object.fromEntries(
        nodes.map((n) => [n.id, { ...(n.position || { x: 0, y: 0 }) }]),
      ),
    },
    nodes,
    edges,
  };
}
