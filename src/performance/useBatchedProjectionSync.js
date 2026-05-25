import { useCallback, useEffect, useRef } from 'react';
import { scheduleBatched } from './batchedUpdates.js';
import {
  mergeProjectionEdges,
  mergeProjectionNodes,
  mergeSelectionOnNodes,
} from '../builder/projectionSync.js';
import {
  recordCanvasRender,
  recordEdgeSync,
  recordNodeSync,
  recordSelectionUpdate,
  recordSkippedSync,
} from './renderDiagnostics.js';
import { applyLazyRenderFlags, getVisibleFlowBounds } from './viewportCull.js';
import { zoomToTier } from './zoomTier.js';
import { resolveExecutionPathEdgeIds } from '../builder/canvas/canvasEdgeStyles.js';

const BATCH_KEY = 'canvas-projection';

/**
 * RAF-batched projection → ReactFlow sync with incremental merge + selection fast-path.
 */
export function useBatchedProjectionSync({
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
  viewport,
  canvasSize,
  applyEdgeDefaultsFn,
  enrichEdgesFn,
}) {
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const lastSelectionRef = useRef(null);

  const runSync = useCallback(() => {
    const t0 = performance.now();
    recordCanvasRender();

    const rev = projection?.metadata?.revision;
    const nodeCount = projection?.nodes?.length ?? 0;
    const previewSig = projection?.previewSignature ?? '';
    const syncKey = `${rev ?? ''}:${nodeCount}:${previewSig}:${highlightKind ?? ''}`;
    const selectionKey = selectedBlockId ?? '';

    const onlySelectionChanged =
      syncKey === lastRevRef.current
      && !draggingRef.current
      && selectionKey !== lastSelectionRef.current
      && nodesRef.current.length > 0;

    if (onlySelectionChanged) {
      recordSelectionUpdate();
      setNodes((current) => {
        const next = mergeSelectionOnNodes(current, selectedBlockId);
        nodesRef.current = next;
        return next;
      });
      lastSelectionRef.current = selectionKey;
      return;
    }

    if (syncKey === lastRevRef.current && !draggingRef.current) {
      recordSkippedSync();
      return;
    }

    lastRevRef.current = syncKey;
    lastSelectionRef.current = selectionKey;

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

    let projectedNodes = projection.nodes || [];
    const tier = viewport ? zoomToTier(viewport.zoom) : 'full';
    if (viewport && canvasSize?.width > 0) {
      const bounds = getVisibleFlowBounds(viewport, canvasSize);
      projectedNodes = applyLazyRenderFlags(projectedNodes, bounds, tier);
    } else {
      projectedNodes = projectedNodes.map((n) => ({
        ...n,
        data: { ...n.data, zoomTier: tier, lazyRender: false, inViewport: true },
      }));
    }

    const nextEdges = enrichEdgesFn(
      applyEdgeDefaultsFn(projection.edges, doc, {
        repairedEdgeIds: repairEdgeIds,
        executionEdgeIds,
        kind: highlightKind,
      }),
      edgePicker,
    );

    setNodes((current) => {
      const next = mergeProjectionNodes(
        current,
        projectedNodes,
        selectedBlockId,
        { repairIds, executionIds },
        rev,
      );
      nodesRef.current = next;
      recordNodeSync(performance.now() - t0);
      return next;
    });

    setEdges((current) => {
      const next = mergeProjectionEdges(current, nextEdges);
      edgesRef.current = next;
      recordEdgeSync(performance.now() - t0);
      return next;
    });
  }, [
    projection?.metadata?.revision,
    projection?.nodes?.length,
    projection?.edges?.length,
    projection?.previewSignature,
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
    viewport?.x,
    viewport?.y,
    viewport?.zoom,
    canvasSize?.width,
    canvasSize?.height,
    applyEdgeDefaultsFn,
    enrichEdgesFn,
  ]);

  useEffect(() => {
    scheduleBatched(BATCH_KEY, runSync);
  }, [runSync]);

  return { nodesRef, edgesRef };
}
