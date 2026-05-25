import React, { useCallback, useRef, useState } from 'react';
import { useChatSimulator } from './useChatSimulator.js';
import MessengerPreview from './components/MessengerPreview.jsx';
import SimulatorDebugPanel from './components/SimulatorDebugPanel.jsx';
import EventInjector from './components/EventInjector.jsx';
import BranchTestingPanel from './components/BranchTestingPanel.jsx';
import LiveStatusBar from './components/LiveStatusBar.jsx';
import './chat-simulator.css';

/**
 * ManyChat-style realtime chat simulator — embedded messenger + runtime debug.
 */
export default function ChatSimulatorPanel({
  open,
  onClose,
  isMobileView = false,
  panelPos = null,
  onPanelPosChange,
  generateCodegenSnapshot,
  getGraphDocument,
  graphPalette = [],
  paletteOptions = {},
  onHighlightNodes,
  onTraceId,
  onDebugSnapshot,
  botName = 'Test Bot',
  flowId = null,
}) {
  const panelRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragRef = useRef(null);
  const [debugTab, setDebugTab] = useState('path');

  const sim = useChatSimulator({
    generateCodegenSnapshot,
    getGraphDocument,
    graphPalette,
    paletteOptions,
    onHighlightNodes,
    onTraceId,
    onDebugSnapshot,
    flowId,
  });

  const startDrag = useCallback((e) => {
    if (e.button !== 0) return;
    const el = e.target;
    if (el.closest?.('button, input, a, textarea, select')) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    onPanelPosChange?.({ left: rect.left, top: rect.top });
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      let left = d.originLeft + (ev.clientX - d.startX);
      let top = d.originTop + (ev.clientY - d.startY);
      const margin = 8;
      left = Math.max(margin, Math.min(left, window.innerWidth - d.width - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - d.height - margin));
      onPanelPosChange?.({ left, top });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    e.preventDefault();
  }, [onPanelPosChange]);

  const handleFile = useCallback(
    async (file) => {
      if (!file || sim.busy) return;
      const name = file.name || 'file';
      await sim.injectEvent({ kind: 'document', fileId: name }, `📎 ${name}`);
    },
    [sim],
  );

  if (!open) return null;

  const posStyle = panelPos
    ? { left: panelPos.left, top: panelPos.top, right: 'auto', bottom: 'auto' }
    : isMobileView
      ? { left: 8, right: 8, bottom: 72, top: '10vh' }
      : { right: 20, bottom: 20 };

  const displayMessages = sim.liveMode !== false ? sim.messages : sim.replaySnapshot;

  return (
    <div
      ref={panelRef}
      className={`chat-sim-panel ${isMobileView ? 'chat-sim-panel--mobile-host' : ''}`}
      style={posStyle}
      role="dialog"
      aria-label="Chat simulator"
    >
      <header className="chat-sim-panel__head" onMouseDown={startDrag}>
        <div className="chat-sim-panel__title-wrap">
          <h2 className="chat-sim-panel__title">Flow Simulator</h2>
          <span className="chat-sim-panel__badge">realtime</span>
        </div>
        <div className="chat-sim-panel__toolbar">
          <div className="chat-sim-panel__view-toggle" role="group" aria-label="Preview size">
            <button
              type="button"
              className={sim.viewMode === 'mobile' ? 'is-active' : ''}
              onClick={() => sim.setViewMode('mobile')}
            >
              Mobile
            </button>
            <button
              type="button"
              className={sim.viewMode === 'desktop' ? 'is-active' : ''}
              onClick={() => sim.setViewMode('desktop')}
            >
              Desktop
            </button>
          </div>
          <button type="button" className="chat-sim-panel__btn" onClick={sim.resetSession}>
            Reset
          </button>
          <button type="button" className="chat-sim-panel__btn chat-sim-panel__btn--close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      </header>

      <p className="chat-sim-panel__hint">
        Изолированная песочница · mock subscriber · live execution через preview worker
      </p>

      {sim.error && (
        <div className="chat-sim-panel__error" role="alert">{sim.error}</div>
      )}

      <LiveStatusBar
        busy={sim.busy}
        typing={sim.typing}
        activeNodeId={sim.activeNodeId}
        nodeLabel={sim.nodeLabel}
        testMode={sim.testMode}
        messageCount={sim.messages.length}
      />

      <div className="chat-sim-panel__body">
        <div className="chat-sim-panel__main">
          <MessengerPreview
            messages={displayMessages}
            typing={sim.typing}
            busy={sim.busy}
            botName={botName}
            activeNodeId={sim.activeNodeId}
            activeNodeLabel={sim.activeNodeId ? sim.nodeLabel(sim.activeNodeId) : null}
            viewMode={sim.viewMode}
            draft={sim.draft}
            onDraftChange={sim.setDraft}
            onSendText={sim.sendText}
            onSendCallback={sim.sendCallback}
            fileInputRef={fileInputRef}
            onFilePick={handleFile}
            onSubmitDraft={() => {
              const t = sim.draft;
              sim.setDraft('');
              sim.sendText(t);
            }}
            toolbar={(
              <>
                <EventInjector busy={sim.busy} onInject={sim.injectEvent} />
                <BranchTestingPanel
                  busy={sim.busy}
                  lastBranchPort={sim.lastBranchPort}
                  lastInbound={sim.lastInbound}
                  subscriberTags={sim.subscriberSnapshot?.subscriber?.tags ?? []}
                  onAddTag={sim.addTag}
                  onRemoveTag={sim.removeTag}
                  onRepeatLast={sim.repeatLastStep}
                  onInjectConditionProbe={sim.probeCondition}
                />
              </>
            )}
          />
        </div>

        <SimulatorDebugPanel
          open={sim.debugOpen}
          onToggle={() => sim.setDebugOpen((v) => !v)}
          tab={debugTab}
          onTabChange={setDebugTab}
          variables={sim.variables}
          executionPath={sim.executionPath}
          activeNodeId={sim.activeNodeId}
          subscriberSnapshot={sim.subscriberSnapshot}
          stepLog={sim.stepLog}
          lastTraceId={sim.lastTraceId}
          replayIndex={sim.replayIndex}
          messageCount={sim.messages.length}
          snapshotCount={sim.snapshots?.length ?? 0}
          onReplayIndex={sim.replayToIndex}
          onReplaySnapshot={sim.replayToSnapshot}
          lastBranchPort={sim.lastBranchPort}
          testMode={sim.testMode}
          onTestModeChange={sim.setTestMode}
          liveMode={sim.liveMode}
          onLiveModeChange={sim.setLiveMode}
        />
      </div>

      {sim.busy && <div className="chat-sim-panel__busy-bar" aria-hidden />}
    </div>
  );
}
