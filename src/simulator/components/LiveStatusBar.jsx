import React from 'react';

export default function LiveStatusBar({
  busy,
  typing,
  activeNodeId,
  nodeLabel,
  testMode,
  messageCount,
}) {
  return (
    <div className="chat-sim__live-status" aria-live="polite">
      <span className={`chat-sim__live-dot ${busy || typing ? 'chat-sim__live-dot--pulse' : ''}`} />
      <span className="chat-sim__live-text">
        {typing ? 'Печатает…' : busy ? 'Выполнение…' : 'Готов'}
        {testMode && !busy && ' · test mode'}
      </span>
      {activeNodeId && (
        <span className="chat-sim__live-node" title={activeNodeId}>
          → {nodeLabel?.(activeNodeId) ?? activeNodeId}
        </span>
      )}
      <span className="chat-sim__live-count">{messageCount} msg</span>
    </div>
  );
}
