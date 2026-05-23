/**
 * Canvas projection — render GraphDocument; never own authoritative graph state.
 */

import { hasIncomingFlowEdge } from '../../builder/blockLayout.js';
import { getCicadaNodeLayout } from '../../builder/graph_canvas_metrics.js';
import { projectionNodesSignature } from './projection_signature.js';
import { getBlockDef, getPaletteBlockTypes } from '../../constructor/block_catalog.js';
import { createGraphDocument } from './graph_document.js';
import { createOperation } from './graph_operations.js';
import { countKeyboardButtons, findKeyboardNodeForOwner } from './graph_keyboard_nodes.js';

/**
 * Project canonical document into canvas-friendly nodes/edges (read-only view).
 */
export function projectGraphDocumentToCanvas(document) {
  const doc = createGraphDocument(document);
  const nodes = Object.freeze(
    Object.values(doc.nodes).map((node) => {
        const def = getBlockDef(node.type, getPaletteBlockTypes());
        const isChainRoot = !hasIncomingFlowEdge(doc, node.id);
        const kbNode = findKeyboardNodeForOwner(doc, node.id);
        const keyboardButtonCount = kbNode ? countKeyboardButtons(kbNode.data) : 0;
        const isKb = node.type === 'inline_keyboard' || node.type === 'reply_keyboard';
        const kbExtraH = isKb && keyboardButtonCount > 2
          ? Math.max(0, Math.ceil(keyboardButtonCount / 2) - 1) * 14
          : 0;
        const layout = getCicadaNodeLayout(node.type, isChainRoot, true, kbExtraH);
        return {
          id: node.id,
          type: 'cicada',
          position: { ...node.position },
          width: layout.hitW,
          height: layout.hitH,
          className: 'cicada-node',
          selectable: true,
          focusable: true,
          dragHandle: '.cicada-node-hit',
          data: {
            type: node.type,
            props: { ...node.data },
            meta: {
              ...node.meta,
              keyboardButtonCount,
              keyboardNodeId: kbNode?.id || null,
            },
            label: def?.label || node.type,
            isChainRoot,
            graphDocumentNodeId: node.id,
          },
          selected: (doc.ui_state.selection || []).includes(node.id),
        };
      }),
  );

  return Object.freeze({
    nodes,
    previewSignature: projectionNodesSignature(nodes),
    edges: Object.freeze(
      Object.values(doc.edges).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourcePort,
        targetHandle: edge.targetPort,
        sourcePort: edge.sourcePort,
        targetPort: edge.targetPort,
        label: edge.label,
        condition: edge.condition,
        animated: Boolean(edge.invalid),
        style: edge.invalid
          ? { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '6 4' }
          : undefined,
        data: {
          condition: edge.condition,
          invalid: Boolean(edge.invalid),
          invalidReason: edge.invalidReason || null,
        },
      })),
    ),
    diagnostics: Object.freeze({
      danglingEdgeCount: Object.values(doc.edges).filter((e) => e.invalid).length,
      hydration: doc.metadata?.hydrationDiagnostics || null,
    }),
    viewport: Object.freeze({ ...doc.viewport }),
    groups: Object.freeze([...(doc.ui_state.groups || [])]),
    schema_version: doc.schema_version,
    metadata: Object.freeze({ ...doc.metadata }),
  });
  // DEBUG: helpful to inspect what edges the projection exposes
  // Note: left intentionally verbose for debugging sessions
  // console.log('[projectGraphDocumentToCanvas] projection edges', Object.values(doc.edges).map(e=>({id:e.id,source:e.source,target:e.target,sourcePort:e.sourcePort,targetPort:e.targetPort})));
}

/**
 * Map canvas interaction events to graph operations (no direct graph mutation).
 */
export function canvasEventToOperation(event) {
  const kind = event?.kind || event?.type;
  switch (kind) {
    case 'node_add':
    case 'add_node':
      return createOperation('AddNode', {
        nodeId: event.nodeId,
        type: event.blockType || event.nodeType,
        position: event.position,
        data: event.data || event.props,
      });
    case 'node_delete':
    case 'delete_node':
      return createOperation('RemoveNode', { nodeId: event.nodeId });
    case 'node_move':
    case 'move_node':
      return createOperation('MoveNode', { nodeId: event.nodeId, position: event.position });
    case 'edge_connect':
    case 'connect':
      return createOperation('AddEdge', {
        edgeId: event.edgeId,
        source: event.source,
        target: event.target,
        sourcePort: event.sourcePort || event.sourceHandle,
        targetPort: event.targetPort || event.targetHandle,
        label: event.label,
        condition: event.condition,
      });
    case 'edge_disconnect':
    case 'disconnect':
      return createOperation('RemoveEdge', { edgeId: event.edgeId });
    case 'node_data':
    case 'update_data':
      return createOperation('UpdateNodeData', {
        nodeId: event.nodeId,
        data: event.data || event.patch,
      });
    case 'edge_condition':
    case 'update_condition':
      return createOperation('UpdateEdge', {
        edgeId: event.edgeId,
        condition: event.condition,
        label: event.label,
      });
    case 'group_selection':
      return createOperation('GroupSelection', {
        groupId: event.groupId,
        nodeIds: event.nodeIds,
        label: event.label,
      });
    default:
      throw new Error(`Unknown canvas event kind: ${kind}`);
  }
}
