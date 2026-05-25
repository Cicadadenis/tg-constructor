import React from 'react';
import { GraphCanvasActionsProvider } from '../builder/graphCanvasActionsContext.jsx';
import FlowCanvas from './FlowCanvas.jsx';
import './flow-editor.css';

/**
 * Primary product surface — full-bleed visual flow editor (ManyChat-style).
 */
export default function FlowEditorWorkspace({
  lang = 'ru',
  canvasRef,
  graphCanvasActions,
  onSelectNode,
  onInspectNode,
  onConnectFeedback,
  onDropPaletteEntry,
  onInsertNodeOnEdge,
  onRequestDeleteNodes,
  flowToolbarProps = null,
  canvasUxRef = null,
  overlays = null,
  emptyState = null,
}) {
  return (
    <div className="fe-workspace app-zone app-zone--center" data-zone="center" ref={canvasRef}>
      <div className="fe-workspace__stage mc-ds-canvas-host app-canvas-host">
        <GraphCanvasActionsProvider value={graphCanvasActions}>
          <FlowCanvas
            lang={lang}
            flowToolbarProps={flowToolbarProps}
            onSelectNode={onSelectNode}
            onInspectNode={onInspectNode}
            onConnectFeedback={onConnectFeedback}
            onDropPaletteEntry={onDropPaletteEntry}
            onInsertNodeOnEdge={onInsertNodeOnEdge}
            onRequestDeleteNodes={onRequestDeleteNodes}
            canvasUxRef={canvasUxRef}
          />
        </GraphCanvasActionsProvider>
        {overlays}
        {emptyState}
      </div>
    </div>
  );
}
