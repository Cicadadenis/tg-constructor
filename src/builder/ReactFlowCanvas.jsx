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

import { memo, Profiler, useCallback, useEffect, useMemo, useRef } from 'react';
import { useGraphCanvasActions } from './graphCanvasActionsContext.jsx';
import { useCanvasInteractions } from './canvas/useCanvasInteractions.js';
import { useBatchedProjectionSync } from '../performance/useBatchedProjectionSync.js';
import CanvasPerformanceOverlay from '../performance/CanvasPerformanceOverlay.jsx';
import { usePerformanceStore } from '../performance/performanceStore.js';
import { zoomToTier } from '../performance/zoomTier.js';
import { scheduleBatched } from '../performance/batchedUpdates.js';
import CanvasDropGhost from './canvas/CanvasDropGhost.jsx';
import CanvasContextMenu from './canvas/CanvasContextMenu.jsx';
import CanvasEnhancedMinimap from './canvas/CanvasEnhancedMinimap.jsx';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './graph_canvas.css';
import './flowEdge/flow-add-step.css';
import './canvas/canvas-chrome.css';
import './canvas/canvas-interaction.css';
import './visualNodes/visual-node-card.css';
import CicadaNode from '../CicadaNode.jsx';
import FlowAddStepEdge from './flowEdge/FlowAddStepEdge.jsx';
import FlowBezierEdge from './flowEdge/FlowBezierEdge.jsx';
import CanvasZoomControls from './canvas/CanvasZoomControls.jsx';
import { buildCanvasEdgePresentation, resolveExecutionPathEdgeIds } from './canvas/canvasEdgeStyles.js';
import { FlowEdgePickerHost, useFlowEdgePicker } from './flowEdge/FlowEdgePickerHost.jsx';
import { isSplittableFlowEdge } from './flowEdge/insertNodeOnEdge.js';
import { NODE_CLICK_DRAG_THRESHOLD_PX, BLOCK_W } from './graph_canvas_metrics.js';
import { useSelectionStore } from '../stores/selectionStore.js';
import {
  moveNode,
  removeNode,
  addEdge as graphAddEdge,
} from '../constructor/graph_document/graph_operation_client.js';
import {
  canConnect,
  validateConnection,
  validateGraph,
} from '../constructor/graph_document/operation_registry.js';
import { normalizeConnectionError } from './graph_error_messages.js';
import { computeViewportForNodes } from '../constructor/graph_document/graph_viewport.js';


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
  paletteDragEntry = null,
}) {
  const graphCanvasActions = useGraphCanvasActions();
  const edgePicker = useFlowEdgePicker();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setViewport, screenToFlowPosition, setCenter, getViewport } = useReactFlow();
  const canvasFocusRequest = useSelectionStore((s) => s.canvasFocusRequest);
  const rfVpX = useStore((s) => s.transform[0]);
  const rfVpY = useStore((s) => s.transform[1]);
  const rfVpZoom = useStore((s) => s.transform[2]);
  const rfViewport = useMemo(
    () => ({ x: rfVpX, y: rfVpY, zoom: rfVpZoom }),
    [rfVpX, rfVpY, rfVpZoom],
  );
  const canvasWidth = useStore((s) => s.width);
  const canvasHeight = useStore((s) => s.height);
  const canvasSize = useMemo(
    () => ({ width: canvasWidth, height: canvasHeight }),
    [canvasWidth, canvasHeight],
  );

  const lastRevRef = useRef(null);
  const lastViewportRef = useRef(null);
  const lastNodeCountRef = useRef(0);
  const draggingRef = useRef(false);
  const syncingViewportFromGraphRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const resizeFitDoneRef = useRef(false);
  const flowHostRef = useRef(null);
  const projectionViewport = projection?.viewport ?? { x: 0, y: 0, zoom: 1 };
  const projectionVpX = projectionViewport.x ?? 0;
  const projectionVpY = projectionViewport.y ?? 0;
  const projectionVpZoom = projectionViewport.zoom ?? 1;

  const { fitView } = useReactFlow();

  // One-time fit when the canvas host gains real dimensions (layout settle after login).
  useEffect(() => {
    const host = flowHostRef.current;
    if (!host || typeof ResizeObserver !== 'function' || resizeFitDoneRef.current) return undefined;

    let raf = 0;
    const reflow = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (resizeFitDoneRef.current) return;
        const { width, height } = host.getBoundingClientRect();
        if (width < 2 || height < 2) return;
        resizeFitDoneRef.current = true;
        try {
          fitView({ padding: 0.2, duration: 0, maxZoom: 1.2 });
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

  const applyEdgeDefaultsFn = useCallback(
    (edgeList, doc, highlight) => applyEdgeDefaults(edgeList, doc, highlight),
    [],
  );
  const enrichEdgesFn = useCallback(
    (edgeList, picker) => enrichEdgesWithPicker(edgeList, picker),
    [],
  );

  useBatchedProjectionSync({
    projection,
    graph,
    selectedBlockId,
    repairHighlightNodeIds,
    repairHighlightEdgeIds,
    highlightKind,
    edgePicker,
    setNodes,
    setEdges,
    draggingRef,
    lastRevRef,
    viewport: rfViewport,
    canvasSize,
    applyEdgeDefaultsFn,
    enrichEdgesFn,
  });

  useEffect(() => {
    const nodeCount = projection?.nodes?.length ?? 0;
    const edgeCount = projection?.edges?.length ?? 0;
    const tier = zoomToTier(rfVpZoom);
    const perf = usePerformanceStore.getState();
    if (
      perf.zoom === rfVpZoom
      && perf.zoomTier === tier
      && perf.nodeCount === nodeCount
      && perf.edgeCount === edgeCount
      && perf.onlyVisible === (nodeCount > 48)
    ) {
      return;
    }
    usePerformanceStore.getState().patch({
      zoom: rfVpZoom,
      zoomTier: tier,
      nodeCount,
      edgeCount,
      onlyVisible: nodeCount > 48,
    });
  }, [
    projection?.nodes?.length,
    projection?.edges?.length,
    rfVpZoom,
  ]);

  // Sync graph → React Flow viewport at most once per graph revision (avoids persist feedback loops).
  useEffect(() => {
    const rev = projection?.metadata?.revision ?? 0;
    if (lastViewportRef.current?.revision === rev) return;

    syncingViewportFromGraphRef.current = true;
    setViewport(
      { x: projectionVpX, y: projectionVpY, zoom: projectionVpZoom },
      { duration: 0 },
    );
    lastViewportRef.current = {
      revision: rev,
      x: projectionVpX,
      y: projectionVpY,
      zoom: projectionVpZoom,
    };
    requestAnimationFrame(() => {
      syncingViewportFromGraphRef.current = false;
    });
  }, [
    projection?.metadata?.revision,
    projectionVpX,
    projectionVpY,
    projectionVpZoom,
    setViewport,
  ]);

  // One-time fit when nodes first appear (e.g. after autosave hydrate).
  useEffect(() => {
    const nodeCount = projection?.nodes?.length ?? 0;
    if (nodeCount === 0 || initialFitDoneRef.current) return undefined;
    initialFitDoneRef.current = true;
    const id = requestAnimationFrame(() => {
      try {
        fitView({ padding: 0.2, duration: 0, maxZoom: 1.2 });
      } catch (err) {
        logCanvasLifecycle('fitView:initial', err);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [projection?.nodes?.length, fitView]);

  const persistViewport = useCallback((viewport) => {
    if (syncingViewportFromGraphRef.current) return;
    const doc = graph.getGraphDocument();
    const current = doc.viewport || { x: 0, y: 0, zoom: 1 };
    if (
      Math.abs((current.x ?? 0) - viewport.x) < 0.01
      && Math.abs((current.y ?? 0) - viewport.y) < 0.01
      && Math.abs((current.zoom ?? 1) - viewport.zoom) < 0.0001
    ) {
      lastViewportRef.current = viewport;
      return;
    }
    lastViewportRef.current = viewport;
    scheduleBatched('viewport-persist', () => {
      graph.setViewport(viewport);
    });
  }, [graph]);

  const persistViewportForced = useCallback((viewport) => {
    lastViewportRef.current = viewport;
    graph.setViewport(viewport);
  }, [graph]);

  // Pan visible canvas to a newly added node (setCenter on React Flow, then persist).
  useEffect(() => {
    const nodeId = canvasFocusRequest?.nodeId;
    if (!nodeId) return undefined;

    let cancelled = false;
    let attempts = 0;
    const NODE_FOCUS_H = 160;

    const run = () => {
      if (cancelled) return;
      attempts += 1;
      const docNode = graph.getGraphDocument().nodes?.[nodeId];
      if (!docNode?.position) {
        if (attempts < 12) requestAnimationFrame(run);
        return;
      }

      const rfNode = nodes.find((n) => n.id === nodeId);
      const w = rfNode?.measured?.width ?? rfNode?.width ?? BLOCK_W;
      const h = rfNode?.measured?.height ?? rfNode?.height ?? NODE_FOCUS_H;
      const cx = Number(docNode.position.x) + w / 2;
      const cy = Number(docNode.position.y) + h / 2;
      const zoom = Math.min(Math.max(getViewport().zoom ?? 1, 0.45), 1.15);

      syncingViewportFromGraphRef.current = true;
      lastViewportRef.current = null;

      setCenter(cx, cy, { zoom, duration: 260 })
        .then(() => {
          if (cancelled) return;
          persistViewportForced(getViewport());
        })
        .catch(() => {
          if (cancelled) return;
          const vp = computeViewportForNodes([docNode], {
            width: canvasWidth || 800,
            height: canvasHeight || 600,
            padding: 80,
            maxZoom: 1.15,
          });
          setViewport(vp, { duration: 0 });
          persistViewportForced(vp);
        })
        .finally(() => {
          requestAnimationFrame(() => {
            syncingViewportFromGraphRef.current = false;
            useSelectionStore.getState().clearCanvasFocus();
          });
        });
    };

    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, [
    canvasFocusRequest?.nodeId,
    canvasFocusRequest?.seq,
    graph,
    nodes,
    setCenter,
    getViewport,
    setViewport,
    persistViewportForced,
    canvasWidth,
    canvasHeight,
  ]);

  const {
    reactFlowInteractionProps: interactionProps,
    dropGhost,
    clearDropGhost,
    contextMenu,
    closeContextMenu,
    fitToFlow,
    groupSelectedNodes,
  } = useCanvasInteractions({
    graph,
    setNodes,
    onSelectNode,
    onInspectNode,
    onConnectFeedback,
    onRequestDeleteNodes,
    graphCanvasActions,
    lang,
    draggingRef,
    lastViewportRef,
    persistViewport,
  });

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

  const ignorePaneClickUntilRef = useRef(0);
  const contextMenuOpenRef = useRef(false);

  useEffect(() => {
    contextMenuOpenRef.current = Boolean(contextMenu);
  }, [contextMenu]);

  const onPaneClick = useCallback(() => {
    if (contextMenuOpenRef.current) return;
    if (performance.now() < ignorePaneClickUntilRef.current) return;
    closeContextMenu();
    applyLocalSelection(null);
    onSelectNode?.(null);
  }, [onSelectNode, applyLocalSelection, closeContextMenu]);

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

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearDropGhost();
      const host = flowHostRef.current;
      const rect = host?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : event.clientX;
      const cy = rect ? rect.top + rect.height / 2 : event.clientY;
      const position = screenToFlowPosition({ x: cx, y: cy });
      onDropPaletteEntry?.(event, position);
    },
    [screenToFlowPosition, onDropPaletteEntry, clearDropGhost],
  );

  const onDragOverCanvas = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      interactionProps.onDragOver?.(event);
    },
    [interactionProps.onDragOver],
  );

  const onDragLeaveCanvas = useCallback(
    (event) => {
      interactionProps.onDragLeave?.(event);
    },
    [interactionProps.onDragLeave],
  );

  const {
    onNodeContextMenu: baseNodeContextMenu,
    onDragOver: _dropOnDragOver,
    onDragLeave: _dropOnDragLeave,
    ...reactFlowInteractionProps
  } = interactionProps;

  const onNodeContextMenu = useCallback((event, node) => {
    applyLocalSelection(node.id);
    baseNodeContextMenu?.(event, node);
  }, [applyLocalSelection, baseNodeContextMenu]);

  const removeEdgeById = useCallback((edgeId) => {
    graph.dispatch('RemoveEdge', { edgeId });
    closeContextMenu();
  }, [graph, closeContextMenu]);

  const paletteGhostLabel = paletteDragEntry?.label
    || paletteDragEntry?.defaultNodeType
    || '';
  const paletteGhostIcon = paletteDragEntry?.icon || '◆';

  const nodeCount = projection?.nodes?.length ?? 0;
  const isEmpty = nodeCount === 0;
  const onlyRenderVisible = nodeCount > 48;
  const defaultEdgeOptions = useMemo(() => ({ ...EDGE_DEFAULTS }), []);

  return (
    <div
      ref={flowHostRef}
      className="graph-flow-host graph-flow-host--premium"
      onDragOver={onDragOverCanvas}
      onDragLeave={onDragLeaveCanvas}
      onDrop={onDrop}
    >
      <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onNodeContextMenu={onNodeContextMenu}
      onPaneClick={onPaneClick}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      defaultViewport={projection.viewport}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView={false}
      onlyRenderVisibleElements={onlyRenderVisible}
      nodeDragThreshold={NODE_CLICK_DRAG_THRESHOLD_PX}
      nodesFocusable
      elementsSelectable
      edgesFocusable={false}
      elevateNodesOnSelect
      deleteKeyCode={['Delete', 'Backspace']}
      multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
      minZoom={0.08}
      maxZoom={2.5}
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      autoPanOnNodeDrag={false}
      selectNodesOnDrag={false}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
      proOptions={{ hideAttribution: true }}
      {...reactFlowInteractionProps}
      onDragOver={onDragOverCanvas}
      onDragLeave={onDragLeaveCanvas}
      onDrop={onDrop}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={32}
        size={1}
        color="var(--color-canvas-dot)"
        style={{ opacity: 0.8 }}
      />
      <CanvasZoomControls lang={lang} onFitFlow={fitToFlow} />
      <CanvasEnhancedMinimap lang={lang} />
      <CanvasPerformanceOverlay />
      <CanvasDropGhost
        position={dropGhost}
        label={paletteGhostLabel}
        icon={paletteGhostIcon}
      />
      <CanvasContextMenu
        menu={contextMenu}
        onClose={closeContextMenu}
        lang={lang}
        onFitFlow={fitToFlow}
        onGroupSelection={groupSelectedNodes}
        onRemoveEdge={removeEdgeById}
        actions={{
          onInspect: (nodeId) => {
            if (!nodeId) return;
            ignorePaneClickUntilRef.current = performance.now() + 600;
            applyLocalSelection(nodeId);
            onSelectNode?.(nodeId);
            onInspectNode?.(nodeId);
          },
          onDeleteNode: graphCanvasActions?.onDeleteNode,
          onDuplicateNode: graphCanvasActions?.onDuplicateNode,
          onAddAfterNode: graphCanvasActions?.onAddAfterNode,
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
    </div>
  );
}

// Isolate canvas from parent App rerenders when props are stable.
const MemoGraphFlowInner = memo(GraphFlowInner);

/**
 * ReactFlowCanvas — wraps GraphFlowInner with ReactFlowProvider.
 * Accepts graph editor API + projection; no stack state needed.
 */
function onCanvasProfileRender(id, phase, actualDuration) {
  if (phase === 'update' && actualDuration > 12) {
    try {
      if (import.meta.env?.DEV || globalThis.__CICADA_PERF__) {
        console.debug(`[canvas profiler] ${id}: ${actualDuration.toFixed(1)}ms`);
      }
    } catch { /* ignore */ }
  }
}

export function ReactFlowCanvas(props) {
  const { onInsertNodeOnEdge, ...rest } = props;
  const inner = <MemoGraphFlowInner {...rest} />;
  const profiled = (import.meta.env?.DEV || globalThis.__CICADA_PERF__)
    ? (
      <Profiler id="GraphCanvas" onRender={onCanvasProfileRender}>
        {inner}
      </Profiler>
    )
    : inner;

  return (
    <ReactFlowProvider>
      <FlowEdgePickerHost onInsertOnEdge={onInsertNodeOnEdge}>
        {profiled}
      </FlowEdgePickerHost>
    </ReactFlowProvider>
  );
}

export default ReactFlowCanvas;
