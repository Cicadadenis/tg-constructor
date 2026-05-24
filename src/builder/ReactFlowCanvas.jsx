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

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { mergeProjectionEdges, mergeProjectionNodes } from './projectionSync.js';
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './graph_canvas.css';
import './flowEdge/flow-add-step.css';
import './canvas/canvas-chrome.css';
import CicadaNode from '../CicadaNode.jsx';
import FlowAddStepEdge from './flowEdge/FlowAddStepEdge.jsx';
import FlowBezierEdge from './flowEdge/FlowBezierEdge.jsx';
import CanvasZoomControls from './canvas/CanvasZoomControls.jsx';
import { buildCanvasEdgePresentation, resolveExecutionPathEdgeIds } from './canvas/canvasEdgeStyles.js';
import { FlowEdgePickerHost, useFlowEdgePicker } from './flowEdge/FlowEdgePickerHost.jsx';
import { isSplittableFlowEdge } from './flowEdge/insertNodeOnEdge.js';
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
const EDGE_TYPES = Object.freeze({
  flowAdd: FlowAddStepEdge,
  flowBezier: FlowBezierEdge,
});

const EDGE_DEFAULTS = Object.freeze({
  type: 'flowBezier',
  style: { stroke: 'var(--color-border-strong)', strokeWidth: 1.5 },
  animated: false,
});

function applyEdgeDefaults(edges, document, highlight = {}) {
  const repairedIds = new Set(highlight.repairedEdgeIds || []);
  const executionIds = new Set(highlight.executionEdgeIds || []);

  return edges.map((edge) => {
    const v = validateConnection(document, {
      source: edge.source,
      target: edge.target,
      sourcePort: edge.sourcePort ?? edge.sourceHandle,
      targetPort: edge.targetPort ?? edge.targetHandle,
      ignoreEdgeId: edge.id,
    });
    const splittable = v.ok && isSplittableFlowEdge(document, edge);
    const presentation = buildCanvasEdgePresentation(
      edge,
      document,
      {
        repairedEdgeIds: repairedIds,
        executionEdgeIds: executionIds,
        kind: highlight.kind || null,
      },
      splittable,
      v.ok,
    );

    return {
      ...edge,
      ...presentation,
      sourceHandle: edge.sourcePort ?? edge.sourceHandle,
      targetHandle: edge.targetPort ?? edge.targetHandle,
      label: v.ok ? (presentation.data?.repairPath ? '✓' : '') : (() => {
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
        ? (presentation.data?.repairPath
          ? { fill: '#86efac', fontWeight: 700, fontSize: 10 }
          : undefined)
        : { fill: 'rgba(254,202,202,0.95)', fontWeight: 600, fontSize: 10 },
      labelBgStyle: v.ok ? undefined : { fill: 'rgba(127,29,29,0.85)' },
      data: {
        ...(edge.data || {}),
        ...(presentation.data || {}),
        splittable,
        invalid: !v.ok,
      },
    };
  });
}

function enrichEdgesWithPicker(edges, picker) {
  if (!picker?.openPicker) return edges;
  return edges.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      onOpenPicker: picker.openPicker,
      pickerOpen: picker.activeEdgeId === edge.id,
      lang: picker.lang,
    },
  }));
}

/**
 * Inner canvas — must be inside a ReactFlowProvider to access useReactFlow.
 */
function logCanvasLifecycle(scope, err) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.__CICADA_DEBUG_CANVAS__ === true) {
      console.debug('[ReactFlowCanvas]', scope, err ?? '');
    }
  } catch {
    /* ignore */
  }
}

function GraphFlowInner({
  graph,
  projection,
  selectedBlockId,
  repairHighlightNodeIds = [],
  repairHighlightEdgeIds = [],
  highlightKind = null,
  lang = 'ru',
  onSelectNode,
  onInspectNode,
  onConnectFeedback,
  onDropPaletteEntry,
  onRequestDeleteNodes,
}) {
  const edgePicker = useFlowEdgePicker();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setViewport, screenToFlowPosition } = useReactFlow();

  const lastRevRef = useRef(null);
  const lastViewportRef = useRef(null);
  const lastNodeCountRef = useRef(0);
  const draggingRef = useRef(false);
  const flowHostRef = useRef(null);

  const { fitView } = useReactFlow();

  // Re-measure when parent flex/grid layout settles (e.g. after auth/API bootstrap).
  useEffect(() => {
    const host = flowHostRef.current;
    if (!host || typeof ResizeObserver !== 'function') return undefined;

    let lastW = 0;
    let lastH = 0;
    let raf = 0;
    const reflow = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { width, height } = host.getBoundingClientRect();
        const wasZero = lastW < 2 || lastH < 2;
        lastW = width;
        lastH = height;
        if (width < 2 || height < 2) return;
        if (!wasZero) return;
        try {
          fitView({ padding: 0.2, duration: 200, maxZoom: 1.2 });
        } catch (err) {
          logCanvasLifecycle('fitView:resize', err);
        }
      });
    };

    reflow();
    const ro = new ResizeObserver(reflow);
    ro.observe(host);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [fitView]);

  // Sync projection → ReactFlow state when revision, node count, or preview content changes.
  useEffect(() => {
    const rev = projection?.metadata?.revision;
    const nodeCount = projection?.nodes?.length ?? 0;
    const previewSig = projection?.previewSignature ?? '';
    const syncKey = `${rev ?? ''}:${nodeCount}:${previewSig}`;
    if (syncKey === lastRevRef.current && !draggingRef.current) return;
    lastRevRef.current = syncKey;

    const doc = graph.getGraphDocument();
    const isExecution = highlightKind === 'execution';
    const repairIds = isExecution ? new Set() : new Set(repairHighlightNodeIds || []);
    const executionIds = isExecution ? new Set(repairHighlightNodeIds || []) : new Set();
    let executionEdgeList = isExecution ? [...(repairHighlightEdgeIds || [])] : [];
    if (isExecution && !executionEdgeList.length && executionIds.size > 0) {
      executionEdgeList = resolveExecutionPathEdgeIds(doc, executionIds);
    }
    const repairEdgeIds = isExecution ? new Set() : new Set(repairHighlightEdgeIds || []);
    const executionEdgeIds = isExecution ? new Set(executionEdgeList) : new Set();

    const nextEdges = enrichEdgesWithPicker(
      applyEdgeDefaults(projection.edges, doc, {
        repairedEdgeIds: repairEdgeIds,
        executionEdgeIds,
        kind: highlightKind,
      }),
      edgePicker,
    );

    setNodes((current) => mergeProjectionNodes(
      current,
      projection.nodes,
      selectedBlockId,
      { repairIds, executionIds },
      rev,
    ));
    setEdges((current) => mergeProjectionEdges(current, nextEdges));

    const vp = projection.viewport;
    const last = lastViewportRef.current;
    const viewportChanged =
      !last ||
      Math.abs(last.x - vp.x) > 0.5 ||
      Math.abs(last.y - vp.y) > 0.5 ||
      Math.abs(last.zoom - vp.zoom) > 0.01;

    if (viewportChanged) {
      setViewport(vp, { duration: 300 });
      lastViewportRef.current = { x: vp.x, y: vp.y, zoom: vp.zoom };
    } else if (nodeCount > 0 && lastNodeCountRef.current === 0) {
      requestAnimationFrame(() => {
        try {
          fitView({ padding: 0.2, duration: 200, maxZoom: 1.2 });
        } catch (err) {
          logCanvasLifecycle('fitView:initial', err);
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
    highlightKind,
    edgePicker?.activeEdgeId,
    edgePicker?.openPicker,
    edgePicker?.lang,
    setViewport,
    fitView,
    graph,
  ]);

  const onNodeDragStart = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const onNodeDragStop = useCallback(() => {
    draggingRef.current = false;
  }, []);

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

  const nodeCount = projection?.nodes?.length ?? 0;
  const isEmpty = nodeCount === 0;
  const onlyRenderVisible = nodeCount > 80;

  const defaultEdgeOptions = useMemo(() => ({ ...EDGE_DEFAULTS }), []);

  return (
    <div ref={flowHostRef} className="graph-flow-host">
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
      edgeTypes={EDGE_TYPES}
      defaultViewport={projection.viewport}
      defaultEdgeOptions={defaultEdgeOptions}
      connectionLineType={ConnectionLineType.Bezier}
      connectionLineStyle={{ stroke: 'var(--color-primary)', strokeWidth: 2, opacity: 0.55 }}
      fitView={isEmpty}
      onlyRenderVisibleElements={onlyRenderVisible}
      nodesDraggable={false}
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
        gap={32}
        size={1}
        color="var(--color-canvas-dot)"
        style={{ opacity: 0.8 }}
      />
      <CanvasZoomControls lang={lang} />
      <MiniMap
        className="canvas-minimap"
        position="bottom-right"
        nodeColor={(node) => {
          if (node.data?.executionPath) return 'var(--color-primary)';
          if (node.data?.repairPulse) return 'var(--color-success)';
          return 'var(--color-primary)';
        }}
        nodeStrokeWidth={0}
        maskColor="rgba(249, 250, 251, 0.82)"
        pannable
        zoomable
        ariaLabel={lang === 'en' ? 'Canvas minimap' : 'Миникарта холста'}
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
    </div>
  );
}

/**
 * ReactFlowCanvas — wraps GraphFlowInner with ReactFlowProvider.
 * Accepts graph editor API + projection; no stack state needed.
 */
export function ReactFlowCanvas(props) {
  const { onInsertNodeOnEdge, ...rest } = props;
  return (
    <ReactFlowProvider>
      <FlowEdgePickerHost onInsertOnEdge={onInsertNodeOnEdge}>
        <GraphFlowInner {...rest} />
      </FlowEdgePickerHost>
    </ReactFlowProvider>
  );
}

export default ReactFlowCanvas;
