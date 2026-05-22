/**
 * GraphDocument ↔ canvas stack view projection.
 * Stack view is UI-only and never a persisted source of truth.
 */

import { KEYBOARD_EDGE_SOURCE_PORT, isGraphKeyboardNode } from '../../../core/keyboard_topology.js';
import { keyboardNodeToStackBlock } from './graph_keyboard_nodes.js';
import { createGraphDocument } from './graph_document.js';
import { graphDocumentToProjectGraph } from './graph_project_bridge.js';

/** Import ad-hoc UI stacks into canonical GraphDocument. */
export function stacksToGraphDocument(stacks = [], options = {}) {
  const nodes = [];
  const edges = [];
  for (const stack of stacks || []) {
    const baseX = Number(stack?.x) || 120;
    const baseY = Number(stack?.y) || 120;
    const blocks = Array.isArray(stack?.blocks) ? stack.blocks : [];
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i] || {};
      const nodeId = String(block.id || `node_${stack.id || 'stack'}_${i}`);
      nodes.push({
        id: nodeId,
        type: block.type || 'message',
        position: { x: baseX, y: baseY + i * 112 },
        data: { ...(block.props || {}) },
        meta: { uiAttachments: block.uiAttachments || {} },
      });
      if (i > 0) {
        const prevId = String(blocks[i - 1]?.id || '');
        if (prevId) {
          edges.push({
            id: `edge_${prevId}_${nodeId}`,
            source: prevId,
            target: nodeId,
            sourcePort: 'flow',
            targetPort: 'flow',
          });
        }
      }
    }
  }
  return createGraphDocument({
    schema_version: 1,
    nodes,
    edges,
    viewport: options.viewport,
    ui_state: options.ui_state || options.ui,
    metadata: options.metadata || { name: 'studio-project', revision: 0 },
  });
}

/**
 * Export GraphDocument to UI stack projection.
 * Supports multi-edge branching by splitting graph into maximal linear segments.
 */
export function graphDocumentToStacks(document) {
  const projectGraph = graphDocumentToProjectGraph(document);
  const nodes = Object.values(projectGraph.nodes || {});
  const edges = Object.values(projectGraph.edges || {});
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map();
  const outgoing = new Map();

  for (const node of nodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }
  for (const edge of edges) {
    incoming.get(edge.target)?.push(edge);
    outgoing.get(edge.source)?.push(edge);
  }
  for (const list of outgoing.values()) {
    list.sort((a, b) => (a.target || '').localeCompare(b.target || ''));
  }

  const claimed = new Set();
  const stacks = [];
  const sortedNodes = [...nodes].sort(
    (a, b) =>
      (a.position?.y || 0) - (b.position?.y || 0) ||
      (a.position?.x || 0) - (b.position?.x || 0) ||
      a.id.localeCompare(b.id),
  );

  const isSegmentStart = (nodeId) => {
    const ins = incoming.get(nodeId) || [];
    if (ins.length !== 1) return true;
    const prevId = ins[0].source;
    const prevOut = outgoing.get(prevId) || [];
    return prevOut.length !== 1;
  };

  const materializeFrom = (startId) => {
    let currentId = startId;
    const blocks = [];
    while (currentId && !claimed.has(currentId)) {
      const node = byId.get(currentId);
      if (!node) break;
      claimed.add(currentId);
      blocks.push({
        id: node.id,
        type: node.type,
        props: node.props || {},
        uiAttachments: node.uiAttachments,
      });

      const kbEdge = (outgoing.get(currentId) || []).find(
        (e) => (e.sourcePort || 'flow') === KEYBOARD_EDGE_SOURCE_PORT,
      );
      if (kbEdge) {
        const kbNode = byId.get(kbEdge.target);
        if (kbNode && isGraphKeyboardNode(kbNode.type) && !claimed.has(kbEdge.target)) {
          claimed.add(kbEdge.target);
          blocks.push(keyboardNodeToStackBlock({
            id: kbNode.id,
            type: kbNode.type,
            data: kbNode.props || {},
          }, document));
        }
      }

      const flowOuts = (outgoing.get(currentId) || []).filter(
        (e) => (e.sourcePort || 'flow') === 'flow',
      );
      if (flowOuts.length !== 1) break;
      const nextId = flowOuts[0].target;
      const nextIn = incoming.get(nextId) || [];
      if (nextIn.length !== 1 || claimed.has(nextId)) break;
      currentId = nextId;
    }
    if (!blocks.length) return;
    const first = byId.get(blocks[0].id);
    stacks.push({
      id: `stack_${blocks[0].id}`,
      x: first?.position?.x || 120,
      y: first?.position?.y || 120,
      blocks,
    });
  };

  for (const node of sortedNodes) {
    if (claimed.has(node.id)) continue;
    if (isSegmentStart(node.id)) materializeFrom(node.id);
  }
  for (const node of sortedNodes) {
    if (!claimed.has(node.id)) materializeFrom(node.id);
  }
  return stacks;
}

