/**
 * Apply deterministic flow layout to a live graph editor.
 */

import { moveNode } from '../../constructor/graph_document/graph_operation_client.js';
import { readLayoutModeFromMetadata } from './flowLayoutModes.js';
import { computeFlowBuilderPositions } from './flowBuilderLayout.js';
import {
  computeLayoutInWorker,
  shouldUseLayoutWorker,
} from '../../performance/layoutWorkerClient.js';
import { usePerformanceStore } from '../../performance/performanceStore.js';

/**
 * @param {object} graph — graph editor API
 * @param {string} [modeOverride]
 * @returns {Promise<{ ok: boolean, moved: number, mode: string }>}
 */
export async function applyFlowBuilderLayout(graph, modeOverride) {
  const doc = graph.getGraphDocument();
  const mode = modeOverride != null
    ? String(modeOverride)
    : readLayoutModeFromMetadata(doc.metadata);

  const nodeCount = Object.keys(doc.nodes || {}).length;
  const t0 = performance.now();
  let positions;
  let resolvedMode = mode;

  if (shouldUseLayoutWorker(nodeCount)) {
    try {
      const result = await computeLayoutInWorker(doc, mode);
      positions = result.positions;
      resolvedMode = result.mode;
    } catch {
      const fallback = computeFlowBuilderPositions(doc, mode);
      positions = fallback.positions;
      resolvedMode = fallback.mode;
    }
  } else {
    const result = computeFlowBuilderPositions(doc, mode);
    positions = result.positions;
    resolvedMode = result.mode;
  }

  let moved = 0;
  const ops = [];
  for (const [nodeId, pos] of positions) {
    const current = doc.nodes[nodeId]?.position;
    const cx = Number(current?.x ?? 0);
    const cy = Number(current?.y ?? 0);
    if (Math.abs(cx - pos.x) > 0.5 || Math.abs(cy - pos.y) > 0.5) {
      ops.push({ type: 'MoveNode', payload: { nodeId, position: pos } });
      moved += 1;
    }
  }

  if (ops.length && graph.dispatchBatch) {
    graph.dispatchBatch(ops);
  } else {
    for (const op of ops) {
      moveNode(graph, op.payload.nodeId, op.payload.position);
    }
  }

  const layoutMs = Math.round(performance.now() - t0);
  usePerformanceStore.getState().patch({ lastLayoutMs: layoutMs });

  return { ok: true, moved, mode: resolvedMode };
}
