/**
 * Validate programmatic composition edges against ephemeral GraphDocument state.
 */

import { createGraphDocument } from './graph_document.js';
import { validateConnectionRequest } from './graph_structural_audit.js';
import { logGraphTelemetry } from './graph_telemetry.js';

/**
 * Build validation document from stack projection + pending edges.
 * @param {object[]} stacks
 * @param {object[]} [pendingEdges]
 */
export function stacksToValidationDocument(stacks = [], pendingEdges = []) {
  const nodes = [];
  const edges = [...(pendingEdges || [])];
  for (const stack of stacks || []) {
    const blocks = stack?.blocks || [];
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      nodes.push({
        id: String(block.id),
        type: block.type || 'message',
        position: { x: stack.x ?? 120, y: (stack.y ?? 120) + i * 112 },
        data: { ...(block.props || {}) },
      });
      if (i > 0) {
        const prevId = String(blocks[i - 1]?.id || '');
        edges.push({
          id: `edge_${prevId}_${block.id}`,
          source: prevId,
          target: String(block.id),
          sourcePort: 'flow',
          targetPort: 'flow',
        });
      }
    }
  }
  return createGraphDocument({ nodes, edges });
}

/**
 * @returns {{ ok: true } | { ok: false, reason: string, telemetry?: object }}
 */
export function validateCompositionEdge(stacks, edgePayload, meta = {}) {
  const pending = [{
    id: edgePayload.edgeId || `edge_${edgePayload.source}_${edgePayload.target}`,
    source: edgePayload.source,
    target: edgePayload.target,
    sourcePort: edgePayload.sourcePort || 'flow',
    targetPort: edgePayload.targetPort || 'flow',
  }];
  const doc = stacksToValidationDocument(stacks, pending);
  const check = validateConnectionRequest(doc, {
    source: edgePayload.source,
    target: edgePayload.target,
    sourcePort: edgePayload.sourcePort || 'flow',
    targetPort: edgePayload.targetPort || 'flow',
  });
  if (!check.ok) {
    const telemetry = logGraphTelemetry('composition_edge_rejected', {
      ...meta,
      source: edgePayload.source,
      target: edgePayload.target,
      reason: check.reason,
    });
    return { ok: false, reason: check.reason, telemetry };
  }
  logGraphTelemetry('composition_edge_accepted', {
    ...meta,
    source: edgePayload.source,
    target: edgePayload.target,
  });
  return { ok: true };
}
