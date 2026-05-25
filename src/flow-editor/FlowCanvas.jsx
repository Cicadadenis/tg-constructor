import React from 'react';
import ConnectedGraphCanvas from '../builder/ConnectedGraphCanvas.jsx';

/**
 * FlowCanvas — GraphDocument-native infinite workspace (React Flow @xyflow/react).
 * Rendering pipeline lives in builder/ReactFlowCanvas; this is the product-facing shell.
 */
export default function FlowCanvas({
  lang = 'ru',
  onSelectNode,
  onInspectNode,
  onConnectFeedback,
  onDropPaletteEntry,
  onInsertNodeOnEdge,
  onRequestDeleteNodes,
  flowToolbarProps = null,
  canvasUxRef = null,
}) {
  return (
    <div className="fe-canvas-host" data-tour="flow-editor-canvas">
      <ConnectedGraphCanvas
        lang={lang}
        canvasUxRef={canvasUxRef}
        onSelectNode={onSelectNode}
        onInspectNode={onInspectNode}
        onConnectFeedback={onConnectFeedback}
        onDropPaletteEntry={onDropPaletteEntry}
        onInsertNodeOnEdge={onInsertNodeOnEdge}
        onRequestDeleteNodes={onRequestDeleteNodes}
        flowToolbarProps={flowToolbarProps}
        flowEditorChrome
      />
    </div>
  );
}
