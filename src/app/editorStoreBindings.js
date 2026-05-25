import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useUiStore,
  useFlowStore,
  useSelectionStore,
  usePreviewStore,
  useAnalyticsStore,
  selectActiveRepairHighlight,
} from '../stores/index.js';
import { useGraphRevision, useCanvasProjection, useGraphApi } from '../stores/hooks/useGraphSelectors.js';
import { useGraphStore } from '../stores/graphStore.js';

/**
 * Central bindings — App reads slices here instead of 70+ useState hooks.
 */
export function useEditorStoreBindings() {
  const graph = useGraphApi();
  const graphRevision = useGraphRevision();
  const canvasProjection = useCanvasProjection();
  const graphHistory = useGraphStore(useShallow((s) => ({
    canUndo: s.canUndo,
    canRedo: s.canRedo,
    cursor: s.historyCursor,
    length: s.historyLength,
  })));

  const selectedBlockId = useSelectionStore((s) => s.selectedBlockId);
  const setSelectedBlockId = useCallback((idOrUpdater) => {
    const { selectedBlockId, selectNode } = useSelectionStore.getState();
    const next = typeof idOrUpdater === 'function'
      ? idOrUpdater(selectedBlockId)
      : idOrUpdater;
    selectNode(next);
  }, []);

  const mobileAttentionBlockId = useSelectionStore((s) => s.mobileAttentionBlockId);
  const setMobileAttentionBlockId = useCallback((id) => {
    useSelectionStore.getState().setMobileAttention(id);
  }, []);

  const draggingPaletteEntry = useSelectionStore((s) => s.draggingPaletteEntry);
  const setDraggingPaletteEntry = useCallback((entry) => {
    useSelectionStore.getState().setDraggingPaletteEntry(entry);
  }, []);

  const repairHighlight = useSelectionStore((s) => s.repairHighlight);
  const setRepairHighlight = useCallback((payload) => {
    useSelectionStore.getState().setRepairHighlight(payload);
  }, []);

  const activeProjectId = useFlowStore((s) => s.activeProjectId);
  const setActiveProjectId = useCallback((id) => {
    useFlowStore.getState().patch({ activeProjectId: id });
  }, []);

  const projectName = useFlowStore((s) => s.projectName);
  const setProjectName = useCallback((name) => {
    useFlowStore.getState().patch({ projectName: name });
  }, []);

  const flowLayoutMode = useFlowStore((s) => s.flowLayoutMode);
  const setFlowLayoutMode = useCallback((mode) => {
    useFlowStore.getState().setFlowLayoutMode(mode);
  }, []);

  const serverRunProjectId = useFlowStore((s) => s.serverRunProjectId);
  const setServerRunProjectId = useCallback((id) => {
    useFlowStore.getState().patch({ serverRunProjectId: id });
  }, []);

  const previewPanelOpen = usePreviewStore((s) => s.previewPanelOpen);
  const setPreviewPanelOpen = useCallback((open) => {
    usePreviewStore.getState().setPreviewPanelOpen(open);
  }, []);

  const previewPanelPos = usePreviewStore((s) => s.previewPanelPos);
  const setPreviewPanelPos = useCallback((pos) => {
    usePreviewStore.getState().setPreviewPanelPos(pos);
  }, []);

  const simulatorDocked = usePreviewStore((s) => s.simulatorDocked);
  const setSimulatorDocked = useCallback((docked) => {
    usePreviewStore.getState().setSimulatorDocked(docked);
  }, []);

  const analyticsPanelOpen = useAnalyticsStore((s) => s.panelOpen);
  const setAnalyticsPanelOpen = useCallback((open) => {
    useAnalyticsStore.getState().setPanelOpen(open);
  }, []);

  const analyticsPanelPos = useAnalyticsStore((s) => s.panelPos);
  const setAnalyticsPanelPos = useCallback((pos) => {
    useAnalyticsStore.getState().setPanelPos(pos);
  }, []);

  const debugTraceId = usePreviewStore((s) => s.debugTraceId);
  const setDebugTraceId = useCallback((id) => {
    usePreviewStore.getState().patch({ debugTraceId: id });
  }, []);

  const ui = useUiStore(useShallow((s) => ({
    appSection: s.appSection,
    mobileZone: s.mobileZone,
    inspectorTab: s.inspectorTab,
    isMobileView: s.isMobileView,
    showInstructions: s.showInstructions,
    showExamples: s.showExamples,
    showLibrary: s.showLibrary,
    showAIModal: s.showAIModal,
    tourActive: s.tourActive,
    tourStep: s.tourStep,
    graphStrictMode: s.graphStrictMode,
    botDebugOpen: s.botDebugOpen,
    graphDiagOpen: s.graphDiagOpen,
    toast: s.toast,
  })));

  const setUi = useCallback((partial) => {
    useUiStore.getState().patch(partial);
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    useUiStore.getState().showToast(message, type);
  }, []);

  const preview = usePreviewStore(useShallow((s) => ({
    isSandboxRunning: s.isSandboxRunning,
    isServerRunning: s.isServerRunning,
    isStartingSandbox: s.isStartingSandbox,
    isStartingServer: s.isStartingServer,
    startBotError: s.startBotError,
    isStoppingSandbox: s.isStoppingSandbox,
    isStoppingServer: s.isStoppingServer,
    stopBotError: s.stopBotError,
    sandboxSecondsLeft: s.sandboxSecondsLeft,
  })));

  const setPreview = useCallback((partial) => {
    usePreviewStore.getState().patch(partial);
  }, []);

  return {
    graph,
    graphRevision,
    canvasProjection,
    graphHistory,
    selectedBlockId,
    setSelectedBlockId,
    mobileAttentionBlockId,
    setMobileAttentionBlockId,
    draggingPaletteEntry,
    setDraggingPaletteEntry,
    repairHighlight,
    setRepairHighlight,
    activeProjectId,
    setActiveProjectId,
    projectName,
    setProjectName,
    flowLayoutMode,
    setFlowLayoutMode,
    serverRunProjectId,
    setServerRunProjectId,
    previewPanelOpen,
    setPreviewPanelOpen,
    previewPanelPos,
    setPreviewPanelPos,
    simulatorDocked,
    setSimulatorDocked,
    analyticsPanelOpen,
    setAnalyticsPanelOpen,
    analyticsPanelPos,
    setAnalyticsPanelPos,
    debugTraceId,
    setDebugTraceId,
    ui,
    setUi,
    showToast,
    preview,
    setPreview,
  };
}
