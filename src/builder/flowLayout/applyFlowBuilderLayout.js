/**
 * Apply deterministic flow layout to a live graph editor.
 */

import { moveNode } from '../../constructor/graph_document/graph_operation_client.js';
import { readLayoutModeFromMetadata } from './flowLayoutModes.js';
import { computeFlowBuilderPositions } from './flowBuilderLayout.js';

/**
 * @param {object} graph — graph editor API
 * @param {string} [modeOverride]
 * @returns {{ ok: boolean, moved: number, mode: string }}
 */
export function applyFlowBuilderLayout(graph, modeOverride) {
  const doc = graph.getGraphDocument();
  const mode = modeOverride != null
    ? String(modeOverride)
    : readLayoutModeFromMetadata(doc.metadata);

  const { positions } = computeFlowBuilderPositions(doc, mode);
  let moved = 0;

  for (const [nodeId, pos] of positions) {
    const current = doc.nodes[nodeId]?.position;
    const cx = Number(current?.x ?? 0);
    const cy = Number(current?.y ?? 0);
    if (Math.abs(cx - pos.x) > 0.5 || Math.abs(cy - pos.y) > 0.5) {
      moveNode(graph, nodeId, pos);
      moved += 1;
    }
  }

  return { ok: true, moved, mode };
}
