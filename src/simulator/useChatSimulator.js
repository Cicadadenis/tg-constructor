import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeCallbackData } from '../../core/codegen/callbackDataNormalize.js';
import {
  normalizeInboundEvent,
  resolveEventToPaletteEntry,
} from '../constructor/graph_document/palette_event_resolver.js';
import { highlightNodesFromTrace } from '../constructor/traceViewer.js';
import {
  previewOutboundToEntries,
  createUserTextEntry,
  createUserEventEntry,
} from './previewMessages.js';
import { playOutboundEntries } from './simulatorPlayback.js';
import { createSimulatorEventBus, SimulatorEventTypes } from './simulatorEventBus.js';
import {
  ensureMockSubscriber,
  applySubscriberEffectsFromOutbound,
  refreshSubscriberVariables,
  resetMockSubscriber,
  addMockTag,
  removeMockTag,
  switchMockSubscriber,
  SUBSCRIBER_PRESETS,
} from './subscriberSandbox.js';
import {
  createConversationSnapshot,
  restoreFromSnapshot,
} from './conversationSnapshots.js';
import {
  trackPreviewStep,
  trackButtonClick,
} from '../../core/analytics/runtimeBridge.js';
import { trackEvent, trackSessionStart } from '../analytics/client.js';
import { AnalyticsEventTypes } from '../../core/analytics/analyticsEventTypes.js';
import { runMockFlowStep } from './mockExecutionEngine.js';

const PREVIEW_SESSION_STORAGE_KEY = 'cicada_preview_session_id';

function resetPreviewSessionStorage() {
  try {
    sessionStorage.removeItem(PREVIEW_SESSION_STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * @param {object} options
 * @param {() => object} options.generateCodegenSnapshot
 * @param {ReadonlyArray} [options.graphPalette]
 * @param {{ lang?: string, blockTypes?: ReadonlyArray }} [options.paletteOptions]
 * @param {() => object} [options.getGraphDocument]
 * @param {(nodeIds: string[]) => void} [options.onHighlightNodes]
 * @param {(traceId: string|null) => void} [options.onTraceId]
 * @param {(snap: object) => void} [options.onDebugSnapshot]
 * @param {string} [options.flowId]
 */
export function useChatSimulator({
  generateCodegenSnapshot,
  graphPalette = [],
  paletteOptions = {},
  getGraphDocument,
  onHighlightNodes,
  onTraceId,
  onDebugSnapshot,
  flowId = null,
  graphRevision = 0,
}) {
  const busRef = useRef(null);
  if (!busRef.current) busRef.current = createSimulatorEventBus();

  const playbackAbortRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [viewMode, setViewMode] = useState('mobile');
  const [debugOpen, setDebugOpen] = useState(true);
  const [activePresetId, setActivePresetId] = useState('new_user');
  const [drawerTab, setDrawerTab] = useState('path');
  const [subscriberSnapshot, setSubscriberSnapshot] = useState(null);
  const [variables, setVariables] = useState({});
  const [executionPath, setExecutionPath] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [lastTraceId, setLastTraceId] = useState(null);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [stepLog, setStepLog] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [lastBranchPort, setLastBranchPort] = useState(null);
  const [liveMode, setLiveMode] = useState(true);

  const subscriberCtxRef = useRef(null);
  const lastInboundRef = useRef(null);
  const autoStartRef = useRef(false);

  const initSubscriber = useCallback(async () => {
    const { context, variables: vars } = await ensureMockSubscriber();
    subscriberCtxRef.current = context;
    setSubscriberSnapshot(context);
    setVariables(vars);
    busRef.current.emit(SimulatorEventTypes.SUBSCRIBER, context);
    busRef.current.emit(SimulatorEventTypes.VARIABLES, vars);
    if (flowId) {
      trackSessionStart({
        flowId,
        sessionId: context.session?.id || 'sim-session',
        subscriberId: context.subscriber?.id,
      });
    }
    return context;
  }, [flowId]);

  useEffect(() => {
    initSubscriber();
  }, [initSubscriber]);

  const nodeLabel = useCallback((nodeId) => {
    if (!nodeId || !getGraphDocument) return nodeId || '—';
    const doc = getGraphDocument();
    const n = doc?.nodes?.[nodeId];
    if (!n) return nodeId;
    const p = n.data?.props ?? n.props ?? {};
    return p.title || p.label || n.type || nodeId;
  }, [getGraphDocument]);

  const appendExecutionStep = useCallback((step) => {
    setExecutionPath((prev) => [...prev.slice(-49), step]);
    busRef.current.emit(SimulatorEventTypes.EXECUTION_PATH, step);
  }, []);

  const runPreviewStep = useCallback(
    async ({ text = '', callbackData = null, event = null, userLabel = null }) => {
      playbackAbortRef.current?.abort();
      const ac = new AbortController();
      playbackAbortRef.current = ac;

      setBusy(true);
      setError(null);
      busRef.current.emit(SimulatorEventTypes.STEP_START, { event, text, callbackData });
      lastInboundRef.current = { event, text, callbackData, userLabel };

      try {
        if (!subscriberCtxRef.current) await initSubscriber();

        const snap = generateCodegenSnapshot();
        onDebugSnapshot?.(snap);

        const out = await runMockFlowStep({
          graphIR: snap.graph,
          generatedPython: snap.generatedPython,
          compileWarnings: snap.compileWarnings,
          transpileTrace: snap.transpileTrace,
          text: text != null ? String(text) : '',
          callbackData,
          event,
          palette: graphPalette,
          paletteOptions,
          flowId: flowId || undefined,
          botId: flowId || undefined,
        });

        if (out.debugSnapshot) onDebugSnapshot?.(out.debugSnapshot);
        if (out.traceId) {
          setLastTraceId(out.traceId);
          onTraceId?.(out.traceId);
        }

        let subCtx = subscriberCtxRef.current;
        subCtx = await applySubscriberEffectsFromOutbound(subCtx, out.effects);
        const vars = await refreshSubscriberVariables(subCtx);
        subscriberCtxRef.current = subCtx;
        setSubscriberSnapshot(subCtx);
        setVariables(vars);
        busRef.current.emit(SimulatorEventTypes.VARIABLES, vars);

        const branchPort = vars.__conditionPort ?? vars.__lastCondition != null
          ? (vars.__lastCondition ? 'true' : 'false')
          : null;
        if (branchPort != null) {
          setLastBranchPort(String(branchPort));
          busRef.current.emit(SimulatorEventTypes.BRANCH, branchPort);
        }

        const paletteEntry = out.paletteEntry;
        const traceHighlight = highlightNodesFromTrace(out.traceView?.events ?? []);
        const activeNodes = traceHighlight.active.length
          ? traceHighlight.active
          : paletteEntry?.id
            ? [paletteEntry.id]
            : (snap.transpileTrace || []).slice(-1).map((t) => t.nodeId).filter(Boolean);

        const primaryNode = activeNodes[activeNodes.length - 1] ?? null;
        setActiveNodeId(primaryNode);
        if (primaryNode) busRef.current.emit(SimulatorEventTypes.ACTIVE_NODE, primaryNode);
        if (activeNodes.length) onHighlightNodes?.(activeNodes);

        const inboundLabel = userLabel
          || normalizeInboundEvent(event ?? { kind: 'text', text }).text
          || callbackData
          || 'step';

        appendExecutionStep({
          id: `step-${Date.now()}`,
          ts: Date.now(),
          inbound: inboundLabel,
          nodeIds: activeNodes,
          nodeLabels: activeNodes.map(nodeLabel),
          outboundCount: (out.effects ?? []).length,
          traceId: out.traceId ?? null,
          branchPort: branchPort ?? null,
        });

        const stepEntry = {
          ts: Date.now(),
          inbound: inboundLabel,
          effects: out.effects,
          traceId: out.traceId,
          activeNodeId: primaryNode,
          branchPort: branchPort ?? null,
        };
        setStepLog((prev) => [...prev, stepEntry]);

        const entries = previewOutboundToEntries(out.effects, vars);
        const simulate = testMode;

        await playOutboundEntries({
          entries,
          simulateTyping: simulate,
          simulateDelays: simulate,
          signal: ac.signal,
          onTyping: (show) => {
            setTyping(show);
            busRef.current.emit(SimulatorEventTypes.TYPING, show);
          },
          onShow: (entry) => {
            setMessages((prev) => {
              const next = [...prev, entry];
              if (liveMode) setReplayIndex(next.length - 1);
              busRef.current.emit(SimulatorEventTypes.MESSAGE_ADD, entry);
              return next;
            });
          },
        });

        setExecutionPath((path) => {
          setMessages((prevMsgs) => {
            setSnapshots((prevSnaps) => [
              ...prevSnaps,
              createConversationSnapshot({
                messages: prevMsgs,
                variables: vars,
                subscriberSnapshot: subCtx,
                executionPath: path,
                activeNodeId: primaryNode,
                lastTraceId: out.traceId,
                lastBranchPort: branchPort,
                inbound: inboundLabel,
              }),
            ]);
            return prevMsgs;
          });
          return path;
        });

        trackPreviewStep({
          flowId,
          botId: flowId || undefined,
          sessionId: subCtx?.session?.id || 'sim-session',
          subscriberId: subCtx?.subscriber?.id,
          activeNodeIds: activeNodes,
          inbound: inboundLabel,
          outbound: out.effects,
          traceId: out.traceId,
        });
        if (out.traceId) {
          trackEvent({
            type: AnalyticsEventTypes.EXECUTION_TRACE,
            flowId,
            traceId: out.traceId,
            properties: { events: out.traceView?.events?.slice(0, 100) },
          });
        }

        busRef.current.emit(SimulatorEventTypes.STEP_END, { activeNodeId: primaryNode });
      } catch (e) {
        const msg = e?.message || String(e);
        setError(msg);
        busRef.current.emit(SimulatorEventTypes.ERROR, msg);
      } finally {
        setBusy(false);
        setTyping(false);
      }
    },
    [
      generateCodegenSnapshot,
      graphPalette,
      paletteOptions,
      onDebugSnapshot,
      onTraceId,
      onHighlightNodes,
      testMode,
      liveMode,
      initSubscriber,
      appendExecutionStep,
      nodeLabel,
      flowId,
    ],
  );

  const sendText = useCallback(
    async (t) => {
      const text = String(t ?? '').trim();
      if (!text || busy) return;
      setMessages((prev) => [...prev, createUserTextEntry(text)]);
      await runPreviewStep({ event: { kind: 'text', text } });
    },
    [busy, runPreviewStep],
  );

  const sendCallback = useCallback(
    async (data) => {
      const cb = normalizeCallbackData(data);
      if (!cb || busy) return;
      trackButtonClick({
        flowId,
        botId: flowId || undefined,
        sessionId: subscriberCtxRef.current?.session?.id || 'sim-session',
        callbackData: cb,
        label: cb,
        kind: 'inline',
        nodeId: activeNodeId,
      });
      setMessages((prev) => [...prev, createUserTextEntry(`ⓘ ${cb}`)]);
      await runPreviewStep({ event: { kind: 'callback', callbackData: cb } });
    },
    [busy, runPreviewStep, flowId, activeNodeId],
  );

  const injectEvent = useCallback(
    async (inboundEvent, userLabel) => {
      if (busy) return;
      const label = userLabel
        || normalizeInboundEvent(inboundEvent).text
        || inboundEvent?.kind
        || 'event';
      setMessages((prev) => [...prev, createUserEventEntry(label, inboundEvent?.kind)]);
      resolveEventToPaletteEntry(inboundEvent, graphPalette, paletteOptions);
      await runPreviewStep({ event: inboundEvent, userLabel: label });
    },
    [busy, runPreviewStep, graphPalette, paletteOptions],
  );

  const resetSession = useCallback((opts = {}) => {
    playbackAbortRef.current?.abort();
    autoStartRef.current = false;
    resetPreviewSessionStorage();
    setMessages([]);
    setDraft('');
    setError(null);
    setExecutionPath([]);
    setActiveNodeId(null);
    setStepLog([]);
    setReplayIndex(-1);
    setSnapshots([]);
    setLastBranchPort(null);
    lastInboundRef.current = null;
    if (opts.presetId) setActivePresetId(opts.presetId);
    resetMockSubscriber(opts.presetId || activePresetId);
    initSubscriber();
    busRef.current.emit(SimulatorEventTypes.RESET);
    runPreviewStepRef.current?.({ event: { kind: 'text', text: '/start' }, userLabel: '/start' });
  }, [initSubscriber, activePresetId]);

  const switchSubscriber = useCallback(async (presetId) => {
    if (!presetId || busy) return;
    setActivePresetId(presetId);
    resetSession({ presetId });
  }, [busy, resetSession]);

  const replayToSnapshot = useCallback((snapshotIndex) => {
    const idx = Math.max(0, Math.min(snapshotIndex, snapshots.length - 1));
    const snap = snapshots[idx];
    if (!snap) return;
    const restored = restoreFromSnapshot(snap);
    setMessages(restored.messages);
    setVariables(restored.variables);
    setSubscriberSnapshot(restored.subscriberSnapshot);
    subscriberCtxRef.current = restored.subscriberSnapshot;
    setExecutionPath(restored.executionPath);
    setActiveNodeId(restored.activeNodeId);
    setLastTraceId(restored.lastTraceId);
    setLastBranchPort(restored.lastBranchPort);
    setReplayIndex(restored.replayIndex);
    if (restored.activeNodeId) onHighlightNodes?.([restored.activeNodeId]);
    busRef.current.emit(SimulatorEventTypes.REPLAY, { index: idx, snapshot: snap });
  }, [snapshots, onHighlightNodes]);

  const replayToIndex = useCallback((messageIndex) => {
    if (!snapshots.length) {
      const idx = Math.max(0, Math.min(messageIndex, messages.length - 1));
      setReplayIndex(idx);
      busRef.current.emit(SimulatorEventTypes.REPLAY, { index: idx });
      return;
    }
    let snapIdx = 0;
    let count = 0;
    for (let i = 0; i < snapshots.length; i += 1) {
      count = snapshots[i].messages?.length ?? 0;
      if (messageIndex < count) {
        snapIdx = i;
        break;
      }
      snapIdx = i;
    }
    replayToSnapshot(snapIdx);
  }, [snapshots, messages.length, replayToSnapshot]);

  const replaySnapshot = useMemo(() => {
    if (replayIndex < 0 || liveMode) return messages;
    return messages.slice(0, replayIndex + 1);
  }, [messages, replayIndex, liveMode]);

  const addTag = useCallback(async (tag) => {
    let subCtx = subscriberCtxRef.current;
    if (!subCtx) subCtx = await initSubscriber();
    subCtx = addMockTag(subCtx, tag);
    subscriberCtxRef.current = subCtx;
    const vars = await refreshSubscriberVariables(subCtx);
    setSubscriberSnapshot(subCtx);
    setVariables(vars);
    busRef.current.emit(SimulatorEventTypes.VARIABLES, vars);
  }, [initSubscriber]);

  const removeTag = useCallback(async (tag) => {
    let subCtx = subscriberCtxRef.current;
    if (!subCtx) return;
    subCtx = removeMockTag(subCtx, tag);
    subscriberCtxRef.current = subCtx;
    const vars = await refreshSubscriberVariables(subCtx);
    setSubscriberSnapshot(subCtx);
    setVariables(vars);
    busRef.current.emit(SimulatorEventTypes.VARIABLES, vars);
  }, []);

  const repeatLastStep = useCallback(async () => {
    const last = lastInboundRef.current;
    if (!last || busy) return;
    await runPreviewStep(last);
  }, [busy, runPreviewStep]);

  const probeCondition = useCallback(
    async (expression) => {
      if (busy) return;
      await runPreviewStep({
        event: { kind: 'text', text: `/probe ${expression}` },
        userLabel: `probe: ${expression}`,
      });
    },
    [busy, runPreviewStep],
  );

  const runPreviewStepRef = useRef(runPreviewStep);
  runPreviewStepRef.current = runPreviewStep;

  /** Auto-start flow once per session (isolated sandbox). */
  useEffect(() => {
    if (autoStartRef.current) return;
    autoStartRef.current = true;
    const t = setTimeout(() => {
      runPreviewStepRef.current({ event: { kind: 'text', text: '/start' }, userLabel: '/start' }).catch(() => {
        autoStartRef.current = false;
      });
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const lastGraphRevRef = useRef(0);
  useEffect(() => {
    if (!graphRevision || graphRevision === lastGraphRevRef.current) return;
    lastGraphRevRef.current = graphRevision;
    if (messages.length === 0) return;
    runPreviewStepRef.current?.(lastInboundRef.current || {
      event: { kind: 'text', text: '/start' },
      userLabel: '/start',
    }).catch(() => {});
  }, [graphRevision, messages.length]);

  const bus = busRef.current;

  return {
    messages,
    replaySnapshot,
    draft,
    setDraft,
    busy,
    error,
    typing,
    testMode,
    setTestMode,
    viewMode,
    setViewMode,
    debugOpen,
    setDebugOpen,
    subscriberSnapshot,
    variables,
    executionPath,
    activeNodeId,
    lastTraceId,
    replayIndex,
    replayToIndex,
    stepLog,
    snapshots,
    lastBranchPort,
    lastInbound: lastInboundRef.current,
    liveMode,
    setLiveMode,
    bus,
    sendText,
    sendCallback,
    injectEvent,
    resetSession,
    runPreviewStep,
    nodeLabel,
    addTag,
    removeTag,
    repeatLastStep,
    probeCondition,
    replayToSnapshot,
    switchSubscriber,
    activePresetId,
    subscriberPresets: SUBSCRIBER_PRESETS,
    drawerTab,
    setDrawerTab,
    focusNodeOnCanvas: (nodeId) => {
      if (nodeId) onHighlightNodes?.([nodeId]);
    },
  };
}
