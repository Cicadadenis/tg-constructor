/**
 * ReactFlowCanvas — GraphDocument-native canvas renderer.
 *
 * Invariant: GraphDocument is the ONLY source of truth.
 * This component receives a read-only canvas projection and dispatches
 * graph operations back through the graph editor API.
 * No intermediate stack transforms or derived UI models.
 *
 * Graph semantic layer:
 *  - isValidConnection drives the live drag preview (red-on-invalid)
 *  - onConnect runs validateConnection against the GraphDocument before AddEdge
 *  - onNodeDoubleClick opens the schema-driven inspector
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './graph_canvas.css';
import CicadaNode from '../CicadaNode.jsx';
import { NODE_CLICK_DRAG_THRESHOLD_PX } from './graph_canvas_metrics.js';
import {
  moveNode,
  removeNode,
  addEdge as graphAddEdge,
} from '../constructor/graph_document/graph_operation_client.js';
import {
  canConnect,
  validateConnection,
  getNodePortDescriptors,
  validateGraph,
} from '../constructor/graph_document/operation_registry.js';
import { normalizeConnectionError } from './graph_error_messages.js';


const NODE_TYPES = Object.freeze({ cicada: CicadaNode });

/** Edges exist in GraphDocument; puzzle tabs provide the visual chain. */
const EDGE_DEFAULTS = Object.freeze({
  type: 'straight',
  style: { stroke: 'transparent', strokeWidth: 0 },
  markerEnd: undefined,
  animated: false,
});

const EDGE_INVALID_STYLE = Object.freeze({
  type: 'straight',
  style: { stroke: 'rgba(239,68,68,0.55)', strokeWidth: 1.5, strokeDasharray: '4 4' },
  markerEnd: undefined,
  animated: false,
});

const EDGE_REPAIRED_STYLE = Object.freeze({
  type: 'straight',
  style: { stroke: 'rgba(62,207,142,0.75)', strokeWidth: 2, strokeDasharray: '6 3' },
  markerEnd: undefined,
  animated: true,
});

function applyEdgeDefaults(edges, document, highlight = {}) {
  const repairedIds = new Set(highlight.repairedEdgeIds || []);
  return edges.map((edge) => {
    if (repairedIds.has(edge.id)) {
      return {
        ...EDGE_REPAIRED_STYLE,
        ...edge,
        sourceHandle: edge.sourcePort ?? edge.sourceHandle,
        targetHandle: edge.targetPort ?? edge.targetHandle,
        label: '✓',
        labelStyle: { fill: '#86efac', fontWeight: 700, fontSize: 10 },
      };
    }
    const v = validateConnection(document, {
      source: edge.source,
      target: edge.target,
      // Prefer canonical port names; fall back to legacy handles if present.
      sourcePort: edge.sourcePort ?? edge.sourceHandle,
      targetPort: edge.targetPort ?? edge.targetHandle,
      ignoreEdgeId: edge.id,
    });
    const base = v.ok ? EDGE_DEFAULTS : EDGE_INVALID_STYLE;
    return {
      ...base,
      ...edge,
      // ReactFlow expects `sourceHandle`/`targetHandle` on edge objects
      // for handle connection rendering — populate them from the
      // GraphDocument `sourcePort`/`targetPort` to avoid storing legacy
      // handle fields in the document itself.
      sourceHandle: edge.sourcePort ?? edge.sourceHandle,
      targetHandle: edge.targetPort ?? edge.targetHandle,
      label: v.ok ? '' : (() => {
        const src = document.nodes[edge.source];
        const tgt = document.nodes[edge.target];
        const ux = normalizeConnectionError(v.reason, {
          graphDocument: document,
          source: edge.source,
          target: edge.target,
          sourceType: src?.type,
          targetType: tgt?.type,
        });
        return `⚠ ${ux.title}`;
      })(),
      labelStyle: v.ok
        ? undefined
        : { fill: 'rgba(254,202,202,0.95)', fontWeight: 600, fontSize: 10 },
      labelBgStyle: v.ok
        ? undefined
        : { fill: 'rgba(127,29,29,0.85)' },
    };
  });
}

/**
 * Inner canvas — must be inside a ReactFlowProvider to access useReactFlow.
 */
function GraphFlowInner({
  graph,
  projection,
  selectedBlockId,
  repairHighlightNodeIds = [],
  repairHighlightEdgeIds = [],
  onSelectNode,
  onInspectNode,
  onConnectFeedback,
  onDropPaletteEntry,
  onRequestDeleteNodes,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setViewport, screenToFlowPosition } = useReactFlow();

  const lastRevRef = useRef(null);
  const lastViewportRef = useRef(null);
  const lastNodeCountRef = useRef(0);
  const draggingRef = useRef(false);

  const { fitView } = useReactFlow();

  // Sync projection → ReactFlow state when revision, node count, or preview content changes.
  useEffect(() => {
    const rev = projection?.metadata?.revision;
    const nodeCount = projection?.nodes?.length ?? 0;
    const previewSig = projection?.previewSignature ?? '';
    const syncKey = `${rev ?? ''}:${nodeCount}:${previewSig}`;
    if (syncKey === lastRevRef.current && !draggingRef.current) return;
    lastRevRef.current = syncKey;

    const pulseIds = new Set(repairHighlightNodeIds || []);
    setNodes(
      projection.nodes.map((n) => ({
        ...n,
        selected: n.id === selectedBlockId,
        style: pulseIds.has(n.id)
          ? {
            ...(n.style || {}),
            boxShadow: '0 0 0 2px rgba(62,207,142,0.85), 0 0 24px rgba(62,207,142,0.45)',
            borderRadius: 12,
          }
          : n.style,
        data: {
          ...n.data,
          previewEpoch: rev,
          repairPulse: pulseIds.has(n.id),
        },
      })),
    );
    const doc = graph.getGraphDocument();
    setEdges(applyEdgeDefaults(projection.edges, doc, {
      repairedEdgeIds: repairHighlightEdgeIds,
    }));

    const vp = projection.viewport;
    const last = lastViewportRef.current;
    const viewportChanged =
      !last ||
      Math.abs(last.x - vp.x) > 0.5 ||
      Math.abs(last.y - vp.y) > 0.5 ||
      Math.abs(last.zoom - vp.zoom) > 0.01;

    if (viewportChanged) {
      setViewport(vp, { duration: 300 });
    } else if (nodeCount > 0 && lastNodeCountRef.current === 0) {
      requestAnimationFrame(() => {
        try {
          fitView({ padding: 0.2, duration: 200, maxZoom: 1.2 });
        } catch {
          /* ignore if flow not mounted */
        }
      });
    }
    lastNodeCountRef.current = nodeCount;
  }, [
    projection?.metadata?.revision,
    projection?.nodes?.length,
    projection?.previewSignature,
    selectedBlockId,
    repairHighlightNodeIds,
    repairHighlightEdgeIds,
    setViewport,
    fitView,
    graph,
  ]);

  const onNodeDragStart = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const onNodeDragStop = useCallback(
    (_event, node) => {
      draggingRef.current = false;
      moveNode(graph, node.id, node.position);
    },
    [graph],
  );

  // Live drag preview: forbid invalid connections at the React Flow level.
  const isValidConnection = useCallback(
    (params) => {
      const doc = graph.getGraphDocument();
      const source = doc.nodes[params.source];
      const target = doc.nodes[params.target];
      if (!source || !target) return false;
      const compat = canConnect(
        source.type,
        target.type,
        params.sourceHandle,
        params.targetHandle,
      );
      return compat.ok;
    },
    [graph],
  );

  // Edge creation: dispatch AddEdge after a hard validation pass.
  const onConnect = useCallback(
    (params) => {
      try {
        const doc = graph.getGraphDocument();
        const verdict = validateConnection(doc, {
          source: params.source,
          target: params.target,
          sourcePort: params.sourceHandle,
          targetPort: params.targetHandle,
        });
        if (!verdict.ok) {
          onConnectFeedback?.({ ok: false, reason: verdict.reason, params });
          return;
        }
        const edgeId = `edge_${params.source}_${params.target}_${Date.now()}`;
        const result = graphAddEdge(graph, {
          edgeId,
          source: params.source,
          target: params.target,
          sourcePort: params.sourceHandle || 'flow',
          targetPort: params.targetHandle || 'flow',
        });
        if (!result?.ok) {
          onConnectFeedback?.({ ok: false, reason: result?.error || 'AddEdge rejected', params });
          return;
        }
        // Post-commit integrity — structural only; callback handlers are soft warnings
        try {
          const check = validateGraph(graph.getGraphDocument(), { allowMissingCallbackHandlers: true });
          if (!check.ok) {
            const reason = (check.issues || []).map((i) => i.message).join('; ');
            onConnectFeedback?.({ ok: false, reason: `Graph validation failed: ${reason}`, params });
            return;
          }
        } catch (err) {
          console.warn('[onConnect] graph validate error', err);
        }
        onConnectFeedback?.({ ok: true, params });
      } catch (err) {
        console.error('[onConnect] Exception:', err);
        onConnectFeedback?.({ ok: false, reason: err?.message || 'Connection failed', params });
      }
    },
    [graph, onConnectFeedback],
  );

  // Snap hint: highlight compatible targets while the user drags a connection.
  const onConnectStart = useCallback(
    (_event, params) => {
      const srcHandleId = params.handleId;
      const srcNodeId = params.nodeId;
      if (!srcHandleId) return;
      const doc = graph.getGraphDocument();
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === srcNodeId) return n;
          try {
            const srcNode = doc.nodes[srcNodeId];
            const targetNode = doc.nodes[n.id];
            const ports = getNodePortDescriptors(targetNode.type).inputs || [];
            const anyOk = ports.some((p) => {
              const test = canConnect(srcNode.type, targetNode.type, srcHandleId, p.id);
              return test.ok;
            });
            const hint = anyOk ? 'ok' : 'bad';
            return { ...n, data: { ...n.data, snapHint: hint } };
          } catch (err) {
            return { ...n, data: { ...n.data, snapHint: 'bad' } };
          }
        }),
      );
    },
    [setNodes, graph],
  );

  // Clear snap hints when drag ends (connection made or cancelled).
  const onConnectEnd = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.data?.snapHint
          ? { ...n, data: { ...n.data, snapHint: null } }
          : n,
      ),
    );
  }, [setNodes]);

  const applyLocalSelection = useCallback((nodeId) => {
    setNodes((nds) => nds.map((n) => ({
      ...n,
      selected: nodeId != null && n.id === nodeId,
    })));
  }, [setNodes]);

  const onNodeClick = useCallback(
    (_event, node) => {
      applyLocalSelection(node.id);
      onSelectNode?.(node.id);
    },
    [onSelectNode, applyLocalSelection],
  );

  // Double-click → schema-driven inspector.
  const onNodeDoubleClick = useCallback(
    (_event, node) => {
      onSelectNode?.(node.id);
      onInspectNode?.(node.id);
    },
    [onSelectNode, onInspectNode],
  );

  const onPaneClick = useCallback(() => {
    applyLocalSelection(null);
    onSelectNode?.(null);
  }, [onSelectNode, applyLocalSelection]);

  const onNodesDelete = useCallback(
    (deletedNodes) => {
      const ids = (deletedNodes || []).map((n) => n.id).filter(Boolean);
      if (!ids.length) return;
      if (onRequestDeleteNodes) {
        onRequestDeleteNodes(ids);
        return;
      }
      for (const nodeId of ids) {
        removeNode(graph, nodeId);
      }
      applyLocalSelection(null);
      onSelectNode?.(null);
    },
    [graph, onSelectNode, onRequestDeleteNodes, applyLocalSelection],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges) => {
      for (const edge of deletedEdges) {
        graph.dispatch('RemoveEdge', { edgeId: edge.id });
      }
      // Post-commit integrity after removals — callbacks non-blocking
      try {
        const check = validateGraph(graph.getGraphDocument(), { allowMissingCallbackHandlers: true });
        if (!check.ok) {
          const reason = (check.issues || []).map((i) => i.message).join('; ');
          onConnectFeedback?.({ ok: false, reason: `Graph validation failed after remove: ${reason}` });
        }
      } catch (err) {
        console.warn('[onEdgesDelete] graph validate error', err);
      }
    },
    [graph, onConnectFeedback],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onDropPaletteEntry?.(event, position);
    },
    [screenToFlowPosition, onDropPaletteEntry],
  );

  const onMoveEnd = useCallback(
    (_event, viewport) => {
      lastViewportRef.current = viewport;
      graph.setViewport(viewport);
    },
    [graph],
  );

  const isEmpty = (projection?.nodes?.length ?? 0) === 0;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onConnectStart={onConnectStart}
      onConnectEnd={onConnectEnd}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={onPaneClick}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMoveEnd={onMoveEnd}
      nodeTypes={NODE_TYPES}
      defaultViewport={projection.viewport}
      defaultEdgeOptions={EDGE_DEFAULTS}
      connectionLineStyle={{ stroke: 'rgba(99,102,241,0.45)', strokeWidth: 2 }}
      fitView={isEmpty}
      nodeDragThreshold={NODE_CLICK_DRAG_THRESHOLD_PX}
      selectNodesOnDrag={false}
      nodesFocusable
      elementsSelectable
      edgesFocusable={false}
      elevateNodesOnSelect
      deleteKeyCode={['Delete', 'Backspace']}
      multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
      minZoom={0.1}
      maxZoom={3}
      panOnScroll={false}
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      style={{ background: 'transparent', width: '100%', height: '100%' }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.2}
        color="#6366f1"
        style={{ opacity: 0.35 }}
      />
      <Controls
        style={{
          background: 'rgba(13,9,32,0.8)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      />
      {isEmpty && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
        </div>
      )}
    </ReactFlow>
  );
}

/**
 * ReactFlowCanvas — wraps GraphFlowInner with ReactFlowProvider.
 * Accepts graph editor API + projection; no stack state needed.
 */
export function ReactFlowCanvas(props) {
  return (
    <ReactFlowProvider>
      <GraphFlowInner {...props} />
    </ReactFlowProvider>
  );
}

export default ReactFlowCanvas;
