import React, { useCallback } from 'react';
import { GraphCanvas } from './GraphCanvas.jsx';
import { useGraphApi, useCanvasProjection } from '../stores/hooks/useGraphSelectors.js';
import { useSelectionStore, selectActiveRepairHighlight } from '../stores/selectionStore.js';
import { useUiStore } from '../stores/uiStore.js';

/**
 * Canvas connected to Zustand — no selectedBlockId / projection prop drilling.
 */
export default function ConnectedGraphCanvas({
  onSelectNode,
  onInspectNode,
  onConnectFeedback,
  onDropPaletteEntry,
  onInsertNodeOnEdge,
  onRequestDeleteNodes,
  lang,
  flowToolbarProps = null,
  flowEditorChrome = true,
  canvasUxRef = null,
}) {
  const graph = useGraphApi();
  const projection = useCanvasProjection();
  const selectedBlockId = useSelectionStore((s) => s.selectedBlockId);
  const draggingPaletteEntry = useSelectionStore((s) => s.draggingPaletteEntry);
  const highlight = useSelectionStore(selectActiveRepairHighlight);
  const graphStrict = useUiStore((s) => s.graphStrictMode);
  void graphStrict;

  const handleSelect = useCallback((id) => {
    useSelectionStore.getState().selectNode(id);
    onSelectNode?.(id);
  }, [onSelectNode]);

  return (
    <GraphCanvas
      graph={graph}
      projection={projection}
      selectedBlockId={selectedBlockId}
      repairHighlightNodeIds={highlight.nodeIds}
      repairHighlightEdgeIds={highlight.edgeIds}
      highlightKind={highlight.active ? highlight.kind : null}
      lang={lang}
      onSelectNode={handleSelect}
      onInspectNode={onInspectNode}
      onConnectFeedback={onConnectFeedback}
      onDropPaletteEntry={onDropPaletteEntry}
      onInsertNodeOnEdge={onInsertNodeOnEdge}
      onRequestDeleteNodes={onRequestDeleteNodes}
      paletteDragEntry={draggingPaletteEntry}
      flowToolbarProps={flowToolbarProps}
      flowEditorChrome={flowEditorChrome}
      canvasUxRef={canvasUxRef}
    />
  );
}
