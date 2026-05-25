import React, { useCallback, useRef, useState } from 'react';
import { useChatSimulator } from './useChatSimulator.js';
import MessengerPreview from './components/MessengerPreview.jsx';
import SimulatorDebugPanel from './components/SimulatorDebugPanel.jsx';
import SimulatorStudioBar from './components/SimulatorStudioBar.jsx';
import ExecutionPathRail from './components/ExecutionPathRail.jsx';
import BranchTestingPanel from './components/BranchTestingPanel.jsx';
import './chat-simulator.css';
import './telegram-simulator-studio.css';

/**
 * Realtime Telegram simulator — production preview in inspector or floating panel.
 */
export default function ChatSimulatorPanel({
  open,
  onClose,
  isMobileView = false,
  variant = 'floating',
  panelPos = null,
  onPanelPosChange,
  onUndock,
  generateCodegenSnapshot,
  getGraphDocument,
  graphPalette = [],
  paletteOptions = {},
  onHighlightNodes,
  onTraceId,
  onDebugSnapshot,
  botName = 'Test Bot',
  flowId = null,
  graphRevision = 0,
  inspectorEmbed = false,
  lang = 'ru',
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
    graphRevision,
  });

  const startDrag = useCallback((e) => {
    if (e.button !== 0 || inspectorEmbed) return;
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
  }, [onPanelPosChange, inspectorEmbed]);

  const handleFile = useCallback(
    async (file) => {
      if (!file || sim.busy) return;
      const name = file.name || 'file';
      await sim.injectEvent({ kind: 'document', fileId: name }, `📎 ${name}`);
    },
    [sim],
  );

  if (!open) return null;

  const isDocked = variant === 'docked';
  const isStudio = inspectorEmbed || isDocked;
  const t = lang === 'en'
    ? { title: 'Telegram preview', realtime: 'live' }
    : lang === 'uk'
      ? { title: 'Telegram превʼю', realtime: 'live' }
      : { title: 'Telegram превью', realtime: 'live' };

  const posStyle = isDocked || inspectorEmbed
    ? undefined
    : panelPos
      ? { left: panelPos.left, top: panelPos.top, right: 'auto', bottom: 'auto' }
      : isMobileView
        ? { left: 8, right: 8, bottom: 72, top: '10vh' }
        : { right: 20, bottom: 20 };

  const displayMessages = sim.liveMode !== false ? sim.messages : sim.replaySnapshot;

  const debugPanel = (
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
      lang={lang}
    />
  );

  return (
    <div
      ref={panelRef}
      className={[
        'chat-sim-panel',
        isMobileView ? 'chat-sim-panel--mobile-host' : '',
        isDocked ? 'chat-sim-panel--docked' : '',
        inspectorEmbed ? 'chat-sim-panel--inspector-embed' : '',
        isStudio ? 'chat-sim-panel--studio' : '',
      ].filter(Boolean).join(' ')}
      style={posStyle}
      role={isDocked || inspectorEmbed ? 'region' : 'dialog'}
      aria-label="Telegram simulator"
    >
      {!isStudio && (
        <header className="chat-sim-panel__head" onMouseDown={startDrag}>
          <div className="chat-sim-panel__title-wrap">
            <h2 className="chat-sim-panel__title">{t.title}</h2>
            <span className="chat-sim-panel__badge">{t.realtime}</span>
          </div>
          <div className="chat-sim-panel__toolbar">
            <div className="chat-sim-panel__view-toggle" role="group">
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
            <button type="button" className="chat-sim-panel__btn" onClick={() => sim.resetSession()}>
              ↻
            </button>
            {onClose && (
              <button type="button" className="chat-sim-panel__btn chat-sim-panel__btn--close" onClick={onClose}>
                ✕
              </button>
            )}
          </div>
        </header>
      )}

      {isStudio && (
        <>
          <div className="tg-sim-studio__head">
            <span className="tg-sim-studio__live" aria-hidden />
            <span className="tg-sim-studio__title">{t.title}</span>
            <span className="tg-sim-studio__badge">{t.realtime}</span>
            {onUndock && (
              <button type="button" className="tg-sim-studio__undock" onClick={onUndock} title="Открепить">
                ⧉
              </button>
            )}
          </div>
          <SimulatorStudioBar
            lang={lang}
            busy={sim.busy}
            liveMode={sim.liveMode}
            testMode={sim.testMode}
            viewMode={sim.viewMode}
            onViewModeChange={sim.setViewMode}
            onRestart={() => sim.resetSession()}
            onInject={sim.injectEvent}
            onToggleLiveMode={sim.setLiveMode}
            onToggleTestMode={sim.setTestMode}
            subscriberPresets={sim.subscriberPresets}
            activePresetId={sim.activePresetId}
            onSwitchSubscriber={sim.switchSubscriber}
            onOpenDrawerTab={(tab) => {
              sim.setDrawerTab(tab);
              setDebugTab(tab);
              sim.setDebugOpen(true);
            }}
          />
        </>
      )}

      {sim.error && (
        <div className="chat-sim-panel__error" role="alert">{sim.error}</div>
      )}

      {isStudio && (
        <ExecutionPathRail
          steps={sim.executionPath}
          activeNodeId={sim.activeNodeId}
          busy={sim.busy}
          lang={lang}
          onStepClick={sim.focusNodeOnCanvas}
        />
      )}

      <div className={`chat-sim-panel__body${isStudio ? ' chat-sim-panel__body--studio' : ''}`}>
        <div className="chat-sim-panel__main">
          <MessengerPreview
            messages={displayMessages}
            typing={sim.typing}
            busy={sim.busy}
            botName={botName}
            activeNodeId={sim.activeNodeId}
            activeNodeLabel={sim.activeNodeId ? sim.nodeLabel(sim.activeNodeId) : null}
            viewMode={sim.viewMode}
            useDeviceFrame={isStudio}
            draft={sim.draft}
            onDraftChange={sim.setDraft}
            onSendText={sim.sendText}
            onSendCallback={sim.sendCallback}
            fileInputRef={fileInputRef}
            onFilePick={handleFile}
            onSubmitDraft={() => {
              const text = sim.draft;
              sim.setDraft('');
              sim.sendText(text);
            }}
            toolbar={!isStudio && (
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
            )}
          />
        </div>
        {!isStudio && debugPanel}
      </div>

      {isStudio && (
        <div className={`tg-sim-drawer${sim.debugOpen ? ' tg-sim-drawer--open' : ''}`}>
          {debugPanel}
        </div>
      )}

      {sim.busy && <div className="chat-sim-panel__busy-bar" aria-hidden />}
    </div>
  );
}
