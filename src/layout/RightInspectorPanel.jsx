import React from 'react';
import FlowInspector from '../flow-editor/inspector/FlowInspector.jsx';

/**
 * Floating right inspector — ManyChat-style properties rail.
 * @deprecated Import FlowInspector directly; this wrapper preserves App API.
 */
export default function RightInspectorPanel({
  tab,
  onTabChange,
  canSeeCode = false,
  onLockedCodeTab,
  inspector,
  codePane = null,
  lockedCodePane = null,
  simulatorPane = null,
  simulatorActive = false,
  lang = 'ru',
  /* new FlowInspector props — pass-through when migrating App */
  ...flowInspectorProps
}) {
  if (flowInspectorProps.block != null || flowInspectorProps.graph != null) {
    return (
      <FlowInspector
        tab={tab}
        onTabChange={onTabChange}
        canSeeCode={canSeeCode}
        onLockedCodeTab={onLockedCodeTab}
        codePane={codePane}
        lockedCodePane={lockedCodePane}
        simulatorPane={simulatorPane}
        lang={lang}
        {...flowInspectorProps}
      />
    );
  }

  return (
    <div className="fi-shell app-zone app-zone--right mc-inspector-panel" data-zone="right">
      <div className="fi-shell__body">{inspector}</div>
    </div>
  );
}
