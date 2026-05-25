import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useReactFlow,
  useStore,
  getNodesBounds,
  getViewportForBounds,
  SelectionMode,
  PanOnScrollMode,
  ConnectionLineType,
} from '@xyflow/react';
import { moveNode } from '../../constructor/graph_document/graph_operation_client.js';
import {
  canConnect,
  getNodePortDescriptors,
  validateConnection,
} from '../../constructor/graph_document/operation_registry.js';
import { addEdge as graphAddEdge } from '../../constructor/graph_document/graph_operation_client.js';
import { findNearestCompatibleTarget } from './snapToHandles.js';
import { computeSnapGuides } from '../../ux/CanvasSnapGuides.jsx';
import { usePerformanceStore } from '../../performance/performanceStore.js';
import {
  CANVAS_SNAP_GRID,
  CANVAS_CONNECTION_RADIUS,
  CANVAS_PAN_INERTIA_FRICTION,
  CANVAS_PAN_INERTIA_MIN_VELOCITY,
  CANVAS_PAN_INERTIA_GAIN,
  CANVAS_AUTO_CONNECT_RADIUS,
  CANVAS_FIT_PADDING,
  CANVAS_FIT_MAX_ZOOM,
} from './canvasInteractionConfig.js';

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Premium canvas interactions: inertia pan, snap grid, magnetic ports, multi-select, shortcuts.
 */
export function useCanvasInteractions({
  graph,
  setNodes,
  onSelectNode,
  onInspectNode,
  onConnectFeedback,
  onRequestDeleteNodes,
  graphCanvasActions,
  lang = 'ru',
  draggingRef,
  lastViewportRef,
  persistViewport,
}) {
  const {
    setViewport,
    getNodes,
    screenToFlowPosition,
    fitView,
  } = useReactFlow();

  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);

  const panVelocityRef = useRef({ vx: 0, vy: 0 });
  const lastPanRef = useRef({ t: 0, x: 0, y: 0 });
  const inertiaRafRef = useRef(null);
  const connectFromRef = useRef(null);

  const [dropGhost, setDropGhost] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [snapGuides, setSnapGuides] = useState([]);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);

  const cancelInertia = useCallback(() => {
    if (inertiaRafRef.current != null) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  }, []);

  const onMove = useCallback((_event, viewport) => {
    cancelInertia();
    const now = performance.now();
    const last = lastPanRef.current;
    if (last.t) {
      const dt = Math.min(Math.max(now - last.t, 1), 48);
      panVelocityRef.current = {
        vx: (viewport.x - last.x) / dt,
        vy: (viewport.y - last.y) / dt,
      };
    }
    lastPanRef.current = { t: now, x: viewport.x, y: viewport.y };
  }, [cancelInertia]);

  const onMoveEnd = useCallback((_event, viewport) => {
    let { vx, vy } = panVelocityRef.current;
    let x = viewport.x;
    let y = viewport.y;
    const zoom = viewport.zoom;

    const runInertia = () => {
      vx *= CANVAS_PAN_INERTIA_FRICTION;
      vy *= CANVAS_PAN_INERTIA_FRICTION;
      if (Math.hypot(vx, vy) < CANVAS_PAN_INERTIA_MIN_VELOCITY) {
        inertiaRafRef.current = null;
        persistViewport({ x, y, zoom });
        return;
      }
      x += vx * CANVAS_PAN_INERTIA_GAIN;
      y += vy * CANVAS_PAN_INERTIA_GAIN;
      setViewport({ x, y, zoom });
      inertiaRafRef.current = requestAnimationFrame(runInertia);
    };

    if (Math.hypot(vx, vy) > 0.12) {
      cancelInertia();
      inertiaRafRef.current = requestAnimationFrame(runInertia);
    } else {
      persistViewport(viewport);
    }
    lastPanRef.current = { t: 0, x: 0, y: 0 };
  }, [setViewport, persistViewport, cancelInertia]);

  const fitToFlow = useCallback(() => {
    const nodes = getNodes();
    if (!nodes.length) {
      fitView({ padding: CANVAS_FIT_PADDING, duration: 280, maxZoom: CANVAS_FIT_MAX_ZOOM });
      return;
    }
    const bounds = getNodesBounds(nodes);
    const vp = getViewportForBounds(
      bounds,
      width || 800,
      height || 600,
      CANVAS_FIT_PADDING,
      CANVAS_FIT_MAX_ZOOM,
      0.08,
    );
    setViewport(vp, { duration: 320 });
    persistViewport(vp);
  }, [getNodes, fitView, width, height, setViewport, persistViewport]);

  const onNodeDragStart = useCallback(() => {
    if (draggingRef) draggingRef.current = true;
    usePerformanceStore.getState().patch({ isDragging: true });
    cancelInertia();
  }, [draggingRef, cancelInertia]);

  const onNodeDrag = useCallback((_event, node) => {
    setNodes((nds) => {
      const others = nds.filter((n) => n.id !== node.id).map((n) => ({
        position: n.position,
        width: n.width,
        height: n.height,
      }));
      const guides = computeSnapGuides(
        {
          x: node.position.x,
          y: node.position.y,
          width: node.width ?? 220,
          height: node.height ?? 100,
        },
        others,
      );
      setSnapGuides(guides);
      return nds.map((n) => (n.id === node.id ? { ...n, position: node.position } : n));
    });
  }, [setNodes]);

  const onNodeDragStop = useCallback((_event, node) => {
    if (draggingRef) draggingRef.current = false;
    usePerformanceStore.getState().patch({ isDragging: false });
    setSnapGuides([]);
    moveNode(graph, node.id, { x: node.position.x, y: node.position.y });
  }, [graph, draggingRef]);

  const onSelectionDragStop = useCallback(() => {
    if (draggingRef) draggingRef.current = false;
    setSnapGuides([]);
    const nodes = getNodes().filter((n) => n.selected);
    for (const n of nodes) {
      moveNode(graph, n.id, { x: n.position.x, y: n.position.y });
    }
  }, [graph, getNodes, draggingRef]);

  const applyLocalSelection = useCallback((nodeIds) => {
    const idSet = new Set(nodeIds || []);
    setNodes((nds) => nds.map((n) => ({
      ...n,
      selected: idSet.has(n.id),
    })));
  }, [setNodes]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }) => {
    const ids = (selectedNodes || []).map((n) => n.id);
    if (ids.length === 1) {
      onSelectNode?.(ids[0]);
    } else if (ids.length === 0) {
      onSelectNode?.(null);
    }
    applyLocalSelection(ids);
  }, [onSelectNode, applyLocalSelection]);

  const onConnectStart = useCallback(
    (_event, params) => {
      connectFromRef.current = {
        nodeId: params.nodeId,
        handleId: params.handleId,
      };
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
            if (!targetNode) return n;
            const ports = getNodePortDescriptors(targetNode.type).inputs || [];
            const anyOk = ports.some((p) => {
              const test = canConnect(srcNode.type, targetNode.type, srcHandleId, p.id || 'flow');
              return test.ok;
            });
            const hint = anyOk ? 'ok' : 'bad';
            return { ...n, data: { ...n.data, snapHint: hint } };
          } catch {
            return { ...n, data: { ...n.data, snapHint: 'bad' } };
          }
        }),
      );
    },
    [setNodes, graph],
  );

  const clearSnapHints = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.data?.snapHint ? { ...n, data: { ...n.data, snapHint: null } } : n,
      ),
    );
  }, [setNodes]);

  const tryAutoConnect = useCallback(
    (flowPoint) => {
      const from = connectFromRef.current;
      if (!from?.nodeId || !from?.handleId) return false;
      const doc = graph.getGraphDocument();
      const target = findNearestCompatibleTarget(
        doc,
        getNodes(),
        flowPoint,
        from.nodeId,
        from.handleId,
        CANVAS_AUTO_CONNECT_RADIUS,
      );
      if (!target) return false;
      const verdict = validateConnection(doc, {
        source: from.nodeId,
        target: target.nodeId,
        sourcePort: from.handleId,
        targetPort: target.handleId,
      });
      if (!verdict.ok) return false;
      const edgeId = `edge_${from.nodeId}_${target.nodeId}_${Date.now()}`;
      const result = graphAddEdge(graph, {
        edgeId,
        source: from.nodeId,
        target: target.nodeId,
        sourcePort: from.handleId,
        targetPort: target.handleId,
      });
      if (result?.ok) {
        onConnectFeedback?.({ ok: true, auto: true });
        return true;
      }
      return false;
    },
    [graph, getNodes, onConnectFeedback],
  );

  const onConnectEnd = useCallback(
    (event, connectionState) => {
      clearSnapHints();
      const from = connectFromRef.current;
      connectFromRef.current = null;
      if (connectionState?.toHandle && connectionState?.toNode) return;
      if (!from) return;
      const point = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      tryAutoConnect(point);
    },
    [clearSnapHints, screenToFlowPosition, tryAutoConnect],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setDropGhost({ x: position.x, y: position.y });
  }, [screenToFlowPosition]);

  const onDragLeave = useCallback(() => {
    setDropGhost(null);
  }, []);

  const clearDropGhost = useCallback(() => {
    setDropGhost(null);
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    onSelectNode?.(node.id);
    setContextMenu({
      type: 'node',
      nodeId: node.id,
      x: event.clientX,
      y: event.clientY,
    });
  }, [onSelectNode]);

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault();
    setContextMenu({
      type: 'pane',
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    setContextMenu({
      type: 'edge',
      edgeId: edge.id,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const onNodeMouseEnter = useCallback((_event, node) => {
    setHoveredNodeId(node.id);
    setNodes((nds) => nds.map((n) => ({
      ...n,
      className: [
        n.className,
        n.id === node.id ? 'is-hovered' : '',
      ].filter(Boolean).join(' ').trim(),
    })));
  }, [setNodes]);

  const onNodeMouseLeave = useCallback((_event, node) => {
    setHoveredNodeId((id) => (id === node.id ? null : id));
    setNodes((nds) => nds.map((n) => ({
      ...n,
      className: (n.className || '').replace(/\bis-hovered\b/g, '').trim(),
    })));
  }, [setNodes]);

  const onEdgeMouseEnter = useCallback((_event, edge) => {
    setHoveredEdgeId(edge.id);
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
  }, []);

  const groupSelectedNodes = useCallback(() => {
    const ids = getNodes().filter((n) => n.selected).map((n) => n.id);
    if (ids.length < 2) return;
    graph.dispatch('GroupSelection', {
      nodeIds: ids,
      label: lang === 'en' ? 'Group' : 'Группа',
    });
    closeContextMenu();
  }, [getNodes, graph, lang, closeContextMenu]);

  useEffect(() => {
    const host = document.querySelector('.graph-flow-host');
    if (!host) return undefined;

    const onKeyDown = (e) => {
      if (!host.contains(document.activeElement) && document.activeElement !== document.body) {
        const inFlow = host.querySelector(':focus-within');
        if (!inFlow && !host.matches(':hover')) return;
      }
      if (isEditableTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape') {
        closeContextMenu();
        applyLocalSelection([]);
        onSelectNode?.(null);
        return;
      }

      if (mod && e.key === 'a') {
        e.preventDefault();
        const allIds = getNodes().map((n) => n.id);
        applyLocalSelection(allIds);
        if (allIds.length === 1) onSelectNode?.(allIds[0]);
        return;
      }

      if (mod && e.key === '0') {
        e.preventDefault();
        fitToFlow();
        return;
      }

      if (mod && e.key === 'd') {
        const selected = getNodes().filter((n) => n.selected);
        if (selected.length !== 1) return;
        e.preventDefault();
        graphCanvasActions?.onDuplicateNode?.(selected[0].id);
        return;
      }

      if (mod && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new Event('cicada:open-command-palette'));
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        const selected = getNodes().filter((n) => n.selected);
        if (selected.length > 0) {
          e.preventDefault();
          onRequestDeleteNodes?.(selected.map((n) => n.id));
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    applyLocalSelection,
    closeContextMenu,
    fitToFlow,
    getNodes,
    graphCanvasActions,
    onSelectNode,
    onRequestDeleteNodes,
  ]);

  useEffect(() => () => cancelInertia(), [cancelInertia]);

  const reactFlowInteractionProps = {
    snapToGrid: true,
    snapGrid: CANVAS_SNAP_GRID,
    connectionRadius: CANVAS_CONNECTION_RADIUS,
    connectionLineType: ConnectionLineType.SmoothStep,
    connectionLineStyle: {
      stroke: 'var(--color-primary)',
      strokeWidth: 2,
      opacity: 0.65,
    },
    autoPanOnConnect: true,
    autoPanOnNodeDrag: true,
    panOnScroll: true,
    panOnScrollMode: PanOnScrollMode.Free,
    panActivationKeyCode: 'Space',
    panOnDrag: true,
    selectionMode: SelectionMode.Partial,
    selectNodesOnDrag: true,
    selectionOnDrag: true,
    selectionKeyCode: 'Shift',
    nodesDraggable: true,
    zoomOnDoubleClick: false,
    onMove,
    onMoveEnd,
    onNodeDrag,
    onNodeDragStart,
    onNodeDragStop,
    onSelectionDragStop,
    onSelectionChange,
    onConnectStart,
    onConnectEnd,
    onDragOver,
    onDragLeave,
    onNodeContextMenu,
    onPaneContextMenu,
    onEdgeContextMenu,
    onNodeMouseEnter,
    onNodeMouseLeave,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
  };

  return {
    reactFlowInteractionProps,
    dropGhost,
    clearDropGhost,
    contextMenu,
    closeContextMenu,
    fitToFlow,
    groupSelectedNodes,
    snapGuides,
    hoveredNodeId,
    hoveredEdgeId,
  };
}
