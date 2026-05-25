import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import cicadaLogo from './cicada-logo_1778117072446.jpeg';
import { ModuleLibraryModal } from './ModuleLibrary';
import InstructionsModal from './InstructionsModal.jsx';
import LandingInfoModal from './landing/LandingInfoModal.jsx';
import AuthModal from './auth/AuthModal.jsx';
import ProfileModal from './profile/ProfileModal.jsx';
import { appAlert, appConfirm } from './dialog/appDialog.js';
import {
  BLOCK_FOOTER_ACTION_TYPES,
  BLOCK_W,
  BLOCK_H,
  ROOT_H,
  MOBILE_TOP_BAR_H,
  MOBILE_BOTTOM_NAV_H,
  DEFAULT_PROPS,
  normalizeStudioBlockNode,
  createStudioBlockNode,
  UI_ATTACHMENT_LEGACY_BLOCK_TYPES,
  legacyBlockToUiAttachment,
  addUiAttachment,
  normalizeAiPartialResponse,
  uid,
  syncUidSequenceFromGraph,
  AiDiagnosticSection,
  Sidebar,
} from './builder/BuilderComponents.jsx';
import PythonPane from './builder/PythonPane.jsx';
import CanvasCompileErrors from './builder/CanvasCompileErrors.jsx';
import CanvasSoftValidationHint from './builder/CanvasSoftValidationHint.jsx';
import { extractIfConditionFromLine, isConditionLikeType, parseIfConditionFromDsl } from '../core/dslCondition.js';
import { canRenderUi } from '../core/capabilityEngine.js';
import { canAttach } from '../core/capabilityEngine.js';
import { buildPreviewCodegenSnapshot } from './constructor/previewCodegenBridge.js';
import { normalizeCallbackData } from '../core/codegen/callbackDataNormalize.js';
import { getCsrfTokenForRequest } from './csrf.js';
import { getConstructorStrings } from './builderI18n.js';
import { buildLocalizedBlockCatalog } from './constructor/block_catalog.js';
import {
  resolveApiUrl,
  apiFetch,
  postJsonWithCsrf,
  saveSession,
  getSession,
  clearSession,
  fetchSessionUserFromServer,
  fetchOauthBootstrapUser,
  completeOauth2FA,
  registerUser,
  loginUser,
  updateUser,
  uploadAvatar,
  isMobileBuilderViewport,
  normalizeSessionUser,
  getDevBypassUser,
  isAuthBypassEnabled,
  resolveInitialSessionUser,
} from './apiClient.js';
import { BlockInfoContext, AddBlockContext, BuilderUiContext } from './builderContext.js';
import { AppLayoutProvider } from './layout/AppLayoutContext.jsx';
import EditorShell from './layout/EditorShell.jsx';
import { ChatSimulatorPanel } from './simulator/index.js';
import { AnalyticsHub } from './analytics/index.js';
import { registerFlow } from './analytics/client.js';
import { getIncrementalCompileSnapshot } from './performance/incrementalCompile.js';
import { AiFlowStudio } from './ai/index.js';
import {
  ProductWelcome,
  GuidedActionBar,
  GlobalLoading,
  EditorKeyboardShortcuts,
} from './polish/index.js';
import EditorUxLayer from './ux/EditorUxLayer.jsx';
import { useAiFlowStore } from './ai/aiFlowStore.js';
import LeftPanel from './layout/LeftPanel.jsx';
import { isCanvasSection, normalizeAppSection } from './layout/appSections.js';
import CenterPanel from './layout/CenterPanel.jsx';
import { FlowEditorWorkspace } from './flow-editor/index.js';
import { useAppLayout } from './layout/AppLayoutContext.jsx';
import RightInspectorPanel from './layout/RightInspectorPanel.jsx';
import SaveStatusIndicator from './layout/SaveStatusIndicator.jsx';
import { deriveFlowListMeta } from './layout/flowListMeta.js';
import { usePersistenceStore } from './stores/persistenceStore.js';
import MobileZoneNav from './layout/MobileZoneNav.jsx';
import { StoreProvider } from './app/StoreProvider.jsx';
import { useEditorStoreBindings } from './app/editorStoreBindings.js';
import ConnectedGraphCanvas from './builder/ConnectedGraphCanvas.jsx';
import { useGraphStore } from './stores/graphStore.js';
import { useUiStore } from './stores/uiStore.js';
import {
  migrateGraphDocument,
} from './constructor/graph_document/graph_migration.js';
import { importComposedGraph } from './constructor/graph_document/graph_fragment_import.js';
import {
  beginNodeEdit,
  beginKeyboardInsertion,
  commitKeyboardInsertion,
  rollbackKeyboardInsertion,
  endNodeEdit,
  markDraftField,
  commitNodeEdit,
} from './constructor/graph_document/graph_edit_session.js';
import {
  appendStacks,
  addBlockToStack,
  addNewStack,
  clearGraph,
  resetCorruptedGraphState,
  mergeStacks,
  moveStack,
  patchNodeData,
  removeNode,
  updateBlockUiAttachments,
} from './constructor/graph_document/graph_ui_orchestrator.js';
import {
  applyComposition,
  addNode as graphAddNode,
  addEdge as graphAddEdge,
  moveNode,
  setNodeData,
} from './constructor/graph_document/graph_operation_client.js';
import {
  buildGraphUiPalette,
  compilePaletteAction,
  getPaletteEntry,
  assertPaletteIntegrity,
} from './constructor/graph_document/graph_ui_palette.js';
import {
  matchLegacyEventStringRule,
} from './constructor/graph_document/palette_event_resolver.js';
import {
  loadPersistedCanvasBlob,
} from './constructor/graph_document/persist_bridge.js';
import { EXAMPLE_GRAPH_FLOWS, EXAMPLE_LABELS } from './exampleGraphFlows.js';
import { createGraphDocument } from './constructor/graph_document/graph_document.js';
import {
  addInlineButtonToOwner,
  addReplyButtonToOwner,
  ensureKeyboardNodeForOwner,
  linkKeyboardButtonToHandler,
} from './constructor/graph_document/graph_keyboard_operations.js';
import { generateCallbackId } from './constructor/graph_document/graph_keyboard_nodes.js';
import { isReplyCapable } from '../core/keyboard_topology.js';
import { validateGraphDocumentForEditor } from './constructor/graph_document/graph_validate.js';
import { validateGraph } from './constructor/graph_document/validate_graph.js';
import { computeViewportForNodes } from './constructor/graph_document/graph_viewport.js';
import { GraphCanvas } from './builder/GraphCanvas.jsx';
import { GraphCanvasActionsProvider } from './builder/graphCanvasActionsContext.jsx';
import {
  getNodeDeleteSummary,
  removeGraphNodes,
  duplicateGraphNode,
} from './builder/graph_node_delete.js';
import { getChainStepBelow } from './builder/blockLayout.js';
import { applyFlowBuilderLayout } from './builder/flowLayout/applyFlowBuilderLayout.js';
import EditorOverflowMenu, { EditorOverflowItem, EditorOverflowSeparator } from './layout/EditorOverflowMenu.jsx';
import './layout/editor-saas-shell.css';
import ToastHost from './ui/ToastHost.jsx';
import EmptyState from './ui/EmptyState.jsx';
import {
  normalizeFlowLayoutMode,
  readLayoutModeFromMetadata,
} from './builder/flowLayout/flowLayoutModes.js';
import { planInsertNodeOnEdge } from './builder/flowEdge/insertNodeOnEdge.js';
import { validateGraphSemantics, getNodePortDescriptors, canConnect, validateConnection } from './constructor/graph_document/operation_registry.js';
import { normalizeGraphError, normalizeConnectionError } from './builder/graph_error_messages.js';
import { shouldShowCanvasOnboardingOverlay } from './constructor/graph_document/graph_canvas_state.js';
import FlowCanvasEmptyState from './builder/FlowCanvasEmptyState.jsx';
import { exampleKeyForTemplate } from './builder/flowTemplates.js';
import { scheduleCanvasFocusAfterMutation } from './builder/canvas_graph_focus.js';
import { useSelectionStore } from './stores/selectionStore.js';
import { useCanvasAutosave } from './app/autosave/useCanvasAutosave.js';
import { useUserProjects } from './app/hooks/useUserProjects.js';
import '@xyflow/react/dist/style.css';
import { DebugTracePanel } from './builder/DebugTracePanel.jsx';
import { GraphDiagnosticsPanel } from './builder/GraphDiagnosticsPanel.jsx';
import { GraphValidationProvider } from './builder/graphValidationContext.jsx';
import { useGraphSoftValidation } from './builder/useGraphSoftValidation.js';
import { useGraphReferenceIndex } from './builder/useGraphReferenceIndex.js';
import { createCallbackHandlerForReference } from './constructor/graph_document/graph_reference_actions.js';
import { runFullGraphValidation } from './builder/graph_full_validation.js';
import { VALIDATION_STAGE } from './constructor/graph_document/validation_stages.js';
import {
  repairGraphIssues,
} from './constructor/graph_document/graph_auto_repair.js';
import {
  commitRepairTransaction,
  rollbackRepair,
} from './constructor/graph_document/graph_repair_transaction.js';
import {
  fireRegistrationConfetti,
  telegramAuth,
  loginWithPasskey,
} from './authHelpers.js';
import { FALLBACK_PRO_MONTHLY_USD, fetchPublicPlans, formatUsdPrice, getMonthlyProPriceUsd } from './pricingPlans.js';
import { openEsphomeConstructor } from './esphomeConstructorUrl.js';
import {
  captureReturnToFromUrl,
  clearRememberedReturnTo,
  hasReturnToIntent,
  peekReturnTo,
  redirectIfReturnTo,
  safeReturnTo,
} from './studioReturnTo.js';

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTS STORAGE — PostgreSQL via API
// ═══════════════════════════════════════════════════════════════════════════

async function saveProjectToCloud(_userId, projectName, graphDocument, projectId = null) {
  const validation = validateGraphDocumentForEditor(graphDocument);
  if (!validation.ok) {
    throw new Error(validation.errors[0]?.message || validation.issues?.[0]?.message || 'Flow validation failed before cloud save');
  }
  const payload = {
    name: projectName,
    graph_document: createGraphDocument(graphDocument),
  };
  if (projectId) payload.id = projectId;
  const data = await apiFetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.project;
}

function exportProjectToFile(graphDocument) {
  const validation = validateGraphDocumentForEditor(graphDocument);
  if (!validation.ok) {
    throw new Error(validation.errors[0]?.message || validation.issues?.[0]?.message || 'Flow validation failed before export');
  }
  const payload = createGraphDocument(graphDocument);
  const data = JSON.stringify({
    schema_version: payload.schema_version,
    nodes: Object.values(payload.nodes),
    edges: Object.values(payload.edges),
    metadata: payload.metadata,
    viewport: payload.viewport,
    ui_state: payload.ui_state,
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cicada-project.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function getUserProjects(_userId) {
  try {
    const data = await apiFetch('/api/projects');
    return data.projects || [];
  } catch {
    return [];
  }
}

async function deleteProject(projectId) {
  await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' });
}

async function loadProjectFromCloud(projectId) {
  try {
    const data = await apiFetch(`/api/projects/${projectId}`);
    return data.project || null;
  } catch {
    return null;
  }
}

const SERVER_PROJECT_STORAGE_KEY = 'cicada_server_project_id';

function generatePreviewCodegenSnapshot(getDocument, options = {}) {
  const doc = typeof getDocument === 'function' ? getDocument() : getDocument;
  return getIncrementalCompileSnapshot(doc, () => buildPreviewCodegenSnapshot(doc, options));
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVER AUTH API
// ═══════════════════════════════════════════════════════════════════════════


// Re-export from users.js for compatibility

// ─── BLOCK INFO CONTEXT ──────────────────────────────────────────────────────

const LANDING_PAGE_CONTENT = {
  features:  { type: 'features',  title: 'Возможности' },
  templates: { type: 'templates', title: 'Шаблоны' },
  docs:      { type: 'docs',      title: 'Документация' },
  pricing:   { type: 'pricing',   title: 'Тарифы' },
};

const LANDING_NAV_PILLS = [
  { id: 'features', label: 'Возможности', icon: '✨', clr: 'rgba(251,191,36,0.45)' },
  { id: 'templates', label: 'Шаблоны', icon: '🎨', clr: 'rgba(96,165,250,0.45)' },
  { id: 'pricing', label: 'Тарифы', icon: '💳', clr: 'rgba(52,211,153,0.45)' },
  {
    id: 'esphome',
    label: 'ESPHome Конструктор',
    icon: '⚡',
    clr: 'rgba(168,85,247,0.45)',
    external: true,
    onClick: () => openEsphomeConstructor(),
  },
];

// ─── BLOCK DEFINITIONS ───────────────────────────────────────────────────────

function TopBarAdminButton({ isMobileView, onClick, dataTour = 'top-admin' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour={dataTour}
      title="Открыть админ-панель"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: isMobileView ? '7px 9px' : '7px 14px',
        background: 'linear-gradient(135deg,rgba(251,191,36,0.16),rgba(124,58,237,0.12))',
        border: '1px solid rgba(251,191,36,0.42)',
        borderRadius: isMobileView ? 8 : 20,
        color: '#fde68a',
        fontSize: isMobileView ? 11 : 12,
        fontWeight: 800,
        fontFamily: 'Syne, system-ui',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        boxShadow: '0 0 16px rgba(251,191,36,0.14)',
      }}
    >
      <span>⚙</span>
      <span>Admin</span>
    </button>
  );
}

function PremiumLockedPanel({ title = 'Функция доступна в Pro', text = 'Оформи Premium, чтобы открыть этот раздел.', onUpgrade, isMobile = false }) {
  return (
    <div style={{
      flex: isMobile ? '1 1 auto' : '0 0 50%',
      minHeight: isMobile ? 0 : 180,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? 18 : 20,
      borderTop: '1px solid rgba(178,128,255,0.22)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.018), rgba(111,70,255,0.06))',
    }}>
      <button
        type="button"
        onClick={onUpgrade}
        style={{
          width: '100%',
          maxWidth: 260,
          padding: '18px 16px',
          borderRadius: 18,
          border: '1px solid rgba(251,191,36,0.34)',
          background: 'linear-gradient(145deg, rgba(251,191,36,0.09), rgba(111,70,255,0.12))',
          color: 'rgba(255,255,255,0.78)',
          cursor: 'pointer',
          textAlign: 'center',
          fontFamily: 'Syne, system-ui',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px rgba(4,1,20,0.24)',
          filter: 'saturate(0.72)',
        }}
      >
        <div style={{ fontSize: 30, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fde68a', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 11, lineHeight: 1.45, color: 'rgba(255,255,255,0.48)' }}>{text}</div>
      </button>
    </div>
  );
}

function AdminRoute({ currentUser, onLoginClick }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) return undefined;
    if (currentUser.role !== 'admin') {
      setError('Доступ только для администратора');
      return undefined;
    }

    let cancelled = false;
    async function loadAdminUi() {
      try {
        await apiFetch('/api/admin/enter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const res = await fetch('/api/admin/ui', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(res.status === 403 ? 'Нет прав администратора' : 'Не удалось загрузить админку');
        const raw = await res.text();
        if (!cancelled) setHtml(raw);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Не удалось открыть админку');
      }
    }
    loadAdminUi();
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    const handleAdminMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event?.data?.type === 'cicada-admin:navigate-builder') {
        window.location.assign('/');
      }
    };
    window.addEventListener('message', handleAdminMessage);
    return () => window.removeEventListener('message', handleAdminMessage);
  }, []);

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#08070f', color: '#fff', fontFamily: 'system-ui,sans-serif', padding: 20 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 10px', fontFamily: 'Syne,system-ui' }}>Админка защищена</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>Войдите в аккаунт администратора, чтобы открыть панель.</p>
          <button type="button" onClick={onLoginClick} style={{ marginTop: 12, padding: '11px 18px', borderRadius: 12, border: 0, background: '#f59e0b', color: '#111', fontWeight: 800, cursor: 'pointer' }}>Войти</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#08070f', color: '#fff', fontFamily: 'system-ui,sans-serif', padding: 20 }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 10px', fontFamily: 'Syne,system-ui' }}>Доступ закрыт</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{error}</p>
          <button type="button" onClick={() => { window.location.href = '/'; }} style={{ marginTop: 12, padding: '11px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Вернуться в конструктор</button>
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#08070f', color: 'rgba(255,255,255,0.76)', fontFamily: 'system-ui,sans-serif' }}>
        Загрузка админки...
      </div>
    );
  }

  return (
    <iframe
      title="Cicada Admin"
      srcDoc={html}
      sandbox="allow-scripts allow-forms allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, background: '#0e0f11' }}
    />
  );
}

// ─── CANVAS AUTOSAVE (canonical impl in src/app/autosave/canvasStorage.js) ──
import {
  canvasKeyForUser,
  saveCanvasForKey as _saveCanvasForKey,
} from './app/autosave/canvasStorage.js';

function saveCanvasForKey(key, graph) {
  _saveCanvasForKey(key, graph);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(file);
  });
}

function OnboardingTour({ steps, stepIndex, onNext, onPrev, onSkip, labels }) {
  const step = steps[stepIndex];
  const [targetRect, setTargetRect] = useState(null);
  const L = labels || {};
  const stepOf = typeof L.tourStepOf === 'function'
    ? L.tourStepOf(stepIndex + 1, steps.length)
    : `Шаг ${stepIndex + 1} из ${steps.length}`;
  const skipLabel = L.tourSkip || 'Пропустить';
  const backLabel = L.tourBack || 'Назад';
  const nextLabel = L.tourNext || 'Далее';
  const doneLabel = L.tourDone || 'Готово';

  useEffect(() => {
    if (!step?.selector) {
      setTargetRect(null);
      return;
    }
    const updateRect = () => {
      const el = document.querySelector(step.selector);
      if (!el) {
        setTargetRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setTargetRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    };
    updateRect();
    const id = setInterval(updateRect, 250);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [step?.selector]);

  if (!step) return null;

  const isLast = stepIndex >= steps.length - 1;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const tourGap = 12;
  const cardWidth = Math.min(340, Math.max(260, viewportWidth - tourGap * 2));
  const cardMaxHeight = Math.min(360, Math.max(220, viewportHeight - tourGap * 2));
  const clampTour = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
  const prefersSideCard = targetRect && (
    targetRect.height > viewportHeight * 0.35 ||
    targetRect.width > viewportWidth * 0.45
  );
  const rightCardLeft = targetRect ? targetRect.left + targetRect.width + tourGap : 0;
  const leftCardLeft = targetRect ? targetRect.left - cardWidth - tourGap : 0;
  const canPlaceRight = targetRect && rightCardLeft + cardWidth <= viewportWidth - tourGap;
  const canPlaceLeft = targetRect && leftCardLeft >= tourGap;
  let cardTop = targetRect
    ? clampTour(targetRect.top + targetRect.height + tourGap, tourGap, viewportHeight - cardMaxHeight - tourGap)
    : clampTour((viewportHeight - cardMaxHeight) / 2, tourGap, viewportHeight - cardMaxHeight - tourGap);
  let cardLeft = targetRect
    ? clampTour(targetRect.left, tourGap, viewportWidth - cardWidth - tourGap)
    : clampTour((viewportWidth - cardWidth) / 2, tourGap, viewportWidth - cardWidth - tourGap);

  if (targetRect && prefersSideCard && (canPlaceRight || canPlaceLeft)) {
    cardLeft = canPlaceRight ? rightCardLeft : leftCardLeft;
    cardTop = clampTour(targetRect.top + 8, tourGap, viewportHeight - cardMaxHeight - tourGap);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,12,0.7)' }} />

      {targetRect && (
        <div
          style={{
            position: 'absolute',
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: 12,
            border: '2px solid #f97316',
            boxShadow: '0 0 0 9999px rgba(2,6,12,0.62), 0 0 28px rgba(249,115,22,0.55)',
            transition: 'all 0.2s ease',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          top: cardTop,
          left: cardLeft,
          width: cardWidth,
          maxHeight: `calc(100vh - ${tourGap * 2}px)`,
          background: 'linear-gradient(160deg,#0d0920,#10082a)',
          border: '1px solid rgba(249,115,22,0.35)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 24px rgba(249,115,22,0.1)',
          pointerEvents: 'auto',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 14px 10px', overflowY: 'auto', minHeight: 0 }}>
          <div style={{ fontSize: 10, color: 'rgba(249,115,22,0.8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>
            {stepOf}
          </div>
          <div style={{ fontFamily: 'Syne,system-ui', fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 7 }}>
            {step.title}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: 'rgba(255,255,255,0.72)' }}>
            {step.text}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', padding: '10px 14px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <button
            onClick={onSkip}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            {skipLabel}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onPrev}
              disabled={stepIndex === 0}
              style={{ background: 'rgba(255,255,255,0.05)', color: stepIndex === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 10px', fontSize: 12, cursor: stepIndex === 0 ? 'not-allowed' : 'pointer' }}
            >
              {backLabel}
            </button>
            <button
              onClick={onNext}
              style={{ background: 'linear-gradient(135deg,#f97316,#dc2626)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}
            >
              {isLast ? doneLabel : nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Этапы для оверлея во время AI-генерации схемы бота */
const AI_GEN_LOADING_STEPS = [
  'Анализирую',
  'Исправляю структуру',
  'Оптимизирую сценарий для стабильного выполнения...',
  'Проверяю сценарии',
  'Готово',
];
/** Legacy modal limit; AI Flow Studio uses src/ai/promptTemplates.js (2000). */
const AI_PROMPT_MAX_CHARS = 50;

// ─── GRAPH-NATIVE HELPERS ─────────────────────────────────────────────────
// Canonical implementations live in src/app/graph/graphHelpers.js

import {
  graphGetNodes,
  graphHasNodeOfType,
  graphHasRunnableBot,
  graphHasBotBlock,
  injectBotTokenInPython,
  graphHasCommandNamed,
  graphGetUniqueConflictMessage,
  graphResolveBotToken,
  graphMakePropsForNewNode as graphMakePropsForNewBlock,
  graphResolveNodeType,
  graphCanDuplicateNodeType,
  graphCanChainAfter,
  resolveUiAttachmentTargetNodeId,
  resolveFlowInsertAnchorId,
  resolvePaletteChainParentId,
  graphUniqueBlockLabel,
} from './app/graph/graphHelpers.js';
import { UnknownBlockTypeError } from './constructor/graph_document/graph_node_payload.js';
import { isPlaceholderBotToken } from '../core/botTokenPlaceholders.mjs';

/**
 * Flow editor center — must render inside AppLayoutProvider (toolbar focus mode).
 */
function FlowEditorCenter({
  canvasRef,
  canvasUxRef,
  graphCanvasActions,
  uiLang,
  graphHistory,
  flowLayoutMode,
  handleGraphUndo,
  handleGraphRedo,
  handleFlowLayoutModeChange,
  applyCanvasLayout,
  handleSelectNode,
  handleInspectNode,
  handleConnectFeedback,
  handleCanvasDrop,
  handleInsertNodeOnEdge,
  handleRequestDeleteNodes,
  graph,
  graphRevision,
  handleHighlightCompileNodes,
  handleFitAllCanvasNodes,
  handleResetCorruptedGraph,
  guidedCanvasActions,
  mobileZone,
  showCanvasOnboarding,
  canUseAiGenerator,
  handleApplyFlowTemplate,
  openAiGeneratorModal,
  setTourStep,
  setTourActive,
  aiGlobalLoading,
}) {
  const { toggleFocusMode, focusMode } = useAppLayout();

  return (
    <FlowEditorWorkspace
      canvasRef={canvasRef}
      canvasUxRef={canvasUxRef}
      graphCanvasActions={graphCanvasActions}
      lang={uiLang}
      flowToolbarProps={{
        canUndo: graphHistory.canUndo,
        canRedo: graphHistory.canRedo,
        onUndo: handleGraphUndo,
        onRedo: handleGraphRedo,
        onToggleHistory: () => window.dispatchEvent(new Event('cicada:toggle-history')),
        layoutMode: flowLayoutMode,
        onLayoutModeChange: handleFlowLayoutModeChange,
        onRelayout: () => applyCanvasLayout(),
        onFocusMode: toggleFocusMode,
        focusMode,
      }}
      onSelectNode={handleSelectNode}
      onInspectNode={handleInspectNode}
      onConnectFeedback={handleConnectFeedback}
      onDropPaletteEntry={handleCanvasDrop}
      onInsertNodeOnEdge={handleInsertNodeOnEdge}
      onRequestDeleteNodes={handleRequestDeleteNodes}
      overlays={(
        <>
          <CanvasSoftValidationHint />
          <CanvasCompileErrors
            getGraphDocument={graph.getGraphDocument}
            graphRevision={graphRevision}
            onHighlightNodeIds={handleHighlightCompileNodes}
            onFitAllNodes={handleFitAllCanvasNodes}
            onResetCorruptedGraph={handleResetCorruptedGraph}
            onApplyRepair={(operations) => {
              for (const op of operations || []) graph.dispatch(op.type, op.payload);
            }}
          />
          <GuidedActionBar
            actions={guidedCanvasActions}
            visible={guidedCanvasActions.length > 0 && mobileZone === 'canvas'}
          />
        </>
      )}
      emptyState={(
        <FlowCanvasEmptyState
          show={showCanvasOnboarding}
          lang={uiLang}
          canUseAiGenerator={canUseAiGenerator}
          onApplyTemplate={handleApplyFlowTemplate}
          onOpenAi={openAiGeneratorModal}
          onStartTour={() => { setTourStep(0); setTourActive(true); }}
          busy={aiGlobalLoading}
        />
      )}
    />
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    if (isAuthBypassEnabled()) {
      return resolveInitialSessionUser(getSession);
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1' || params.get('oauth_login')) return null;
    // Источник истины — httpOnly cookie user_session; localStorage часто устаревает после рестарта backend.
    return null;
  });
  const uiLang = (currentUser?.uiLanguage || 'ru').toLowerCase();
  const builderBlockTypes = React.useMemo(() => buildLocalizedBlockCatalog(uiLang), [uiLang]);
  const graphPalette = React.useMemo(() => {
    const palette = buildGraphUiPalette(uiLang, { blockTypes: builderBlockTypes });
    if (import.meta.env?.DEV) {
      assertPaletteIntegrity(palette);
    }
    return palette;
  }, [uiLang, builderBlockTypes]);
  const builderUi = React.useMemo(() => getConstructorStrings(uiLang), [uiLang]);
  const canvasStorageKey = React.useMemo(() => canvasKeyForUser(currentUser), [currentUser?.id]);
  const builderUiContextValue = React.useMemo(
    () => ({ lang: uiLang, blockTypes: builderBlockTypes, graphPalette, t: builderUi }),
    [uiLang, builderBlockTypes, graphPalette, builderUi],
  );

  const {
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
    ui: uiSlice,
    setUi,
    showToast: showToastFromStore,
    preview: previewSlice,
    setPreview,
  } = useEditorStoreBindings();
  const syncGraphUidSequence = useCallback(() => {
    syncUidSequenceFromGraph(graph.getGraphDocument());
  }, [graph]);
  const afterCanvasHydrateRef = useRef(null);
  const { beginLoad } = useCanvasAutosave(graph, canvasStorageKey, {
    graphRevision,
    onAfterHydrate: (result) => afterCanvasHydrateRef.current?.(result),
  });
  /** Legacy autosave guard — old bundles still assign .current during graph loads */
  const skipNextCanvasSave = useRef(false);
  const { userProjects, setUserProjects, loadUserProjects, projectsLoading } = useUserProjects();
  const graphNodeCount = React.useMemo(
    () => Object.keys(graph.getGraphDocument().nodes || {}).length,
    [graph, graphRevision],
  );

  const canvasOnboardingDismissed = uiSlice.canvasOnboardingDismissed;

  const showCanvasOnboarding = React.useMemo(() => {
    if (canvasOnboardingDismissed || draggingPaletteEntry) return false;
    const doc = graph.getGraphDocument();
    return shouldShowCanvasOnboardingOverlay(doc);
  }, [graph, graphRevision, graphNodeCount, canvasOnboardingDismissed, draggingPaletteEntry]);

  const handlePaletteDragStart = useCallback((entry) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('cicada-palette-dragging', Boolean(entry));
    }
    setDraggingPaletteEntry(entry);
    if (entry) {
      useUiStore.getState().patch({ canvasOnboardingDismissed: true });
    }
  }, [setDraggingPaletteEntry]);

  const debugTraceOpen = useUiStore((s) => s.debugTraceOpen);
  const setDebugTraceOpen = (open) => setUi({ debugTraceOpen: open });
  const debugCodegenSnapshot = useUiStore((s) => s.debugCodegenSnapshot);
  const setDebugCodegenSnapshot = (snap) => setUi({ debugCodegenSnapshot: snap });
  const showInstructions = uiSlice.showInstructions;
  const setShowInstructions = (v) => setUi({ showInstructions: v });
  const canvasRef = useRef(null);
  const canvasUxRef = useRef(null);
  const lastAutosaveToastRef = useRef(0);
  const applyCanvasLayoutRef = useRef(null);
  const applyCanvasLayout = useCallback((modeOverride) => {
    const mode = normalizeFlowLayoutMode(modeOverride ?? flowLayoutMode);
    return applyFlowBuilderLayout(graph, mode);
  }, [graph, flowLayoutMode]);

  applyCanvasLayoutRef.current = applyCanvasLayout;

  const focusCanvasAfterContent = useCallback(() => {
    scheduleCanvasFocusAfterMutation(
      graph,
      {
        width: canvasRef.current?.clientWidth,
        height: canvasRef.current?.clientHeight,
      },
      {
        onLayout: () => {
          applyCanvasLayoutRef.current?.();
        },
        onSelectNode: (id) => setSelectedBlockId(id),
      },
    );
  }, [graph]);

  const handleFlowLayoutModeChange = useCallback((mode) => {
    const normalized = setFlowLayoutMode(mode);
    graph.dispatch('PatchMetadata', { patch: { layoutMode: normalized } });
    applyFlowBuilderLayout(graph, normalized);
  }, [graph, setFlowLayoutMode]);

  const handleFitAllCanvasNodes = useCallback(() => {
    applyCanvasLayout();
    const nodes = Object.values(graph.getGraphDocument().nodes || {});
    if (!nodes.length) return;
    graph.setViewport(computeViewportForNodes(nodes, {
      width: canvasRef.current?.clientWidth,
      height: canvasRef.current?.clientHeight,
    }));
  }, [graph]);

  const [showAuthModal, setShowAuthModal] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('login') === '1';
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState('profile');
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [oauth2faPending, setOauth2faPending] = useState(false);
  const analyticsFlowId = activeProjectId || 'draft-flow';
  const analyticsNodeIds = React.useMemo(() => {
    const doc = graph.getGraphDocument();
    return Object.keys(doc?.nodes || {});
  }, [graph, graphRevision]);

  useEffect(() => {
    if (analyticsNodeIds.length) {
      registerFlow(analyticsFlowId, analyticsNodeIds);
    }
  }, [analyticsFlowId, analyticsNodeIds.join('|')]);

  const showExamples = uiSlice.showExamples;
  const setShowExamples = (v) => setUi({ showExamples: v });
  /** Якорь кнопки «Примеры» — меню рендерим в portal, иначе перекрывается холстом / stacking context шапки */
  const examplesToggleRef = useRef(null);
  const [examplesMenuRect, setExamplesMenuRect] = useState(null);
  const filesMenuToggleRef = useRef(null);
  const [filesMenuRect, setFilesMenuRect] = useState(null);
  const showLibrary = uiSlice.showLibrary;
  const setShowLibrary = (v) => setUi({ showLibrary: v });
  const showAIModal = uiSlice.showAIModal;
  const setShowAIModal = (v) => setUi({ showAIModal: v });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingStep, setAiLoadingStep] = useState(0);
  const [aiError, setAiError] = useState('');
  const [aiPartialResult, setAiPartialResult] = useState(null);
  const [aiDiagnosticsOpen, setAiDiagnosticsOpen] = useState(false);
  const [landingInfoPage, setLandingInfoPage] = useState(null); // features | templates | docs | pricing | null
  const [proMonthlyUsd, setProMonthlyUsd] = useState(null);

  const toast = uiSlice.toast;
  const toastTimeoutRef = useRef(null);
  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    if (!message) return;
    showToastFromStore(message, type);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      useUiStore.getState().hideToast();
      toastTimeoutRef.current = null;
    }, duration);
  }, [showToastFromStore]);

  const handleGraphUndo = useCallback(() => {
    const result = graph.undo();
    if (result?.error) {
      showToast(
        uiLang === 'en' ? 'Nothing to undo' : 'Нечего отменять',
        'info',
      );
    }
  }, [graph, showToast, uiLang]);

  const handleGraphRedo = useCallback(() => {
    const result = graph.redo();
    if (result?.error) {
      showToast(
        uiLang === 'en' ? 'Nothing to redo' : 'Нечего повторять',
        'info',
      );
    }
  }, [graph, showToast, uiLang]);

  afterCanvasHydrateRef.current = (hydrateResult) => {
    if (hydrateResult?.clearedCorruption) {
      showToast(
        builderUi.clearedCorruptedAutosave
          || 'Автосохранение было повреждено — холст очищен. Начните с «Старт» или выберите пример.',
        'info',
      );
      return;
    }
    syncGraphUidSequence();
    const nodes = Object.values(graph.getGraphDocument().nodes || {});
    if (!nodes.length) return;
    const metaMode = readLayoutModeFromMetadata(graph.getGraphDocument().metadata);
    setFlowLayoutMode(metaMode);
    applyCanvasLayoutRef.current?.(metaMode);
    focusCanvasAfterContent();
  };
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);
  const [adminOpenSupportCount, setAdminOpenSupportCount] = useState(0);
  const [userSupportUnreadCount, setUserSupportUnreadCount] = useState(0);
  const supportUnreadInitializedRef = useRef(false);

  // ─── ADMIN / TRIAL ───────────────────────────────────────────────────────
  
  const isAdmin = currentUser?.role === 'admin';
  /** Активная подписка PRO или пробный период — те же условия, что для AI и платных функций. */
  const hasActiveProSubscription = Boolean(
    currentUser &&
      currentUser.plan === 'pro' &&
      currentUser.subscriptionExp != null &&
      Number(currentUser.subscriptionExp) > Date.now(),
  );
  const isProjectMode = Boolean(activeProjectId);
  const canSeeCode = isAdmin || hasActiveProSubscription;
  const canUseAiGenerator = hasActiveProSubscription;
  const aiPromptText = aiPrompt.trim();
  const aiPromptTooShort = aiPromptText.length < 5;
  const aiPromptTooLong = aiPromptText.length > AI_PROMPT_MAX_CHARS;
  const canSubmitAiPrompt = !aiLoading && !aiPromptTooShort && !aiPromptTooLong && !aiPartialResult?.skeletonFallback;
  const proMonthlyPrice = proMonthlyUsd == null ? '...' : formatUsdPrice(proMonthlyUsd);

  useEffect(() => {
    let cancelled = false;
    fetchPublicPlans()
      .then((plans) => {
        if (!cancelled) setProMonthlyUsd(getMonthlyProPriceUsd(plans));
      })
      .catch(() => {
        if (!cancelled) setProMonthlyUsd(FALLBACK_PRO_MONTHLY_USD);
      });
    return () => { cancelled = true; };
  }, []);

  const openProfileModal = useCallback(() => {
    setProfileInitialTab('profile');
    setShowProfileModal(true);
  }, []);

  const openSupportModal = useCallback(() => {
    if (!currentUser) {
      setAuthTab('login');
      setShowAuthModal(true);
      return;
    }
    setProfileInitialTab('support');
    setShowProfileModal(true);
  }, [currentUser]);

  const openPremiumPurchase = useCallback(() => {
    if (!currentUser) {
      setAuthTab('register');
      setShowAuthModal(true);
      return;
    }
    setProfileInitialTab('subscription');
    setShowProfileModal(true);
  }, [currentUser]);

  const aiStudioOpen = useAiFlowStore((s) => s.studioOpen);

  const openAiGeneratorModal = useCallback(() => {
    if (!canUseAiGenerator) {
      openPremiumPurchase();
      return;
    }
    setAiPrompt('');
    setAiError('');
    setAiPartialResult(null);
    setAiDiagnosticsOpen(false);
    useAiFlowStore.getState().patch({ studioOpen: true, prompt: '', plan: null, error: null });
  }, [canUseAiGenerator, openPremiumPurchase]);

  const handleEditorClosePanels = useCallback(() => {
    if (aiStudioOpen) useAiFlowStore.getState().patch({ studioOpen: false });
    if (showProfileModal) setShowProfileModal(false);
    if (showLibrary) setShowLibrary(false);
    if (showInstructions) setShowInstructions(false);
    setShowAIModal(false);
  }, [aiStudioOpen, showProfileModal, showLibrary, showInstructions]);

  const openAdminMenu = useCallback(async (section = '') => {
    const target = section ? `/admin#${section}` : '/admin';
    if (!currentUser || currentUser.role !== 'admin') {
      await appAlert({
        title: 'Нет доступа',
        message: 'Админка доступна только учётной записи с ролью admin.',
        variant: 'warning',
      });
      return;
    }
    const serverUser = await fetchSessionUserFromServer();
    if (!serverUser || serverUser.role !== 'admin') {
      clearSession();
      setCurrentUser(null);
      setAuthTab('login');
      setShowAuthModal(true);
      await appAlert({
        title: 'Нет доступа',
        message: 'Вход не завершён на сервере. Войдите через Google или email, дождитесь исчезновения oauth_login из адреса и проверьте cookie user_session в DevTools.',
        variant: 'warning',
      });
      return;
    }
    try {
      await apiFetch('/api/admin/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (e) {
      const raw = String(e?.message || '');
      const message = raw === 'Forbidden' || raw.includes('user_session')
        ? 'Нет cookie user_session — завершите вход через Google или email (жёсткое обновление Ctrl+Shift+R после входа).'
        : (raw || 'Нет доступа к админке');
      await appAlert({
        title: 'Нет доступа',
        message,
        variant: 'warning',
      });
      return;
    }
    const opened = window.open(target, '_blank');
    if (opened) opened.opener = null;
    if (!opened) window.location.href = target;
  }, [currentUser]);

  // 3-zone layout state
  const appSection = normalizeAppSection(uiSlice.appSection);
  const setAppSection = (v) => setUi({ appSection: normalizeAppSection(v) });
  const mobileZone = uiSlice.mobileZone;
  const setMobileZone = (v) => setUi({ mobileZone: v });

  useEffect(() => {
    if (currentUser && isCanvasSection(appSection)) {
      setMobileZone('canvas');
      setPreviewPanelOpen(true);
    }
  }, [currentUser, appSection]);
  const inspectorTab = uiSlice.inspectorTab;
  const setInspectorTab = (v) => setUi({ inspectorTab: v });
  const [listSearch, setListSearch] = useState('');
  const [listFilter, setListFilter] = useState('all');
  const isMobile = isMobileBuilderViewport();
  const isMobileView = uiSlice.isMobileView;
  const setIsMobileView = (v) => setUi({ isMobileView: v });
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [showFilesMenu, setShowFilesMenu] = useState(false);
  const tourActive = uiSlice.tourActive;
  const setTourActive = (v) => setUi({ tourActive: v });
  const tourStep = uiSlice.tourStep;
  const setTourStep = (v) => setUi({ tourStep: v });

  const guidedCanvasActions = React.useMemo(() => {
    if (!isCanvasSection(appSection) || showCanvasOnboarding || !currentUser) return [];
    const en = uiLang === 'en';
    const actions = [];
    if (graphNodeCount > 0) {
      actions.push({
        id: 'blocks',
        icon: '🧱',
        label: en ? 'Blocks' : 'Блоки',
        title: en ? 'Open block palette' : 'Открыть палитру блоков',
        onClick: () => {
          if (isMobileView) setMobileZone('left');
          else if (appSection !== 'flows' && appSection !== 'automations') setAppSection('templates');
        },
      });
      if (canUseAiGenerator) {
        actions.push({
          id: 'ai',
          icon: '✨',
          label: en ? 'AI flow' : 'AI сценарий',
          onClick: openAiGeneratorModal,
        });
      }
      actions.push({
        id: 'tour',
        icon: '?',
        label: en ? 'Tour' : 'Тур',
        onClick: () => { setTourStep(0); setTourActive(true); },
      });
    }
    return actions;
  }, [
    appSection,
    showCanvasOnboarding,
    currentUser,
    graphNodeCount,
    uiLang,
    canUseAiGenerator,
    isMobileView,
    openAiGeneratorModal,
    setTourStep,
    setTourActive,
    setMobileZone,
    setAppSection,
  ]);

  useLayoutEffect(() => {
    if (!showExamples) {
      setExamplesMenuRect(null);
      return;
    }
    const el = examplesToggleRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setExamplesMenuRect({
      top: r.bottom + 6,
      left: Math.max(8, r.left),
      minWidth: Math.max(isMobileView ? 200 : 190, r.width),
    });
  }, [showExamples, isMobileView]);

  useLayoutEffect(() => {
    if (!showFilesMenu) {
      setFilesMenuRect(null);
      return;
    }
    const el = filesMenuToggleRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFilesMenuRect({
      top: r.bottom + 6,
      left: Math.max(8, r.left),
      minWidth: Math.max(186, r.width),
    });
  }, [showFilesMenu]);

  const onboardingKey = currentUser?.id
    ? `cicada_onboarding_v2_${currentUser.id}_${isMobileView ? 'mobile' : 'desktop'}`
    : null;

  const productWelcomeKey = currentUser?.id
    ? `cicada_product_welcome_v3_${currentUser.id}`
    : null;

  const [showProductWelcome, setShowProductWelcome] = useState(false);

  useEffect(() => {
    if (!productWelcomeKey || !currentUser) return;
    try {
      if (!localStorage.getItem(productWelcomeKey)) setShowProductWelcome(true);
    } catch { /* ignore */ }
  }, [productWelcomeKey, currentUser?.id]);

  const aiGlobalLoading = useAiFlowStore((s) => s.loading);

  const onboardingSteps = React.useMemo(() => {
    const ui = builderUi;
    if (isMobileView) {
      const m = [
        {
          selector: '[data-tour="mobile-examples"]',
          title: ui.tourMobileExamplesTitle,
          text: ui.tourMobileExamplesBody,
        },
        isAdmin
          ? {
            selector: '[data-tour="top-admin"]',
            title: ui.tourAdminTitle,
            text: ui.tourAdminBody,
          }
          : {
            selector: '[data-tour="mobile-ai"]',
            title: ui.tourMobileAiTitle,
            text: ui.tourMobileAiBody,
          },
        {
          selector: '[data-tour="mobile-more"]',
          title: ui.tourMobileMoreTitle,
          text: ui.tourMobileMoreBody,
        },
        {
          selector: '[data-tour="mobile-tab-blocks"]',
          title: ui.tourMobileBlocksTitle,
          text: ui.tourMobileBlocksBody,
          onEnter: () => setMobileZone('left'),
        },
        {
          selector: '[data-tour="mobile-tab-canvas"]',
          title: ui.tourMobileCanvasTitle,
          text: ui.tourMobileCanvasBody,
          onEnter: () => setMobileZone('canvas'),
        },
        {
          selector: '[data-tour="mobile-tab-props"]',
          title: ui.tourMobilePropsTitle,
          text: ui.tourMobilePropsBody,
          onEnter: () => { setMobileZone('right'); setInspectorTab('props'); },
        },
        {
          selector: '[data-tour="mobile-tab-dsl"]',
          title: ui.tourMobileDslTitle,
          text: ui.tourMobileDslBody,
          onEnter: () => { if (canSeeCode) { setMobileZone('right'); setInspectorTab('code'); } },
        },
        {
          selector: '[data-tour="mobile-run"]',
          title: ui.tourRunTitle,
          text: ui.tourRunBody,
          onEnter: () => setMobileZone('canvas'),
        },
        {
          selector: '[data-tour="profile-button"]',
          title: ui.tourProfileTitle,
          text: ui.tourProfileBody,
        },
      ];
      return m;
    }

    const steps = [
      {
        selector: '[data-tour="top-examples-desktop"]',
        title: ui.tourExamplesTitle,
        text: ui.tourExamplesBody,
      },
      {
        selector: '[data-tour="top-ai-desktop"]',
        title: ui.tourAiTitle,
        text: ui.tourAiBody,
      },
      {
        selector: '[data-tour="top-clear-desktop"]',
        title: ui.tourClearTitle,
        text: ui.tourClearBody,
      },
      {
        selector: '[data-tour="top-files-desktop"]',
        title: ui.tourFilesTitle,
        text: ui.tourFilesBody,
      },
      {
        selector: '[data-tour="bot-preview"]',
        title: ui.tourPreviewTitle,
        text: ui.tourPreviewBody,
      },
      {
        selector: '[data-tour="top-debug-desktop"]',
        title: ui.tourDebugTitle,
        text: ui.tourDebugBody,
      },
      {
        selector: '[data-tour="run-desktop"]',
        title: ui.tourRunTitle,
        text: ui.tourRunBody,
      },
      isAdmin
        ? {
          selector: '[data-tour="top-admin"]',
          title: ui.tourAdminTitle,
          text: ui.tourAdminBody,
        }
        : {
          selector: '[data-tour="top-premium-desktop"]',
          title: ui.tourPremiumTitle,
          text: ui.tourPremiumBody,
        },
      {
        selector: '[data-tour="profile-button"]',
        title: ui.tourProfileTitle,
        text: ui.tourProfileBody,
      },
      {
        selector: '[data-tour="top-help-desktop"]',
        title: ui.tourHelpTitle,
        text: ui.tourHelpBody,
      },
      {
        selector: '[data-tour="sidebar-desktop"]',
        title: ui.tourSidebarTitle,
        text: ui.tourSidebarBody,
      },
      {
        selector: '[data-tour="canvas-area"]',
        title: ui.tourCanvasTitle,
        text: ui.tourCanvasBody,
      },
      {
        selector: '[data-tour="props-panel-desktop"]',
        title: ui.tourPropsTitle,
        text: ui.tourPropsBody,
      },
    ];
    return steps;
  }, [isMobileView, isAdmin, canSeeCode, builderUi]);

  // Если триал-юзер оказался на вкладке dsl — сбросить
  useEffect(() => {
    if (inspectorTab === 'props') setInspectorTab('content');
    if (inspectorTab === 'simulator') setInspectorTab('content');
    if (!canSeeCode && inspectorTab === 'code') setInspectorTab('content');
  }, [canSeeCode, inspectorTab]);

  useEffect(() => {
    if (!isCanvasSection(appSection) && mobileZone === 'canvas') {
      setMobileZone('left');
    }
  }, [appSection, mobileZone]);

  useEffect(() => {
    const handler = () => setIsMobileView(isMobileBuilderViewport());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const setAppHeight = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
    };
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);
    window.visualViewport?.addEventListener('resize', setAppHeight);
    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
      window.visualViewport?.removeEventListener('resize', setAppHeight);
    };
  }, []);

  useEffect(() => {
    if (!currentUser || !onboardingKey) {
      setTourActive(false);
      setTourStep(0);
      return;
    }
    if (localStorage.getItem(onboardingKey) === 'done') return;
    const id = setTimeout(() => {
      setTourStep(0);
      setTourActive(true);
    }, 450);
    return () => clearTimeout(id);
  }, [currentUser, onboardingKey]);

  const onboardingStepsRef = useRef(onboardingSteps);
  onboardingStepsRef.current = onboardingSteps;

  useEffect(() => {
    if (!tourActive) return;
    const step = onboardingStepsRef.current[tourStep];
    if (step?.onEnter) step.onEnter();
  }, [tourActive, tourStep]);

  const finishTour = useCallback(() => {
    if (onboardingKey) {
      localStorage.setItem(onboardingKey, 'done');
    }
    setTourActive(false);
    setTourStep(0);
  }, [onboardingKey]);

  const insertNodeAfter = useCallback((parentId, nodeId, type, props) => {
    if (!parentId) return { ok: false, error: 'No parent' };
    const conflict = graphGetUniqueConflictMessage(graph, type, props, uiLang);
    if (conflict) return { ok: false, error: conflict };
    const doc = graph.getGraphDocument();
    const effectiveParentId = resolveFlowInsertAnchorId(doc, parentId, type);
    const parent = effectiveParentId ? doc.nodes[effectiveParentId] : null;
    if (!parent) {
      return {
        ok: false,
        error: uiLang === 'en' ? 'Select a step on the canvas first' : 'Сначала выберите шаг на холсте',
      };
    }
    const newPos = {
      x: parent.position.x,
      y: parent.position.y + getChainStepBelow(parent, doc),
    };

    const parentType = graphResolveNodeType(parent);
    const requestedParentId = parentId;
    parentId = effectiveParentId;
    // Бот/версия/старт и т.п. нельзя вставить в одну flow-цепочку (нет выхода или входа).
    if (!graphCanChainAfter(parentType, type)) {
      const added = graphAddNode(graph, { nodeId, type, position: newPos, data: props });
      if (!added?.ok) return { ok: false, error: added?.error || 'Add node failed' };
      return { ok: true, nodeId };
    }

    // Helper: choose ports by types (deterministic preference for 'flow')
    const choosePortsByTypes = (sourceType, targetType) => {
      const srcDesc = getNodePortDescriptors(sourceType);
      const tgtDesc = getNodePortDescriptors(targetType);
      const outs = (srcDesc.outputs || []).slice();
      const ins = (tgtDesc.inputs || []).slice();
      const sortPorts = (a, b) => {
        const pa = a.transport === 'flow' ? 0 : 1;
        const pb = b.transport === 'flow' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return String(a.id || '').localeCompare(String(b.id || ''));
      };
      outs.sort(sortPorts);
      ins.sort(sortPorts);
      for (const o of outs) {
        for (const i of ins) {
          const ok = canConnect(sourceType, targetType, o.id, i.id);
          if (ok && ok.ok) return { sourcePort: o.id, targetPort: i.id };
        }
      }
      return null;
    };

    // Determine existing outgoing to rewire (if any)
    const out = getOutgoingEdge(doc, parentId);

    // Pre-resolve both required port pairs using types only
    const portsParentToNew = choosePortsByTypes(parentType, type);
    if (!portsParentToNew) {
      console.warn('[insertNodeAfter] EDGE VALIDATION FAILED - no compatible ports for parent→new', { parentType, newType: type });
      const added = graphAddNode(graph, { nodeId, type, position: newPos, data: props });
      if (!added?.ok) return { ok: false, error: added?.error || 'Add node failed' };
      return { ok: true, nodeId };
    }
    let portsNewToOld = null;
    if (out) {
      const targetNode = doc.nodes[out.target];
      if (!targetNode) {
        console.warn('[insertNodeAfter] Unexpected: outgoing target node not found', out);
        return { ok: false, error: 'Outgoing target missing' };
      }
      portsNewToOld = choosePortsByTypes(type, graphResolveNodeType(targetNode));
      if (!portsNewToOld) {
        console.warn('[insertNodeAfter] EDGE VALIDATION FAILED - no compatible ports for new→oldTarget', { newType: type, oldTargetType: targetNode.type });
        return { ok: false, error: 'No compatible ports between new node and old target' };
      }
    }

    // Dry-run on a cloned document: add node, add parent->new, remove old edge (if any), add new->oldTarget
    const simDoc = {
      nodes: { ...doc.nodes },
      edges: { ...doc.edges },
      metadata: doc.metadata,
      viewport: doc.viewport,
      ui_state: doc.ui_state,
    };
    // add node in sim
    simDoc.nodes = { ...simDoc.nodes };
    simDoc.nodes[nodeId] = { id: nodeId, type, position: newPos, data: props };
    // prepare edges
    const edgeId1 = `edge_${parentId}_${nodeId}_${Date.now()}`;
    simDoc.edges = { ...simDoc.edges };
    simDoc.edges[edgeId1] = { id: edgeId1, source: parentId, target: nodeId, sourcePort: portsParentToNew.sourcePort, targetPort: portsParentToNew.targetPort };
    if (out) {
      // remove old
      delete simDoc.edges[out.id];
      const edgeId2 = `edge_${nodeId}_${out.target}_${Date.now()}`;
      simDoc.edges[edgeId2] = { id: edgeId2, source: nodeId, target: out.target, sourcePort: portsNewToOld.sourcePort, targetPort: portsNewToOld.targetPort };
    }

    const semantics = validateGraphSemantics(simDoc);
    if (!semantics.ok) {
      const first = semantics.issues?.[0] || semantics.errors?.[0];
      const ux = normalizeGraphError(first || { code: 'PROPOSED_INSERTION_FAILED' }, {
        lang: uiLang,
        graphDocument: doc,
        sourceType: parentType,
        targetType: type,
      });
      console.warn('[insertNodeAfter] semantics', semantics.issues);
      return { ok: false, error: ux.fix, errorDetail: ux };
    }

    // Perform real operations transactionally
    const added = graphAddNode(graph, { nodeId, type, position: newPos, data: props });
    if (!added?.ok) return { ok: false, error: added?.error || 'Add node failed' };

    // Add parent->new
    const res1 = graphAddEdge(graph, { edgeId: edgeId1, source: parentId, target: nodeId, sourcePort: portsParentToNew.sourcePort, targetPort: portsParentToNew.targetPort });
    if (!res1?.ok) {
      // rollback node
      try { graph.dispatch('RemoveNode', { nodeId }); } catch (e) { console.warn('[insertNodeAfter] rollback RemoveNode failed', e); }
      console.warn('[insertNodeAfter] addEdge parent->new failed', res1);
      return { ok: false, error: res1?.error || 'Add edge failed' };
    }

    if (out) {
      // remove old edge
      try {
        graph.dispatch('RemoveEdge', { edgeId: out.id });
      } catch (err) {
        // attempt rollback: remove the newly added edge and node
        try { graph.dispatch('RemoveEdge', { edgeId: edgeId1 }); } catch (e) { /* ignore */ }
        try { graph.dispatch('RemoveNode', { nodeId }); } catch (e) { /* ignore */ }
        console.warn('[insertNodeAfter] remove old edge failed', err);
        return { ok: false, error: 'Failed to remove existing outgoing edge' };
      }
      // add new->oldTarget
      const edgeId2 = `edge_${nodeId}_${out.target}_${Date.now()}`;
      const res2 = graphAddEdge(graph, { edgeId: edgeId2, source: nodeId, target: out.target, sourcePort: portsNewToOld.sourcePort, targetPort: portsNewToOld.targetPort });
      if (!res2?.ok) {
        // rollback: try to restore state
        try { graph.dispatch('RemoveEdge', { edgeId: edgeId1 }); } catch (e) { /* ignore */ }
        try { graphAddEdge(graph, { edgeId: out.id, source: parentId, target: out.target, sourcePort: out.sourcePort || 'flow', targetPort: out.targetPort || 'flow' }); } catch (e) { /* ignore */ }
        try { graph.dispatch('RemoveNode', { nodeId }); } catch (e) { /* ignore */ }
        console.warn('[insertNodeAfter] addEdge new->oldTarget failed', res2);
        return { ok: false, error: res2?.error || 'Add second edge failed' };
      }
    }

    // Layout only after successful full transaction
    applyCanvasLayoutRef.current?.();
    return {
      ok: true,
      nodeId,
      effectiveParentId: parentId,
      requestedParentId,
    };
  }, [currentUser, showToast, graph, uiLang]);

  const applyAiGeneratedStacks = useCallback((stacks, options = {}) => {
    if (!Array.isArray(stacks) || stacks.length === 0) return;
    const timestamp = Date.now();
    const resolvedTok = graphResolveBotToken(graph, currentUser);
    const newStacks = stacks.map((s, i) => ({
      ...s,
      id: `ai_stack_${timestamp}_${i}`,
      blocks: (s.blocks || []).map((b, bi) => ({
        ...normalizeStudioBlockNode(b),
        id: `ai_b_${timestamp}_${i}_${bi}`,
        props: b.type === 'bot' && resolvedTok
          ? { ...b.props, token: resolvedTok }
          : b.props,
      })),
    }));
    appendStacks(graph, [], newStacks);
    applyCanvasLayout();
    focusCanvasAfterContent();
    setAiPartialResult(null);
    setAiDiagnosticsOpen(false);
    setShowAIModal(false);
    showToast(
      options.skeletonFallback
        ? 'Запущена базовая версия сценария (без сложной логики).'
        : options.templateMode
        ? `Шаблон «${options.templateLabel || 'бот'}» добавлен на холст.`
        : options.recoveryMode
        ? 'Сценарий оптимизирован для стабильного выполнения.'
        : options.partial
        ? 'Частичный сценарий добавлен на холст. Нажмите «Проверить» перед запуском.'
        : `✨ AI сгенерировал схему бота!${options.aiConfidenceLabel ? ` AI confidence: ${options.aiConfidenceLabel}` : ''}`,
      options.partial || options.skeletonFallback || options.recoveryMode
        ? 'info'
        : 'success',
    );
  }, [currentUser, graph, showToast, focusCanvasAfterContent]);

  const runAiGeneration = useCallback(async () => {
    if (aiPromptTooShort) {
      setAiError('Опиши бота минимум 5 символами');
      return;
    }
    if (aiPromptTooLong) {
      setAiError(`Запрос должен быть не длиннее ${AI_PROMPT_MAX_CHARS} символов`);
      return;
    }
    setAiLoading(true);
    setAiError('');
    setAiPartialResult(null);
    setAiDiagnosticsOpen(false);
    try {
      const token = await getCsrfTokenForRequest(resolveApiUrl('/api/ai-generate'));
      const res = await fetch(resolveApiUrl('/api/ai-generate'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify({ prompt: aiPromptText }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Ошибка сервера ${res.status}`;
        try { const j = JSON.parse(text); msg = j.error || msg; } catch { /* не JSON */ }
        throw new Error(msg);
      }
      const data = await res.json();
      if (data.status === 'partial_success' || data.status === 'fallback_skeleton' || data.partial) {
        const partial = normalizeAiPartialResponse(data);
        setAiPartialResult(partial);
        if (!partial.hasContext) {
          setAiError('Partial IR вернулся без диагностического контекста. Сценарий не применён.');
        }
        return;
      }
      if (data.status === 'failed') {
        const partial = normalizeAiPartialResponse(data);
        if (partial.hasContext) {
          setAiPartialResult(partial);
          return;
        }
        throw new Error(data.error || `AI generation failed: ${data.reason || 'NO_DIAGNOSTIC_CONTEXT'}`);
      }
      if (data.error) throw new Error(data.error);
      const templateMode = data.executionMode === 'SEMANTIC_TEMPLATE' || Boolean(data.meta?.deterministicTemplate);
      applyAiGeneratedStacks(data.stacks, {
        aiConfidenceLabel: data.aiConfidenceLabel,
        templateMode,
        templateLabel: data.meta?.semanticTemplate === 'calculator' ? 'Калькулятор' : data.meta?.semanticTemplate,
      });
    } catch (e) {
      setAiError(e.message || 'Что-то пошло не так');
    } finally {
      setAiLoading(false);
    }
  }, [aiPromptText, aiPromptTooLong, aiPromptTooShort, applyAiGeneratedStacks]);

  const selectedBlock = React.useMemo(() => {
    if (!selectedBlockId) return null;
    const node = graph.getGraphDocument().nodes[selectedBlockId];
    if (!node) return null;
    const type = graphResolveNodeType(node);
    const props = { ...(node.data || {}) };
    const doc = graph.getGraphDocument();
    const directActions = ['buttons', 'inline', 'keyboard', 'media'].filter(
      (kind) => {
        if (kind === 'keyboard') return isReplyCapable(type);
        return canRenderUi(type) && canAttach(kind, type);
      },
    );
    const proxyActions = directActions.length
      ? directActions
      : ['buttons', 'inline', 'keyboard', 'media'].filter(
        (kind) => {
          if (kind === 'keyboard') {
            return isReplyCapable(graphResolveNodeType(node));
          }
          return resolveUiAttachmentTargetNodeId(doc, node.id, kind) != null;
        },
      );
    const attachmentTargetId = directActions.length
      ? node.id
      : (proxyActions.length
        ? resolveUiAttachmentTargetNodeId(doc, node.id, proxyActions[0])
        : null);
    const attachmentNode = attachmentTargetId && attachmentTargetId !== node.id
      ? doc.nodes[attachmentTargetId]
      : node;
    return {
      id: node.id,
      type,
      props,
      meta: node.meta,
      uiAttachments: attachmentNode?.meta?.uiAttachments,
      ui: { addableActions: proxyActions, attachmentTargetId },
    };
  }, [selectedBlockId, graphRevision, graph]);

  const handleSelectNode = useCallback((nodeId) => {
    setSelectedBlockId((prev) => {
      if (prev && prev !== nodeId) {
        queueMicrotask(() => {
          commitNodeEdit(prev);
          endNodeEdit(prev);
        });
      }
      return nodeId ?? null;
    });
    setMobileAttentionBlockId((prev) => (prev === nodeId ? null : prev));
    if (nodeId) beginNodeEdit(nodeId);
  }, []);

  const handleInspectNode = useCallback((nodeId) => {
    if (!nodeId) return;
    handleSelectNode(nodeId);
    setInspectorTab('props');
    useSelectionStore.getState().requestInspectorReveal();
    if (isMobileView) setMobileZone('right');
  }, [handleSelectNode, isMobileView, setInspectorTab, setMobileZone]);

  /** Stack «i» help — focus right inspector instead of a modal. */
  const handleBlockInfoRequest = useCallback((info) => {
    const nodeId = info?.nodeId || info?.id;
    if (nodeId && graph.getGraphDocument().nodes[nodeId]) {
      handleSelectNode(nodeId);
      setInspectorTab('props');
      useSelectionStore.getState().requestInspectorReveal();
      if (isMobileView) setMobileZone('right');
    }
  }, [graph, handleSelectNode, isMobileView, setInspectorTab, setMobileZone]);

  const handleConnectFeedback = useCallback((result) => {
    if (!result) return;
    if (result.ok) {
      applyCanvasLayoutRef.current?.();
      return;
    }
    const doc = graph.getGraphDocument();
    const src = doc.nodes[result.params?.source];
    const tgt = doc.nodes[result.params?.target];
    const ux = normalizeConnectionError(result.reason, {
      lang: uiLang,
      graphDocument: doc,
      source: result.params?.source,
      target: result.params?.target,
      sourceType: src ? graphResolveNodeType(src) : '',
      targetType: tgt ? graphResolveNodeType(tgt) : '',
    });
  }, [graph, uiLang]);

  /** @deprecated alias for legacy call sites that pass (blockId) */
  const handleSelectBlock = useCallback((blockId) => {
    handleSelectNode(blockId);
  }, [handleSelectNode]);

  const executeRemoveNodeIds = useCallback((nodeIds) => {
    const ids = [...new Set((nodeIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (!ids.length) return false;
    const result = removeGraphNodes(graph.getGraphDocument(), ids);
    if (!result.ok || !result.operations?.length) return false;
    const applied = applyComposition(graph, { ok: true, operations: result.operations });
    if (!applied?.ok) return false;
    for (const id of ids) endNodeEdit(id);
    setSelectedBlockId(null);
    applyCanvasLayoutRef.current?.();
    return true;
  }, [graph]);

  const handleRequestDeleteNode = useCallback(async (nodeId) => {
    const id = String(nodeId || '').trim();
    if (!id) return;
    const doc = graph.getGraphDocument();
    const summary = getNodeDeleteSummary(doc, id);
    if (!summary.needsConfirm) {
      executeRemoveNodeIds([id]);
      return;
    }
    const ok = await appConfirm({
      title: uiLang === 'en' ? 'Delete block?' : 'Удалить блок?',
      message: uiLang === 'en'
        ? `Delete «${summary.label}» and ${summary.edgeCount} connection(s)?`
        : `Удалить блок «${summary.label}» и связанные связи (${summary.edgeCount})?`,
      confirmText: uiLang === 'en' ? 'Delete' : 'Удалить',
      cancelText: uiLang === 'en' ? 'Cancel' : 'Отмена',
      variant: 'danger',
    });
    if (!ok) return;

    if (summary.canDeleteChain) {
      const chainOk = await appConfirm({
        title: uiLang === 'en' ? 'Delete chain?' : 'Удалить цепочку?',
        message: uiLang === 'en'
          ? `Also delete ${summary.downstreamChain.length} block(s) below in the flow?`
          : `Удалить также цепочку из ${summary.downstreamChain.length} блоков ниже?`,
        confirmText: uiLang === 'en' ? 'Delete chain' : 'Удалить с цепочкой',
        cancelText: uiLang === 'en' ? 'Block only' : 'Только блок',
        variant: 'danger',
      });
      if (chainOk) {
        executeRemoveNodeIds([id, ...summary.downstreamChain]);
        return;
      }
    }
    executeRemoveNodeIds([id]);
  }, [graph, executeRemoveNodeIds, uiLang]);

  const handleRequestDeleteNodes = useCallback(async (nodeIds) => {
    const ids = [...new Set((nodeIds || []).map((n) => String(n || '').trim()).filter(Boolean))];
    if (ids.length === 1) {
      await handleRequestDeleteNode(ids[0]);
      return;
    }
    const ok = await appConfirm({
      title: uiLang === 'en' ? 'Delete blocks?' : 'Удалить блоки?',
      message: uiLang === 'en'
        ? `Delete ${ids.length} selected blocks?`
        : `Удалить ${ids.length} выбранных блоков?`,
      confirmText: uiLang === 'en' ? 'Delete' : 'Удалить',
      cancelText: uiLang === 'en' ? 'Cancel' : 'Отмена',
      variant: 'danger',
    });
    if (ok) executeRemoveNodeIds(ids);
  }, [handleRequestDeleteNode, executeRemoveNodeIds, uiLang]);

  const handleDuplicateNode = useCallback((nodeId) => {
    const id = String(nodeId || '').trim();
    if (!id) return;
    const doc = graph.getGraphDocument();
    const source = doc.nodes[id];
    if (!source) return;
    const type = graphResolveNodeType(source);
    if (!graphCanDuplicateNodeType(type)) {
      showToast(
        uiLang === 'en'
          ? 'This block type cannot be duplicated'
          : 'Этот тип блока нельзя дублировать',
        'info',
      );
      return;
    }
    const result = duplicateGraphNode(doc, id);
    if (!result.ok || !result.operations?.length) {
      showToast(uiLang === 'en' ? 'Could not duplicate block' : 'Не удалось дублировать блок', 'info');
      return;
    }
    const applied = applyComposition(graph, { ok: true, operations: result.operations });
    if (!applied?.ok) {
      showToast(uiLang === 'en' ? 'Could not duplicate block' : 'Не удалось дублировать блок', 'info');
      return;
    }
    if (result.newNodeId) setSelectedBlockId(result.newNodeId);
    applyCanvasLayoutRef.current?.();
  }, [graph, showToast, uiLang]);

  const handleInsertNodeOnEdge = useCallback((edgeId, type) => {
    const eid = String(edgeId || '').trim();
    const blockType = String(type || '').trim();
    if (!eid || !blockType) return;

    const props = graphMakePropsForNewBlock(graph, blockType, currentUser);
    const conflict = graphGetUniqueConflictMessage(graph, blockType, props, uiLang);
    if (conflict) {
      showToast(conflict, 'info');
      return;
    }

    const nodeId = uid();
    const plan = planInsertNodeOnEdge(
      graph.getGraphDocument(),
      eid,
      nodeId,
      blockType,
      props,
    );
    if (!plan.ok) {
      showToast(
        plan.error || (uiLang === 'en' ? 'Could not insert on connection' : 'Не удалось вставить на связь'),
        'info',
      );
      return;
    }

    const applied = applyComposition(graph, { ok: true, operations: plan.operations });
    if (!applied?.ok) {
      showToast(uiLang === 'en' ? 'Could not insert block' : 'Не удалось вставить блок', 'info');
      return;
    }

    applyCanvasLayoutRef.current?.();
    setSelectedBlockId(nodeId);
    setMobileZone('canvas');
    setInspectorTab('props');
    showToast(
      uiLang === 'en' ? 'Step added to flow' : 'Шаг добавлен в поток',
      'success',
    );
  }, [
    graph,
    currentUser,
    showToast,
    uiLang,
    setMobileZone,
    setInspectorTab,
  ]);

  const handleAddAfterNode = useCallback((parentId) => {
    const anchorId = String(parentId || '').trim();
    if (!anchorId) return;
    const type = 'message';
    const props = graphMakePropsForNewBlock(graph, type, currentUser);
    const nodeId = uid();
    const inserted = insertNodeAfter(anchorId, nodeId, type, props);
    if (!inserted?.ok) {
      showToast(
        inserted?.errorDetail?.fix || inserted?.error || (uiLang === 'en' ? 'Could not add block' : 'Не удалось добавить блок'),
        'info',
      );
      return;
    }
    setSelectedBlockId(nodeId);
    setMobileZone('canvas');
    setInspectorTab('props');
  }, [
    graph,
    currentUser,
    insertNodeAfter,
    showToast,
    uiLang,
    setMobileZone,
    setInspectorTab,
  ]);

  const graphCanvasActions = React.useMemo(() => ({
    onSelectNode: handleSelectNode,
    onDeleteNode: handleRequestDeleteNode,
    onDuplicateNode: handleDuplicateNode,
    onAddAfterNode: handleAddAfterNode,
    onInlineEdit: (nodeId, field, value) => {
      if (!nodeId || !field) return;
      patchNodeData(graph, nodeId, { [field]: value });
    },
  }), [handleSelectNode, handleRequestDeleteNode, handleDuplicateNode, handleAddAfterNode, graph]);

  const handleToggleHistory = useCallback(() => {
    window.dispatchEvent(new Event('cicada:toggle-history'));
  }, []);

  const handleQuickAddMessage = useCallback(() => {
    const docNodes = graph.getGraphDocument().nodes || {};
    const anchor = selectedBlockId || Object.keys(docNodes).slice(-1)[0];
    if (anchor) handleAddAfterNode(anchor);
    else {
      showToast(
        uiLang === 'en' ? 'Add your first step from the palette' : 'Добавьте первый шаг из палитры',
        'info',
      );
    }
  }, [graph, selectedBlockId, handleAddAfterNode, showToast, uiLang]);

  const handleQuickAddCondition = useCallback(() => {
    const docNodes = graph.getGraphDocument().nodes || {};
    const anchor = selectedBlockId || Object.keys(docNodes).slice(-1)[0];
    if (!anchor) {
      showToast(
        uiLang === 'en' ? 'Select or create a step first' : 'Сначала выберите или создайте шаг',
        'info',
      );
      return;
    }
    const type = 'condition';
    const props = graphMakePropsForNewBlock(graph, type, currentUser);
    const nodeId = uid();
    const inserted = insertNodeAfter(anchor, nodeId, type, props);
    if (!inserted?.ok) {
      showToast(inserted?.error || (uiLang === 'en' ? 'Could not add condition' : 'Не удалось добавить условие'), 'info');
      return;
    }
    setSelectedBlockId(nodeId);
    setMobileZone('canvas');
    setInspectorTab('props');
  }, [
    graph,
    selectedBlockId,
    currentUser,
    insertNodeAfter,
    showToast,
    uiLang,
    setSelectedBlockId,
    setMobileZone,
    setInspectorTab,
  ]);

  const handleDuplicateSelectionUx = useCallback(() => {
    if (selectedBlockId) handleDuplicateNode(selectedBlockId);
  }, [selectedBlockId, handleDuplicateNode]);

  const handleDeleteSelectionUx = useCallback(() => {
    if (selectedBlockId) handleRequestDeleteNode(selectedBlockId);
  }, [selectedBlockId, handleRequestDeleteNode]);

  const handleGroupSelectionUx = useCallback(() => {
    if (!selectedBlockId) return;
    graph.dispatch('GroupSelection', {
      nodeIds: [selectedBlockId],
      label: uiLang === 'en' ? 'Group' : 'Группа',
    });
  }, [graph, selectedBlockId, uiLang]);

  useEffect(() => {
    if (!currentUser) return undefined;
    let prevAt = usePersistenceStore.getState().lastPersistedAt;
    return usePersistenceStore.subscribe((state) => {
      const at = state.lastPersistedAt;
      if (!at || at === prevAt || state.isLoading) return;
      prevAt = at;
      if (!isCanvasSection(appSection)) return;
      const now = Date.now();
      if (now - lastAutosaveToastRef.current < 6000) return;
      lastAutosaveToastRef.current = now;
      showToast(uiLang === 'en' ? 'Autosaved' : 'Автосохранено', 'success', 1400);
    });
  }, [currentUser, appSection, showToast, uiLang]);

  const handleDeleteBlock = useCallback((_stackIdOrNodeId, blockId) => {
    handleRequestDeleteNode(blockId);
  }, [handleRequestDeleteNode]);

  useEffect(() => {
    const isEditableTarget = (target) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        target.isContentEditable ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      );
    };

    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;

      // Delete selected node (Delete / Backspace / Cmd+Backspace)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.altKey) {
        if (!selectedBlockId) return;
        if (isEditableTarget(e.target)) return;
        if (e.key === 'Backspace' && mod) {
          /* Cmd/Ctrl+Backspace — allowed */
        } else if (e.key === 'Backspace' && !mod) {
          /* plain Backspace */
        }
        e.preventDefault();
        handleRequestDeleteNode(selectedBlockId);
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if (mod && e.key === 'z' && !e.shiftKey) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        handleGraphUndo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z
      if ((mod && e.key === 'y') || (mod && e.key === 'z' && e.shiftKey)) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        handleGraphRedo();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleRequestDeleteNode, selectedBlockId, handleGraphUndo, handleGraphRedo]);

  const handlePropChange = useCallback((key, val) => {
    if (!selectedBlockId) return;
    patchNodeData(graph, selectedBlockId, { [key]: val });
  }, [selectedBlockId, graph]);

  const handleKeyboardDataChange = useCallback((data) => {
    if (!selectedBlockId || !data) return;
    beginNodeEdit(selectedBlockId);
    setNodeData(graph, selectedBlockId, data);
    commitNodeEdit(selectedBlockId);
  }, [selectedBlockId, graph]);

  const attachLegacyUiToNode = useCallback((blockId, kind, props = {}) => {
    if (!blockId) return { ok: false, reason: 'no_block' };
    const doc = graph.getGraphDocument();
    let node = doc.nodes[blockId];
    if (!node) return { ok: false, reason: 'no_node' };
    if (!BLOCK_FOOTER_ACTION_TYPES[kind] && kind !== 'media') {
      return { ok: false, reason: 'unknown_kind' };
    }
    let targetId = blockId;
    let ownerType = graphResolveNodeType(node);
    if (kind === 'keyboard') {
      if (!isReplyCapable(ownerType)) {
        const resolved = resolveUiAttachmentTargetNodeId(doc, blockId, 'inline')
          || resolveUiAttachmentTargetNodeId(doc, blockId, 'buttons');
        if (!resolved) return { ok: false, reason: 'not_allowed' };
        targetId = resolved;
        node = doc.nodes[targetId];
        ownerType = graphResolveNodeType(node);
        if (!isReplyCapable(ownerType)) return { ok: false, reason: 'not_allowed' };
      }
      beginKeyboardInsertion(targetId, null);
      markDraftField(targetId, 'keyboard');
      const ensured = ensureKeyboardNodeForOwner(doc, targetId, 'inline');
      if (!ensured.ok || !ensured.keyboardNodeId) {
        rollbackKeyboardInsertion(targetId);
        return { ok: false, reason: 'keyboard_failed' };
      }
      const applied = applyComposition(graph, { ok: true, operations: ensured.operations });
      if (!applied?.ok) {
        rollbackKeyboardInsertion(targetId);
        return { ok: false, reason: 'dispatch_failed', error: applied?.error };
      }
      commitKeyboardInsertion(targetId);
      commitNodeEdit(targetId);
      return {
        ok: true,
        targetId,
        keyboardNodeId: ensured.keyboardNodeId,
        proxied: targetId !== blockId,
      };
    }
    if (!canRenderUi(ownerType) || !canAttach(kind, ownerType)) {
      const resolved = resolveUiAttachmentTargetNodeId(doc, blockId, kind);
      if (!resolved) return { ok: false, reason: 'not_allowed' };
      targetId = resolved;
      node = doc.nodes[targetId];
      if (!node) return { ok: false, reason: 'no_node' };
      ownerType = graphResolveNodeType(node);
      if (!canRenderUi(ownerType) || !canAttach(kind, ownerType)) {
        return { ok: false, reason: 'not_allowed' };
      }
    }

    beginKeyboardInsertion(targetId, null);
    markDraftField(targetId, 'keyboard');

    if (kind === 'media') {
      const block = addUiAttachment(
        normalizeStudioBlockNode({
          id: targetId,
          type: ownerType,
          props: node.data || {},
          uiAttachments: node.meta?.uiAttachments,
        }),
        'media',
      );
      const result = updateBlockUiAttachments(
        graph,
        targetId,
        () => block.uiAttachments || {},
      );
      if (!result?.ok) {
        rollbackKeyboardInsertion(targetId);
        return { ok: false, reason: 'dispatch_failed', error: result?.error };
      }
      commitKeyboardInsertion(targetId);
      commitNodeEdit(targetId);
      return { ok: true, targetId, proxied: targetId !== blockId };
    }

    if (kind === 'inline' || kind === 'buttons') {
      const doc = graph.getGraphDocument();
      const label = kind === 'inline'
        ? (props?.text || String(props?.buttons || '').split(/[|,]/)[0]?.trim() || 'Кнопка')
        : (String(props?.rows || '').split(',')[0]?.trim() || 'Кнопка');
      const built = kind === 'inline'
        ? addInlineButtonToOwner(doc, targetId, { label, autoCreateHandler: true })
        : addReplyButtonToOwner(doc, targetId, { label });
      if (!built.ok) {
        rollbackKeyboardInsertion(targetId);
        return { ok: false, reason: built.reason || 'keyboard_failed' };
      }
      const applied = applyComposition(graph, { ok: true, operations: built.operations });
      if (!applied?.ok) {
        rollbackKeyboardInsertion(targetId);
        return { ok: false, reason: 'dispatch_failed', error: applied?.error };
      }
      commitKeyboardInsertion(targetId);
      commitNodeEdit(targetId);
      return {
        ok: true,
        targetId,
        keyboardNodeId: built.keyboardNodeId,
        proxied: targetId !== blockId,
      };
    }

    rollbackKeyboardInsertion(targetId);
    return { ok: false, reason: 'unsupported' };
  }, [graph]);

  const tryAttachLegacyUiToSelected = useCallback((type, props, anchorId) => {
    const id = anchorId || selectedBlockId;
    if (!id) return false;
    const out = attachLegacyUiToNode(id, type, props);
    return out.ok;
  }, [selectedBlockId, attachLegacyUiToNode]);

  const handleAddFooterAction = useCallback((blockId, kind) => {
    if (!blockId) {
      showToast(builderUi.selectBlockFirst || 'Выберите блок на холсте', 'info');
      return;
    }
    if (!BLOCK_FOOTER_ACTION_TYPES[kind] && kind !== 'media') return;
    const out = attachLegacyUiToNode(blockId, kind);
    if (kind === 'keyboard' && out.keyboardNodeId) {
      setSelectedBlockId(out.keyboardNodeId);
    }
    if (!out.ok) {
      const msg = out.reason === 'not_allowed'
        ? (uiLang === 'en'
          ? 'This block type does not support that control'
          : 'К этому блоку нельзя добавить такие кнопки')
        : (out.reason === 'dispatch_failed'
          ? (uiLang === 'en'
            ? `Could not save button: ${out.error || 'dispatch failed'}`
            : `Не удалось сохранить кнопку: ${out.error || 'ошибка записи'}`)
          : (uiLang === 'en'
            ? 'Could not attach control to block'
            : 'Не удалось добавить кнопку к этому блоку'));
      showToast(msg, out.reason === 'dispatch_failed' ? 'error' : 'info');
      return;
    }
    const focusId = out.targetId || blockId;
    setSelectedBlockId(focusId);
    showToast(
      out.proxied
        ? (uiLang === 'en'
          ? 'Button added to the message block below (not to Start)'
          : 'Кнопка добавлена к блоку сообщения ниже (не к Старту)')
        : (kind === 'inline'
          ? (uiLang === 'en' ? 'Inline button added' : 'Inline-кнопка добавлена к блоку')
          : (uiLang === 'en' ? 'Control added to block' : 'Кнопка добавлена к сообщению')),
      'success',
    );
  }, [attachLegacyUiToNode, showToast, builderUi, uiLang]);

  const resolveAttachmentEditNodeId = useCallback(() => {
    if (!selectedBlockId) return null;
    const doc = graph.getGraphDocument();
    const node = doc.nodes[selectedBlockId];
    if (!node) return null;
    const type = graphResolveNodeType(node);
    if (canRenderUi(type)) return selectedBlockId;
    return resolveUiAttachmentTargetNodeId(doc, selectedBlockId, 'inline')
      || resolveUiAttachmentTargetNodeId(doc, selectedBlockId, 'buttons')
      || resolveUiAttachmentTargetNodeId(doc, selectedBlockId, 'media');
  }, [selectedBlockId, graph]);

  const handleAttachmentChange = useCallback((group, attachmentId, updates) => {
    const nodeId = resolveAttachmentEditNodeId();
    if (!nodeId || !group || !attachmentId) return;
    beginNodeEdit(nodeId);
    beginKeyboardInsertion(nodeId);
    markDraftField(nodeId, 'uiAttachments');
    const result = updateBlockUiAttachments(graph, nodeId, (ui) => ({
      ...ui,
      [group]: (ui[group] || []).map((item) => (
        item.id === attachmentId ? { ...item, ...updates } : item
      )),
    }));
    if (!result?.ok) {
      rollbackKeyboardInsertion(nodeId);
      showToast(
        uiLang === 'en'
          ? `Could not update button: ${result?.error || 'error'}`
          : `Не удалось обновить кнопку: ${result?.error || 'ошибка'}`,
        'error',
      );
      return;
    }
    commitKeyboardInsertion(nodeId);
    commitNodeEdit(nodeId);
  }, [resolveAttachmentEditNodeId, graph, showToast, uiLang]);

  const handleAttachmentDelete = useCallback((group, attachmentId) => {
    const nodeId = resolveAttachmentEditNodeId();
    if (!nodeId || !group || !attachmentId) return;
    const result = updateBlockUiAttachments(graph, nodeId, (ui) => ({
      ...ui,
      [group]: (ui[group] || []).filter((item) => item.id !== attachmentId),
    }));
    if (!result?.ok) {
      showToast(
        uiLang === 'en'
          ? `Could not remove button: ${result?.error || 'error'}`
          : `Не удалось удалить кнопку: ${result?.error || 'ошибка'}`,
        'error',
      );
    }
  }, [resolveAttachmentEditNodeId, graph, showToast, uiLang]);

  const endPaletteDrag = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('cicada-palette-dragging');
    }
    setDraggingPaletteEntry(null);
  }, [setDraggingPaletteEntry]);

  // Helper: find first outgoing flow edge from node
  const getOutgoingEdge = useCallback((doc, nodeId) => {
    const edges = Object.values(doc.edges || {}).filter((e) => e.source === nodeId);
    if (edges.length === 0) return null;
    // Deterministic choice: prefer explicit 'flow' sourcePort, then sort by id.
    edges.sort((a, b) => {
      const pa = a.sourcePort === 'flow' ? 0 : 1;
      const pb = b.sourcePort === 'flow' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(a.id).localeCompare(String(b.id));
    });
    return edges[0] || null;
  }, []);

  // Resolve compatible ports between two node IDs (returns { sourcePort, targetPort } or null)
  const resolveCompatiblePorts = useCallback((sourceId, targetId) => {
    if (!sourceId || !targetId) return null;
    const doc = graph.getGraphDocument();
    const sourceNode = doc.nodes[sourceId];
    const targetNode = doc.nodes[targetId];
    if (!sourceNode || !targetNode) return null;
    const srcDesc = getNodePortDescriptors(sourceNode.type || sourceNode.data?.type);
    const tgtDesc = getNodePortDescriptors(targetNode.type || targetNode.data?.type);
    const outs = srcDesc.outputs || [];
    const ins = tgtDesc.inputs || [];
    // Preferred order: explicit 'flow' transports first
    const sortPorts = (a, b) => {
      const pa = a.transport === 'flow' ? 0 : 1;
      const pb = b.transport === 'flow' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(a.id || '').localeCompare(String(b.id || ''));
    };
    outs.sort(sortPorts);
    ins.sort(sortPorts);
    for (const o of outs) {
      for (const i of ins) {
        // Quick semantic check via canConnect (uses contracts)
        const ok = canConnect(sourceNode.type, targetNode.type, o.id, i.id);
        if (ok && ok.ok) return { sourcePort: o.id, targetPort: i.id };
      }
    }
    return null;
  }, [graph]);

  // Insert node after parentId in the flow: handle rewiring of existing outgoing edge
  /**
   * Drop handler called by ReactFlowCanvas with flow-coordinate position.
   * GraphDocument is the sole source of truth — no stack projection needed.
   */
  const getVisibleCanvasMetrics = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const width = rect?.width || window.innerWidth || BLOCK_W;
    const fullHeight = rect?.height || Math.max(ROOT_H, (window.innerHeight || 0) - MOBILE_TOP_BAR_H);
    const visibleHeight = Math.max(ROOT_H, fullHeight - (isMobileView ? MOBILE_BOTTOM_NAV_H : 0));

    return { width, visibleHeight };
  }, [isMobileView]);

  // Get canvas center in flow coordinates using stored viewport.
  const getCanvasCenterPosition = useCallback(() => {
    const vp = graph.getCanvasProjection().viewport;
    const { width, visibleHeight } = getVisibleCanvasMetrics();
    return {
      x: (width / 2 - vp.x) / vp.zoom - BLOCK_W / 2,
      y: (visibleHeight / 2 - vp.y) / vp.zoom - ROOT_H / 2,
    };
  }, [graph, getVisibleCanvasMetrics]);

  const handleCanvasDrop = useCallback((event, flowPosition) => {
    const dt = event?.dataTransfer;
    const paletteId = dt?.getData('cicada/palette-id') || dt?.getData('text/plain') || '';
    const paletteOpts = { lang: uiLang, blockTypes: builderBlockTypes };
    const entry = paletteId
      ? getPaletteEntry(paletteId.trim(), paletteOpts)
      : draggingPaletteEntry;
    if (!entry || entry.type !== 'node') {
      endPaletteDrag();
      return;
    }
    const type = entry.defaultNodeType || entry.id?.replace(/^node:/, '') || 'message';
    const props = graphMakePropsForNewBlock(graph, type, currentUser);
    const conflict = graphGetUniqueConflictMessage(graph, type, props, uiLang);
    if (conflict) {
      showToast(conflict, 'info');
      endPaletteDrag();
      return;
    }
    const position = flowPosition ?? getCanvasCenterPosition();
    const legacyAttachTypes = [...UI_ATTACHMENT_LEGACY_BLOCK_TYPES, 'media'];
    if (selectedBlockId && legacyAttachTypes.includes(type)) {
      const out = attachLegacyUiToNode(selectedBlockId, type, props);
      if (out.ok) {
        showToast(
          type === 'inline'
            ? (uiLang === 'en' ? 'Inline button attached to block' : 'Inline-кнопка добавлена к блоку')
            : (builderUi.paletteAttachedToBlock || 'Элемент добавлен к выбранному блоку'),
          'success',
        );
        endPaletteDrag();
        return;
      }
      if (out.reason === 'not_allowed') {
        showToast(
          uiLang === 'en'
            ? 'Attach buttons to Reply or media blocks, not this node type'
            : 'Кнопки добавляйте к «Ответ» или медиа-блокам, не к этому типу',
          'info',
        );
      }
    }
    const nodeId = uid();
    const doc = graph.getGraphDocument();
    const chainParentId = resolvePaletteChainParentId(doc, selectedBlockId, type);

    if (chainParentId) {
      const inserted = insertNodeAfter(chainParentId, nodeId, type, props);
      if (!inserted?.ok) {
        showToast(inserted?.errorDetail?.fix || inserted?.error || 'Не удалось добавить шаг в цепочку', 'info');
        endPaletteDrag();
        return;
      }
      setSelectedBlockId(nodeId);
    } else {
      if (selectedBlockId && !doc.nodes[selectedBlockId]) {
        setSelectedBlockId(null);
      }
      const result = graphAddNode(graph, {
        nodeId,
        type,
        position,
        data: props,
      });
      if (!result?.ok) {
        showToast(result?.error || 'Не удалось добавить шаг', 'info');
        endPaletteDrag();
        return;
      }
      setSelectedBlockId(nodeId);
    }
    endPaletteDrag();
    useSelectionStore.getState().requestCanvasFocus(nodeId);
  }, [endPaletteDrag, currentUser, showToast, graph, draggingPaletteEntry, uiLang, builderBlockTypes, builderUi, selectedBlockId, insertNodeAfter, getCanvasCenterPosition, attachLegacyUiToNode]);


  const handleClearCanvas = useCallback(async () => {
    const confirmed = await appConfirm({
      title: builderUi.clearCanvas,
      message: 'Удалить все блоки с холста? Это действие нельзя отменить.',
      confirmText: builderUi.clearCanvas,
      cancelText: 'Отмена',
      variant: 'danger',
    });
    if (!confirmed) return;
    const result = clearGraph(graph);
    if (!result?.ok) {
      showToast(result?.error || 'Не удалось очистить холст', 'error');
      return;
    }
    setSelectedBlockId(null);
    setActiveProjectId(null);
    useUiStore.getState().patch({ canvasOnboardingDismissed: false });
    saveCanvasForKey(canvasStorageKey, graph);
    showToast('Холст очищен', 'info');
  }, [graph, builderUi.clearCanvas, showToast, canvasStorageKey]);

  const handleCreateFlow = useCallback(async () => {
    setAppSection('flows');
    setMobileZone('canvas');

    const doc = graph.getGraphDocument?.();
    const isEmpty = doc ? shouldShowCanvasOnboardingOverlay(doc) : true;

    if (!isEmpty) {
      const confirmed = await appConfirm({
        title: uiLang === 'en' ? 'New scenario' : uiLang === 'uk' ? 'Новий сценарій' : 'Новый сценарий',
        message: uiLang === 'en'
          ? 'Clear the canvas and start a new scenario? Unsaved changes will be lost.'
          : uiLang === 'uk'
            ? 'Очистити полотно і почати новий сценарій? Незбережені зміни буде втрачено.'
            : 'Очистить холст и начать новый сценарий? Несохранённые изменения будут потеряны.',
        confirmText: uiLang === 'en' ? 'Create new' : uiLang === 'uk' ? 'Створити новий' : 'Создать новый',
        cancelText: uiLang === 'en' ? 'Cancel' : uiLang === 'uk' ? 'Скасувати' : 'Отмена',
        variant: 'warning',
      });
      if (!confirmed) return;
    }

    const result = clearGraph(graph);
    if (!result?.ok) {
      showToast(result?.error || (uiLang === 'en' ? 'Could not reset canvas' : 'Не удалось сбросить холст'), 'error');
      return;
    }

    graph.setViewport?.({ x: 0, y: 0, zoom: 1 });
    setSelectedBlockId(null);
    setActiveProjectId(null);
    setProjectName('');
    useUiStore.getState().patch({ canvasOnboardingDismissed: false });
    saveCanvasForKey(canvasStorageKey, graph);
    focusCanvasAfterContent();
    showToast(
      uiLang === 'en'
        ? 'New scenario — pick a template or drag blocks from the left'
        : uiLang === 'uk'
          ? 'Новий сценарій — оберіть шаблон або перетягніть блоки зліва'
          : 'Новый сценарий — выберите шаблон или перетащите блоки слева',
      'info',
    );
  }, [
    graph,
    uiLang,
    canvasStorageKey,
    showToast,
    focusCanvasAfterContent,
  ]);

  const handleResetCorruptedGraph = useCallback(async () => {
    const confirmed = await appConfirm({
      title: builderUi.resetCorruptedGraph || 'Сброс повреждённого сценария',
      message: builderUi.resetCorruptedGraphMessage
        || 'Удалить все блоки, битые связи, историю undo и автосохранение холста? Действие необратимо.',
      confirmText: builderUi.resetCorruptedGraph || 'Сбросить',
      cancelText: 'Отмена',
      variant: 'danger',
    });
    if (!confirmed) return;
    const done = beginLoad();
    try {
      const result = resetCorruptedGraphState(graph);
      if (!result?.ok) {
        showToast(result?.error || 'Не удалось сбросить сценарий', 'error');
        return;
      }
      graph.setViewport({ x: 0, y: 0, zoom: 1 });
      setSelectedBlockId(null);
      setActiveProjectId(null);
      try {
        localStorage.removeItem(canvasStorageKey);
      } catch { /* ignore */ }
      saveCanvasForKey(canvasStorageKey, graph);
      showToast(builderUi.resetCorruptedGraphDone || 'Сценарий очищен', 'success');
    } finally {
      done();
    }
  }, [
    graph,
    beginLoad,
    canvasStorageKey,
    showToast,
    builderUi.resetCorruptedGraph,
    builderUi.resetCorruptedGraphMessage,
    builderUi.resetCorruptedGraphDone,
  ]);

  // ── Info panel helpers ────────────────────────────────────────────────────────
  const focusMobileAddedBlock = useCallback((blockId) => {
    if (!isMobileView || !blockId) return;
    setSelectedBlockId(null);
    setMobileAttentionBlockId(blockId);
    setMobileZone('canvas');
  }, [isMobileView]);

  const addBlockFromPaletteTap = useCallback((entry) => {
    if (!entry?.type) return;
    if (entry.type === 'operation' && entry.operationType === 'RemoveNode') {
      if (!selectedBlockId) {
        showToast(builderUi.selectBlockFirst || 'Выберите блок на холсте', 'info');
        return;
      }
      const compiled = compilePaletteAction(entry, { nodeId: selectedBlockId });
      if (compiled.ok) applyComposition(graph, compiled);
      return;
    }
    if (entry.type === 'operation' && entry.operationType === 'UpdateNodeData') {
      if (!selectedBlockId) {
        showToast(builderUi.selectBlockFirst || 'Выберите блок для правки', 'info');
        return;
      }
      setMobileZone('canvas');
      return;
    }
    if (entry.type === 'operation' && entry.operationType === 'AddEdge') {
      showToast(builderUi.connectOnCanvas || 'Соединяйте блоки перетаскиванием на холсте', 'info');
      return;
    }
    if (entry.type !== 'node') return;
    const type = entry.defaultNodeType || entry.id?.replace(/^node:/, '') || 'message';
    const position = getCanvasCenterPosition();
    const props = graphMakePropsForNewBlock(graph, type, currentUser);
    const conflict = graphGetUniqueConflictMessage(graph, type, props, uiLang);
    if (conflict) {
      showToast(conflict, 'info');
      return;
    }
    if (selectedBlockId && tryAttachLegacyUiToSelected(type, props)) {
      showToast('Элемент добавлен к выбранному блоку', 'success');
      focusMobileAddedBlock(selectedBlockId);
      return;
    }
    const nodeId = uid();
    const doc = graph.getGraphDocument();
    const chainParentId = resolvePaletteChainParentId(doc, selectedBlockId, type);
    if (chainParentId) {
      const inserted = insertNodeAfter(chainParentId, nodeId, type, props);
      if (!inserted?.ok) {
        showToast(inserted?.error || 'Не удалось добавить шаг', 'info');
        return;
      }
    } else {
      if (selectedBlockId && !doc.nodes[selectedBlockId]) {
        setSelectedBlockId(null);
      }
      const result = graphAddNode(graph, { nodeId, type, position, data: props });
      if (!result?.ok) {
        showToast(result?.error || 'Не удалось добавить шаг', 'info');
        return;
      }
    }
    setSelectedBlockId(nodeId);
    useSelectionStore.getState().requestCanvasFocus(nodeId);
    focusMobileAddedBlock(nodeId);
  }, [
    builderUi,
    focusMobileAddedBlock,
    getCanvasCenterPosition,
    currentUser,
    selectedBlockId,
    showToast,
    graph,
    insertNodeAfter,
    tryAttachLegacyUiToSelected,
  ]);

  const addBlockFromContext = useCallback((type) => {
    try {
    const position = getCanvasCenterPosition();
    const props = graphMakePropsForNewBlock(graph, type, currentUser);
    const anchorId = selectedBlockId;
    const conflict = graphGetUniqueConflictMessage(graph, type, props, uiLang);
    if (conflict) {
      showToast(conflict, 'info');
      return;
    }
    if (anchorId && tryAttachLegacyUiToSelected(type, props, anchorId)) {
      showToast('Элемент добавлен к выбранному блоку', 'success');
      focusMobileAddedBlock(anchorId);
      return;
    }
    const nodeId = uid();
    if (anchorId) {
      const inserted = insertNodeAfter(anchorId, nodeId, type, props);
      if (!inserted?.ok) {
        showToast(inserted?.errorDetail?.fix || inserted?.error || 'Не удалось добавить шаг', 'info');
        return;
      }
      if (inserted.effectiveParentId && inserted.effectiveParentId !== inserted.requestedParentId) {
        const doc = graph.getGraphDocument();
        const parentNode = doc.nodes[inserted.effectiveParentId];
        const label = graphUniqueBlockLabel(graphResolveNodeType(parentNode), uiLang);
        showToast(
          uiLang === 'en'
            ? `Block added after «${label}» (not under settings)`
            : `Блок добавлен после «${label}»`,
          'success',
        );
      }
    } else {
      const result = graphAddNode(graph, { nodeId, type, position, data: props });
      if (!result?.ok) {
        showToast(result?.error || 'Не удалось добавить шаг', 'info');
        return;
      }
    }
    setSelectedBlockId(nodeId);
    useSelectionStore.getState().requestCanvasFocus(nodeId);
    focusMobileAddedBlock(nodeId);
    } catch (err) {
      const msg = err instanceof UnknownBlockTypeError
        ? (uiLang === 'en' ? `Unknown block type: ${err.type || type}` : `Неизвестный тип блока: ${err.type || type}`)
        : (err?.message || 'Не удалось добавить блок');
      showToast(msg, 'info');
    }
  }, [
    focusMobileAddedBlock,
    getCanvasCenterPosition,
    currentUser,
    showToast,
    graph,
    uiLang,
    selectedBlockId,
    insertNodeAfter,
    tryAttachLegacyUiToSelected,
    uiLang,
  ]);

  const mergeLibraryStacks = useCallback((prevStacks, incomingStacks) => {
    if (!Array.isArray(incomingStacks) || incomingStacks.length === 0) return prevStacks;
    const result = [...prevStacks];

    const rootKey = (stack) => {
      const root = stack?.blocks?.[0];
      if (!root) return '';
      const p = root.props || {};
      if (root.type === 'global') return `global:${p.varname || ''}`;
      if (root.type === 'command') return `command:${p.cmd || ''}`;
      if (root.type === 'callback') return `callback:${p.label || ''}`;
      if (root.type === 'block' || root.type === 'scenario') return `${root.type}:${p.name || ''}`;
      return `${root.type}`;
    };
    const blockKey = (b) => `${b?.type || ''}:${JSON.stringify(b?.props || {})}`;

    const REPLACE_MERGE_ROOTS = new Set(['bot', 'start', 'commands', 'version']);
    const rootIndex = new Map(result.map((s, i) => [rootKey(s), i]));
    for (const stack of incomingStacks) {
      const k = rootKey(stack);
      const i = rootIndex.get(k);
      if (i == null || !k) {
        result.push(stack);
        rootIndex.set(k, result.length - 1);
        continue;
      }
      const target = result[i];
      const incomingRoot = stack.blocks?.[0];
      const targetRoot = target.blocks?.[0];
      const sameRootType = incomingRoot?.type === targetRoot?.type;
      const shouldReplaceStack =
        sameRootType && (
          REPLACE_MERGE_ROOTS.has(incomingRoot?.type)
          || (incomingRoot?.type === 'callback'
            && (incomingRoot.props?.label || '') === (targetRoot?.props?.label || ''))
          || (incomingRoot?.type === 'global'
            && (incomingRoot.props?.varname || '') === (targetRoot?.props?.varname || ''))
        );
      if (shouldReplaceStack) {
        result[i] = {
          ...stack,
          id: target.id || stack.id,
          x: target.x ?? stack.x,
          y: target.y ?? stack.y,
        };
        continue;
      }
      const seen = new Set((target.blocks || []).map(blockKey));
      for (const b of (stack.blocks || [])) {
        const bk = blockKey(b);
        if (!seen.has(bk)) {
          target.blocks.push({ ...b, id: uid() });
          seen.add(bk);
        }
      }
    }

    // Удаляем повторы глобальных переменных по varname (синхронизация библиотек без дублей).
    const seenGlobals = new Set();
    return result.filter((stack) => {
      const root = stack?.blocks?.[0];
      if (root?.type !== 'global') return true;
      const name = root?.props?.varname || '';
      if (!name) return true;
      if (seenGlobals.has(name)) return false;
      seenGlobals.add(name);
      return true;
    });
  }, []);


  const loadExampleGraph = useCallback((exampleName) => {
    const flow = EXAMPLE_GRAPH_FLOWS[exampleName];
    if (!flow) {
      showToast(builderUi.exampleUnavailable || 'Пример недоступен', 'info');
      return;
    }
    const token = (currentUser?.test_token || '').trim() || 'YOUR_BOT_TOKEN';
    const nodes = flow.nodes.map((n) => {
      if (n.data?.type !== 'bot') return n;
      return {
        ...n,
        data: { ...n.data, props: { ...n.data.props, token } },
      };
    });
    const doc = createGraphDocument({
      nodes,
      edges: flow.edges || [],
    });
    const prodValidation = validateGraph(doc, { context: 'example' });
    if (!prodValidation.ok) {
      showToast(prodValidation.issues[0]?.message || 'Corrupted example graph', 'error');
      return;
    }
    const validation = validateGraphDocumentForEditor(doc);
    if (!validation.ok) {
      const msg = validation.errors[0]?.message || 'Invalid example graph';
      showToast(msg, 'error');
      return;
    }
    for (const w of validation.warnings) {
      if (import.meta.env?.DEV) console.warn('[graph validate]', w);
    }
    skipNextCanvasSave.current = true;
    const done = beginLoad();
    let migrated;
    try {
      migrated = migrateGraphDocument(graph, doc);
      if (!migrated?.ok) {
        showToast(migrated?.error || builderUi.exampleUnavailable || 'Не удалось загрузить пример', 'error');
        return;
      }
    } finally {
      done();
      skipNextCanvasSave.current = false;
    }
    applyCanvasLayout();
    syncGraphUidSequence();
    const loadedNodes = graphGetNodes(graph);
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const vp = computeViewportForNodes(loadedNodes, {
      width: viewportW,
      height: viewportH,
    });
    graph.setViewport(vp);
    setSelectedBlockId(null);
    const label = EXAMPLE_LABELS[exampleName]?.ru || EXAMPLE_LABELS[exampleName]?.en || String(exampleName);
    setProjectName(label.replace(/^[^\s]+\s/, '').trim() || label);
    showToast(label, 'success');
  }, [graph, showToast, currentUser, builderUi, beginLoad, syncGraphUidSequence, applyCanvasLayout]);

  const handleApplyFlowTemplate = useCallback((templateId) => {
    const exampleKey = exampleKeyForTemplate(templateId);
    if (!exampleKey) {
      showToast(
        uiLang === 'en' ? 'Template not found' : 'Шаблон не найден',
        'error',
      );
      return;
    }
    loadExampleGraph(exampleKey);
    setMobileZone('canvas');
  }, [loadExampleGraph, showToast, uiLang, setMobileZone]);

  const loadExampleFromFile = loadExampleGraph;

  const handleComposeGraphModules = useCallback(({ document: composedDoc, report, moduleIds }) => {
    if (!composedDoc) {
      showToast(builderUi.libComposeFailed || 'Не удалось собрать graph', 'error');
      return;
    }
    const validation = validateGraphDocumentForEditor(composedDoc);
    if (!validation.ok) {
      showToast(validation.errors[0]?.message || 'Invalid composed graph', 'error');
      return;
    }
    skipNextCanvasSave.current = true;
    const done = beginLoad();
    try {
      const imported = importComposedGraph(graph, composedDoc);
      if (!imported?.ok) {
        showToast(imported?.error || builderUi.libComposeFailed || 'Import failed', 'error');
        return;
      }
    } finally {
      done();
      skipNextCanvasSave.current = false;
    }
    afterCanvasHydrateRef.current?.();
    focusCanvasAfterContent();
    const fixCount = report?.fixes?.length || 0;
    const names = (moduleIds || []).join(', ');
    showToast(
      fixCount
        ? `${builderUi.libInsertSuccess || 'Модуль добавлен'} (${names}, ${fixCount} auto-fix)`
        : `${builderUi.libInsertSuccess || 'Модуль добавлен'}: ${names}`,
      'success',
    );
  }, [graph, showToast, builderUi, beginLoad, focusCanvasAfterContent]);

  const persistProjectToCloud = useCallback(async (nameOverride) => {
    if (!currentUser?.id) {
      throw new Error('Войдите в аккаунт, чтобы сохранить проект в облако');
    }
    const rawName = (nameOverride != null && String(nameOverride).trim())
      ? String(nameOverride).trim()
      : (projectName.trim() || 'Без названия');
    const name = rawName || 'Без названия';
    usePersistenceStore.getState().beginSave();
    try {
      const saved = await saveProjectToCloud(
        currentUser.id,
        name,
        graph.getGraphDocument(),
        activeProjectId,
      );
      if (saved?.id) setActiveProjectId(saved.id);
      if (!projectName.trim()) setProjectName(name);
      await loadUserProjects(currentUser.id);
      usePersistenceStore.getState().endSave(graphRevision);
      return saved;
    } catch (e) {
      usePersistenceStore.getState().setSaveError(e?.message || 'cloud save failed');
      throw e;
    }
  }, [currentUser?.id, projectName, activeProjectId, loadUserProjects, graph, graphRevision]);

  const notifyCloudSaveSuccess = useCallback(async (saved, nameFallback = '') => {
    const label = saved?.name || nameFallback || projectName.trim() || 'Без названия';
    showToast(`☁ ${builderUi.cloudSaveReminderTitle}: ${label}`, 'success');
    await appAlert({
      title: builderUi.cloudSaveReminderTitle,
      message: builderUi.cloudSaveReminderMessage,
      confirmText: builderUi.cloudSaveReminderOk,
      variant: 'info',
    });
  }, [showToast, builderUi, projectName]);

  const saveProject = useCallback(async () => {
    if (currentUser?.id) {
      try {
        const saved = await persistProjectToCloud();
        await notifyCloudSaveSuccess(saved);
      } catch (e) {
        showToast(e?.message || 'Не удалось сохранить проект', 'error');
      }
      return;
    }
    try {
      exportProjectToFile(graph.getGraphDocument());
      showToast('Файл скачан. Войдите в аккаунт для сохранения в облако.', 'info');
    } catch (e) {
      showToast(e?.message || 'Не удалось экспортировать проект', 'error');
    }
  }, [currentUser?.id, persistProjectToCloud, showToast, notifyCloudSaveSuccess]);

  const saveProjectToCloudWithReminder = useCallback(async (name) => {
    const saved = await persistProjectToCloud(name);
    await notifyCloudSaveSuccess(saved, name);
    return saved;
  }, [persistProjectToCloud, notifyCloudSaveSuccess]);

  const loadProject = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          const rawDoc = data?.graph_document ?? data;
          const check = validateGraph(rawDoc);
          if (!check.ok) throw new Error(check.issues[0]?.message || 'invalid_graph_document');
          const doc = createGraphDocument(rawDoc);
          const done = beginLoad();
          try {
            const result = migrateGraphDocument(graph, doc);
            if (!result?.ok) throw new Error(result?.error || 'invalid_graph_document');
            setSelectedBlockId(null);
            showToast('Проект загружен!', 'success');
          } finally {
            done();
          }
          applyCanvasLayout();
          syncGraphUidSequence();
        } catch (err) {
          showToast('Ошибка загрузки файла', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [showToast, graph, beginLoad, syncGraphUidSequence]);

  const {
    isSandboxRunning,
    isServerRunning,
    isStartingSandbox,
    isStartingServer,
    startBotError,
    isStoppingSandbox,
    isStoppingServer,
    stopBotError,
    sandboxSecondsLeft,
  } = previewSlice;
  const setIsSandboxRunning = (v) => setPreview({ isSandboxRunning: v });
  const setIsServerRunning = (v) => setPreview({ isServerRunning: v });
  const setIsStartingSandbox = (v) => setPreview({ isStartingSandbox: v });
  const setIsStartingServer = (v) => setPreview({ isStartingServer: v });
  const setStartBotError = (v) => setPreview({ startBotError: v });
  const setIsStoppingSandbox = (v) => setPreview({ isStoppingSandbox: v });
  const setIsStoppingServer = (v) => setPreview({ isStoppingServer: v });
  const setStopBotError = (v) => setPreview({ stopBotError: v });
  const setSandboxSecondsLeft = (v) => setPreview({ sandboxSecondsLeft: v });
  const sandboxCountdownRef = useRef(null);
  const botDebugModeRef = useRef('sandbox');

  const publishBusy = useUiStore((s) => s.publishBusy);
  const setPublishBusy = (v) => setUi({ publishBusy: v });
  const botDebugOpen = uiSlice.botDebugOpen;
  const setBotDebugOpen = (v) => setUi({ botDebugOpen: v });
  const graphDiagOpen = uiSlice.graphDiagOpen;
  const setGraphDiagOpen = (v) => setUi({ graphDiagOpen: v });
  const graphStrictMode = uiSlice.graphStrictMode;
  const setGraphStrictMode = (v) => useUiStore.getState().setGraphStrictMode(v);

  const softValidationStatus = useGraphSoftValidation(graph.getGraphDocument, graphRevision);

  const graphRefIndex = useGraphReferenceIndex(
    graph.getGraphDocument,
    graphRevision,
    builderBlockTypes,
  );
  const [fullValidationResult, setFullValidationResult] = useState(null);
  const [fullValidationBusy, setFullValidationBusy] = useState(false);
  const [validationOverlayActive, setValidationOverlayActive] = useState(false);
  const [lastRepairResult, setLastRepairResult] = useState(null);
  const [repairBusy, setRepairBusy] = useState(false);

  /** Focus canvas on diagnostic target — pulse highlight, selection, viewport pan. */
  const handleHighlightCompileNodes = useCallback((target, kind = 'compile') => {
    const payload = Array.isArray(target)
      ? { nodeIds: target, edgeIds: [] }
      : { nodeIds: target?.nodeIds || [], edgeIds: target?.edgeIds || [] };
    let nodeIds = payload.nodeIds.filter(Boolean);
    const edgeIds = payload.edgeIds.filter(Boolean);
    const doc = graph.getGraphDocument();
    if (!nodeIds.length && edgeIds[0] && doc?.edges?.[edgeIds[0]]) {
      const e = doc.edges[edgeIds[0]];
      nodeIds = [e.source, e.target].filter(Boolean);
    }
    if (!nodeIds.length && !edgeIds.length) return;

    setRepairHighlight({
      nodeIds,
      edgeIds,
      until: Date.now() + 12_000,
      kind,
    });
    if (nodeIds.length) {
      setSelectedBlockId(nodeIds[0]);
      const focusNodes = nodeIds.map((id) => doc?.nodes?.[id]).filter(Boolean);
      if (focusNodes.length) {
        graph.setViewport(computeViewportForNodes(focusNodes, {
          width: canvasRef.current?.clientWidth,
          height: canvasRef.current?.clientHeight,
          padding: 80,
          maxZoom: 1.15,
        }));
      }
    }
  }, [graph]);

  /** Debug trace panel → same canvas highlight as diagnostics jump. */
  const handleTraceHighlightChange = useCallback((highlights) => {
    const active = highlights?.active || [];
    if (!active.length) {
      setRepairHighlight({ nodeIds: [], edgeIds: [], until: 0, kind: null });
      return;
    }
    setRepairHighlight({
      nodeIds: active,
      edgeIds: [],
      until: Date.now() + 12_000,
      kind: 'execution',
    });
    if (active.length) {
      setSelectedBlockId(active[0]);
      const doc = graph.getGraphDocument();
      const focusNodes = active.map((id) => doc?.nodes?.[id]).filter(Boolean);
      if (focusNodes.length) {
        graph.setViewport(computeViewportForNodes(focusNodes, {
          width: canvasRef.current?.clientWidth,
          height: canvasRef.current?.clientHeight,
          padding: 80,
          maxZoom: 1.15,
        }));
      }
    }
  }, [graph, canvasRef]);

  const requestFullValidation = useCallback(() => {
    setFullValidationBusy(true);
    setGraphDiagOpen(true);
    try {
      const doc = graph.getGraphDocument();
      const result = runFullGraphValidation(doc, { strict: graphStrictMode, lang: uiLang });
      setFullValidationResult(result);
      setValidationOverlayActive(result.badge === 'errors');
    } finally {
      setFullValidationBusy(false);
    }
  }, [graph, graphStrictMode, uiLang]);

  const dismissValidationOverlay = useCallback(() => {
    setValidationOverlayActive(false);
  }, []);

  const showRepairHighlights = useCallback(() => {
    const h = lastRepairResult?.highlights;
    if (!h) return;
    handleHighlightCompileNodes({
      nodeIds: h.nodeIds || [],
      edgeIds: [...(h.edgeIds || []), ...(h.removedEdgeIds || [])],
    }, 'repair');
  }, [lastRepairResult, handleHighlightCompileNodes]);

  const requestAutoRepair = useCallback(() => {
    setRepairBusy(true);
    setGraphDiagOpen(true);
    try {
      const doc = graph.getGraphDocument();
      const preview = repairGraphIssues(doc, {
        strict: graphStrictMode,
        lang: uiLang,
        pipeline: fullValidationResult?.pipeline,
      });
      if (!preview.operations.length) {
        showToast(uiLang === 'en' ? 'No automatic fixes available' : 'Нет доступных автоисправлений', 'info');
        return;
      }
      const committed = commitRepairTransaction(
        { dispatch: graph.dispatch, undo: graph.undo, getGraphDocument: graph.getGraphDocument },
        preview.transaction,
        preview.operations,
      );
      if (!committed.ok) {
        showToast(committed.error || (uiLang === 'en' ? 'Repair failed' : 'Не удалось применить исправления'), 'error');
        return;
      }
      setLastRepairResult({
        ...preview,
        undoSteps: committed.undoSteps,
      });
      handleHighlightCompileNodes({
        nodeIds: preview.highlights.nodeIds || [],
        edgeIds: [...(preview.highlights.edgeIds || []), ...(preview.highlights.removedEdgeIds || [])],
      });
      const after = runFullGraphValidation(graph.getGraphDocument(), { strict: graphStrictMode, lang: uiLang });
      setFullValidationResult(after);
      setValidationOverlayActive(after.badge === 'errors');
      showToast(
        uiLang === 'en'
          ? `Fixed ${preview.fixCount} issue(s)`
          : `Исправлено ${preview.fixCount} ошибок`,
        'success',
      );
    } finally {
      setRepairBusy(false);
    }
  }, [
    graph,
    graphStrictMode,
    uiLang,
    fullValidationResult,
    showToast,
    handleHighlightCompileNodes,
  ]);

  const undoLastRepair = useCallback(() => {
    const steps = lastRepairResult?.undoSteps || 0;
    if (!steps) return;
    rollbackRepair({ undo: graph.undo }, steps);
    setLastRepairResult(null);
    setRepairHighlight({ nodeIds: [], edgeIds: [], until: 0, kind: null });
    requestFullValidation();
    showToast(uiLang === 'en' ? 'Repair undone' : 'Исправление отменено', 'info');
  }, [lastRepairResult, graph, requestFullValidation, showToast, uiLang]);

  React.useEffect(() => {
    if (!repairHighlight.until) return undefined;
    const left = repairHighlight.until - Date.now();
    if (left <= 0) {
      setRepairHighlight({ nodeIds: [], edgeIds: [], until: 0, kind: null });
      return undefined;
    }
    const t = setTimeout(() => {
      setRepairHighlight({ nodeIds: [], edgeIds: [], until: 0, kind: null });
    }, left);
    return () => clearTimeout(t);
  }, [repairHighlight.until]);

  const graphValidationContextValue = React.useMemo(() => ({
    softStatus: softValidationStatus,
    fullResult: fullValidationResult,
    fullCheckBusy: fullValidationBusy,
    requestFullValidation,
    dismissFullOverlay: dismissValidationOverlay,
    blockingOverlayActive: validationOverlayActive,
    lastRepairResult,
    repairHighlight,
    repairBusy,
    requestAutoRepair,
    undoLastRepair,
    showRepairHighlights,
  }), [
    softValidationStatus,
    fullValidationResult,
    fullValidationBusy,
    requestFullValidation,
    dismissValidationOverlay,
    validationOverlayActive,
    lastRepairResult,
    repairHighlight,
    repairBusy,
    requestAutoRepair,
    undoLastRepair,
    showRepairHighlights,
  ]);

  const [botDebugLogs, setBotDebugLogs] = useState('');
  const [botDebugActive, setBotDebugActive] = useState(false);
  const botStopSyncSkipRef = useRef(0);
  const botDebugScrollRef = useRef(null);
  const botDebugPanelRef = useRef(null);
  const [botDebugPanelPos, setBotDebugPanelPos] = useState(null);
  const botDebugDragRef = useRef(null);
  const isBotRunning = isSandboxRunning || isServerRunning;

  // Таймер только для песочницы (5 мин); серверный бот живёт до конца подписки
  const startSandboxCountdown = useCallback((secondsLeft) => {
    if (sandboxCountdownRef.current) clearInterval(sandboxCountdownRef.current);
    setSandboxSecondsLeft(secondsLeft);
    sandboxCountdownRef.current = setInterval(() => {
      setSandboxSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(sandboxCountdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const getRuntimeUserId = useCallback(() => (
    currentUser?.id ? String(currentUser.id) : ''
  ), [currentUser?.id]);

  // Check if bot is running on server (survives page refresh / re-login)
  const checkBotStatus = useCallback(async (explicitUserId) => {
    try {
      if (botStopSyncSkipRef.current && Date.now() - botStopSyncSkipRef.current < 3000) {
        return;
      }
      const userId = explicitUserId || getRuntimeUserId();
      if (!userId) return;
      const res = await fetch(resolveApiUrl('/api/bots'), { credentials: 'include' });
      if (!res.ok) return;
      const list = await res.json();
      if (!Array.isArray(list)) return;
      const sandboxBot = list.find((b) => b.mode !== 'server');
      const serverBot = list.find((b) => b.mode === 'server');
      setIsSandboxRunning(Boolean(sandboxBot));
      setIsServerRunning(Boolean(serverBot));
      if (serverBot) {
        const pid = serverBot.projectId
          || sessionStorage.getItem(SERVER_PROJECT_STORAGE_KEY)
          || null;
        setServerRunProjectId(pid);
        if (pid) sessionStorage.setItem(SERVER_PROJECT_STORAGE_KEY, pid);
      } else {
        setServerRunProjectId(null);
        sessionStorage.removeItem(SERVER_PROJECT_STORAGE_KEY);
      }
      if (sandboxBot?.startedAt) {
        const timeoutSec = Math.floor((Number(sandboxBot.timeoutMs) || 300000) / 1000);
        const elapsed = Math.floor((Date.now() - sandboxBot.startedAt) / 1000);
        const remaining = Math.max(0, timeoutSec - elapsed);
        if (remaining > 0) startSandboxCountdown(remaining);
        else {
          if (sandboxCountdownRef.current) clearInterval(sandboxCountdownRef.current);
          setSandboxSecondsLeft(null);
        }
      } else {
        if (sandboxCountdownRef.current) clearInterval(sandboxCountdownRef.current);
        setSandboxSecondsLeft(null);
      }
    } catch (e) {
      // server unreachable — leave as false
    }
  }, [getRuntimeUserId, startSandboxCountdown]);

  useEffect(() => {
    if (!currentUser?.id) {
      setIsSandboxRunning(false);
      setIsServerRunning(false);
      setServerRunProjectId(null);
      return undefined;
    }
    checkBotStatus(currentUser.id);
    const interval = setInterval(() => checkBotStatus(currentUser.id), 12_000);
    return () => clearInterval(interval);
  }, [currentUser?.id, checkBotStatus]);

  useEffect(() => {
    if (showProfileModal && currentUser?.id) {
      checkBotStatus(currentUser.id);
    }
  }, [showProfileModal, currentUser?.id, checkBotStatus]);

  // Сохранить returnTo до первого кадра (логин с /flash/, /esphome/ и т.д.)
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1' || params.get('returnTo') || params.get('oauth_login')) {
      captureReturnToFromUrl();
    }
  }, []);

  // Load session on startup (cookie — источник истины; localStorage может быть устаревшим)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasResetToken = !!params.get('reset');
    const wantsLogin = params.get('login') === '1';
    const returnIntent = hasReturnToIntent();
    if (returnIntent) captureReturnToFromUrl();
    const returnTo = safeReturnTo(params.get('returnTo')) || null;

    if (hasResetToken) {
      clearSession();
      setCurrentUser(null);
      setShowAuthModal(true);
      checkBotStatus();
      return undefined;
    }

    const authError = params.get('auth_error');
    if (authError) {
      showToast(decodeURIComponent(authError), 'error');
      params.delete('auth_error');
      params.delete('oauth_login');
      const nextQuery = params.toString();
      window.history.replaceState({}, '', nextQuery ? `/?${nextQuery}` : '/');
      clearSession();
      setCurrentUser(null);
    }

    if (isAuthBypassEnabled()) {
      let cancelledBypass = false;
      (async () => {
        let user = getDevBypassUser();
        try {
          const data = await apiFetch('/api/me');
          if (data?.user) user = normalizeSessionUser(data.user);
        } catch {
          // fallback: mock admin until DB is up
        }
        if (cancelledBypass || !user) return;
        saveSession(user);
        setCurrentUser(user);
        setShowAuthModal(false);
        loadUserProjects(user.id);
        checkBotStatus(user.id);
      })();
      const handleExpiredBypass = () => {};
      window.addEventListener('cicada:session-expired', handleExpiredBypass);
      return () => {
        cancelledBypass = true;
        window.removeEventListener('cicada:session-expired', handleExpiredBypass);
      };
    }

    let cancelled = false;
    const hasOauthLogin = Boolean(params.get('oauth_login'));

    (async () => {
      if (hasOauthLogin) clearSession();
      let serverUser = null;
      try {
        serverUser = await fetchOauthBootstrapUser();
      } catch (err) {
        if (cancelled) return;
        if (err?.twofaRequired) {
          setOauth2faPending(true);
          setAuthTab('login');
          setShowAuthModal(true);
          checkBotStatus();
          return;
        }
        if (err?.oauthFailed) {
          showToast(err.message || 'Не удалось завершить вход', 'error');
          clearSession();
          setCurrentUser(null);
          setAuthTab('login');
          setShowAuthModal(true);
          checkBotStatus();
          return;
        }
      }

      if (cancelled) return;

      const bootUser = normalizeSessionUser(serverUser);
      if (bootUser) {
        saveSession(bootUser);
        if (returnIntent && peekReturnTo()) {
          redirectIfReturnTo();
          return;
        }
        if (!returnIntent) clearRememberedReturnTo();
        setCurrentUser(bootUser);
        setShowAuthModal(false);
        await loadUserProjects(bootUser.id);
        checkBotStatus();
        return;
      }

      if (serverUser) {
        clearSession();
      }

      if (getSession()) {
        clearSession();
      }
      setCurrentUser(null);

      if (wantsLogin || returnTo) {
        setAuthTab('login');
        setShowAuthModal(true);
      } else {
        setShowAuthModal(false);
      }

      checkBotStatus();
    })();

    const handleExpired = () => {
      if (isAuthBypassEnabled()) return;
      setCurrentUser(null);
      setUserProjects([]);
      setShowProfileModal(false);
      setAuthTab('login');
      setShowAuthModal(true);
      showToast('⚠️ Сессия истекла — войдите заново', 'error');
    };
    window.addEventListener('cicada:session-expired', handleExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('cicada:session-expired', handleExpired);
    };
  }, [showToast, loadUserProjects]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    loadUserProjects(currentUser.id);
    return undefined;
  }, [currentUser?.id, loadUserProjects]);

  // /?profile=subscription — с ESPHome и других страниц на вкладку «Подписка»
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('profile') !== 'subscription') return undefined;
    params.delete('profile');
    const nextQuery = params.toString();
    window.history.replaceState({}, '', nextQuery ? `/?${nextQuery}` : '/');
    if (currentUser) {
      openPremiumPurchase();
    } else {
      setAuthTab('register');
      setShowAuthModal(true);
    }
    return undefined;
  }, [currentUser, openPremiumPurchase]);

  // Подтягиваем план/подписку с сервера: админ изменил профиль → без выхода из аккаунта
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let cancelled = false;
    const sync = () => {
      fetchSessionUserFromServer().then((u) => {
        if (cancelled || !u) return;
        setCurrentUser((prev) => {
          if (!prev || String(prev.id) !== String(u.id)) return prev;
          const merged = { ...prev, ...u };
          saveSession(merged);
          return merged;
        });
      });
    };
    sync();
    const interval = setInterval(sync, 20_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, [currentUser?.id]);

  /** Открыли профиль — сразу тянем план/подписку (после выдачи из админки не ждём минутный poll). */
  useEffect(() => {
    if (!showProfileModal || !currentUser?.id) return undefined;
    let cancelled = false;
    fetchSessionUserFromServer().then((u) => {
      if (cancelled || !u) return;
      setCurrentUser((prev) => {
        if (!prev || String(prev.id) !== String(u.id)) return prev;
        const merged = { ...prev, ...u };
        saveSession(merged);
        return merged;
      });
    });
    return () => { cancelled = true; };
  }, [showProfileModal, currentUser?.id]);

  useEffect(() => {
    if (!isAdmin || !currentUser?.id) {
      setAdminOpenSupportCount(0);
      return undefined;
    }
    let cancelled = false;
    const loadSupportCount = () => {
      apiFetch('/api/admin/support-count')
        .then((data) => {
          if (!cancelled) setAdminOpenSupportCount(Number(data?.open || 0));
        })
        .catch(() => {
          if (!cancelled) setAdminOpenSupportCount(0);
        });
    };
    loadSupportCount();
    const interval = setInterval(loadSupportCount, 30_000);
    window.addEventListener('focus', loadSupportCount);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', loadSupportCount);
    };
  }, [isAdmin, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) {
      setUserSupportUnreadCount(0);
      return undefined;
    }
    let cancelled = false;
    const loadUnreadCount = () => {
      apiFetch('/api/support/unread-count')
        .then((data) => {
          if (cancelled) return;
          const nextUnread = Number(data?.unread || 0);
          setUserSupportUnreadCount((prevUnread) => {
            if (supportUnreadInitializedRef.current && nextUnread > prevUnread) {
              showToast('🔔 Поддержка ответила в вашем обращении', 'success');
            }
            supportUnreadInitializedRef.current = true;
            return nextUnread;
          });
        })
        .catch(() => {
          if (!cancelled) setUserSupportUnreadCount(0);
        });
    };
    const handleUnreadEvent = (event) => {
      const nextCount = Number(event?.detail?.count);
      if (Number.isFinite(nextCount)) {
        supportUnreadInitializedRef.current = true;
        setUserSupportUnreadCount(nextCount);
      } else {
        loadUnreadCount();
      }
    };
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30_000);
    window.addEventListener('focus', loadUnreadCount);
    window.addEventListener('cicada:support-unread-updated', handleUnreadEvent);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', loadUnreadCount);
      window.removeEventListener('cicada:support-unread-updated', handleUnreadEvent);
    };
  }, [currentUser?.id, showToast]);

  // Bot status: backoff when tab hidden, 5s when visible
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let delayMs = 5000;
    const schedule = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        await checkBotStatus();
        if (cancelled) return;
        delayMs = document.hidden ? Math.min(Math.round(delayMs * 1.5), 60_000) : 5000;
        schedule();
      }, delayMs);
    };
    const onVisibility = () => {
      if (!document.hidden) {
        delayMs = 5000;
        if (timer) clearTimeout(timer);
        schedule();
      }
    };
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkBotStatus]);

  const generateBotPythonSnapshot = useCallback(
    () => generatePreviewCodegenSnapshot(graph.getGraphDocument, {
      strictGraph: true,
      validationStage: VALIDATION_STAGE.COMPILE,
    }),
    [graph, graphRevision],
  );

  const startBotDebugPanelDrag = useCallback((e) => {
    if (e.button !== 0) return;
    const el = e.target;
    if (el.closest && (el.closest('button') || el.closest('input') || el.closest('a'))) return;
    const panel = botDebugPanelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    setBotDebugPanelPos({ left: rect.left, top: rect.top });
    botDebugDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    const move = (ev) => {
      const d = botDebugDragRef.current;
      if (!d) return;
      let left = d.originLeft + (ev.clientX - d.startX);
      let top = d.originTop + (ev.clientY - d.startY);
      const margin = 8;
      left = Math.max(margin, Math.min(left, window.innerWidth - d.width - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - d.height - margin));
      setBotDebugPanelPos({ left, top });
    };
    const up = () => {
      botDebugDragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!botDebugOpen) return;
    const el = botDebugScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [botDebugOpen, botDebugLogs]);

  useEffect(() => {
    if (!botDebugOpen) return;
    const userId = getRuntimeUserId();
    if (!userId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const logMode = botDebugModeRef.current === 'server' ? 'server' : 'sandbox';
        const r = await fetch(
          `${resolveApiUrl('/api/bot/logs')}?userId=${encodeURIComponent(userId)}&mode=${logMode}`,
          { credentials: 'include' },
        );
        const data = await r.json().catch(() => ({}));
        if (cancelled || !r.ok) return;
        if (typeof data.logs !== 'string') return;
        setBotDebugActive(Boolean(data.active));
        setBotDebugLogs(String(data.logs));
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 1200);
    return () => { cancelled = true; clearInterval(id); };
  }, [botDebugOpen, getRuntimeUserId]);

  const runBot = useCallback(async (mode = 'sandbox', options = {}) => {
    const serverMode = mode === 'server';
    if (serverMode) setIsStartingServer(true);
    else setIsStartingSandbox(true);
    setStartBotError(null);
    try {
      const userId = getRuntimeUserId();
      if (!userId) {
        setAuthTab('login');
        setShowAuthModal(true);
        setStartBotError('Войдите в аккаунт, чтобы запустить бота');
        return;
      }
      const serverProjectId = options.projectId ? String(options.projectId) : '';
      if (serverMode) {
        const pid = serverProjectId || activeProjectId;
        if (!pid) {
          setStartBotError(builderUi.startServerNeedsProject);
          return;
        }
        if (!hasActiveProSubscription) {
          openPremiumPurchase();
          setStartBotError(builderUi.startServerNeedsPremium);
          return;
        }
        if (isServerRunning) {
          setStartBotError(builderUi.serverAlreadyRunning);
          return;
        }
      }
      const snap = options.graphDocument
        ? generatePreviewCodegenSnapshot(options.graphDocument)
        : generateBotPythonSnapshot();
      if (snap.compileErrors?.length) {
        const strictCheck = runFullGraphValidation(
          options.graphDocument || graph.getGraphDocument(),
          { strict: true, lang: uiLang },
        );
        setFullValidationResult(strictCheck);
        setGraphDiagOpen(true);
        setValidationOverlayActive(true);
        const firstUx = strictCheck.userErrors?.[0] || strictCheck.displayErrors?.[0];
        setStartBotError(firstUx?.hint || firstUx?.title || snap.compileErrors[0]?.message || 'Ошибка подготовки сценария к запуску');
        return;
      }
      const resolvedTok = graphResolveBotToken(graph, currentUser);
      if (!serverMode) {
        if (!graphHasBotBlock(graph)) {
          setStartBotError(builderUi.addBotTokenTitle);
          return;
        }
        if (!resolvedTok || isPlaceholderBotToken(resolvedTok)) {
          setStartBotError(builderUi.needBotToken);
          return;
        }
      }
      let generatedPython = String(snap.generatedPython || '').trim();
      if (!generatedPython) {
        setStartBotError('Не удалось сгенерировать код бота. Проверьте схему на холсте.');
        return;
      }
      if (resolvedTok && !isPlaceholderBotToken(resolvedTok)) {
        generatedPython = injectBotTokenInPython(generatedPython, resolvedTok);
      }
      const payload = { code: generatedPython, userId, mode };
      if (mode === 'server') {
        payload.projectId = serverProjectId || activeProjectId;
      }
      const response = await postJsonWithCsrf('/api/run', payload);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        let msg = data.error || `Ошибка запуска (HTTP ${response.status})`;
        if (data.needsPremium) openPremiumPurchase();
        const d = data.details || {};
        if (d.logTail) {
          msg += `\n\nЛог:\n${d.logTail}`;
        } else if (d.reason || d.code != null || d.signal) {
          msg += `\n\nДетали: reason=${d.reason || 'exit'}, code=${d.code ?? 'null'}, signal=${d.signal ?? 'null'}`;
        }
        setStartBotError(msg);
        return;
      }
      botDebugModeRef.current = serverMode ? 'server' : 'sandbox';
      if (serverMode) {
        setIsServerRunning(true);
        const pid = data.projectId || serverProjectId || activeProjectId;
        setServerRunProjectId(pid || null);
        if (pid) sessionStorage.setItem(SERVER_PROJECT_STORAGE_KEY, pid);
      } else {
        setIsSandboxRunning(true);
      }
      setBotDebugLogs('');
      setBotDebugOpen(true);
      showToast(
        serverMode ? '☁ Бот запущен на сервере (Premium)' : '✅ Тест на 5 минут запущен',
        'success',
      );
      if (!serverMode) {
        if (sandboxCountdownRef.current) clearInterval(sandboxCountdownRef.current);
        if (data.autoStopIn) startSandboxCountdown(data.autoStopIn);
        else setSandboxSecondsLeft(null);
      }
    } catch (e) {
      setStartBotError(e.message);
    } finally {
      if (serverMode) setIsStartingServer(false);
      else setIsStartingSandbox(false);
    }
  }, [
    generateBotPythonSnapshot,
    showToast,
    getRuntimeUserId,
    startSandboxCountdown,
    isProjectMode,
    activeProjectId,
    hasActiveProSubscription,
    builderUi.startServerNeedsProject,
    builderUi.startServerNeedsPremium,
    builderUi.serverAlreadyRunning,
    builderUi.addBotTokenTitle,
    builderUi.needBotToken,
    openPremiumPurchase,
    isServerRunning,
    graph,
    currentUser,
  ]);

  const startBot = useCallback(() => runBot('sandbox'), [runBot]);
  const startBotOnServer = useCallback(() => runBot('server'), [runBot]);
  const startBotOnServerForProject = useCallback(async (projectId) => {
    const project = await loadProjectFromCloud(projectId);
    if (!project?.graph_document) {
      showToast('Не удалось загрузить проект', 'error');
      return;
    }
    await runBot('server', { projectId, graphDocument: project.graph_document });
  }, [runBot, showToast]);

  const flowListItems = React.useMemo(() => {
    const locale = uiLang === 'en' ? 'en-US' : uiLang === 'uk' ? 'uk-UA' : 'ru-RU';
    const formatDate = (raw) => {
      if (!raw) return undefined;
      try {
        return new Date(raw).toLocaleDateString(locale);
      } catch {
        return undefined;
      }
    };
    const items = (userProjects || []).map((p) => {
      const running = serverRunProjectId === p.id && isServerRunning;
      const updatedIso = p.updatedAt || p.updated_at || null;
      const meta = deriveFlowListMeta(uiLang, null);
      return {
        id: p.id,
        name: p.name || (uiLang === 'en' ? 'Untitled' : 'Без названия'),
        updatedAt: formatDate(updatedIso),
        updatedAtIso: updatedIso,
        status: running ? 'active' : 'draft',
        channel: 'telegram',
        triggerLabel: meta.triggerLabel,
        triggerType: meta.triggerType,
        nodeCount: 0,
        analyticsCount: running ? 12 : 0,
      };
    });
    const localName = projectName.trim();
    if (localName) {
      const draftId = activeProjectId || '__draft__';
      if (!items.some((i) => i.id === draftId)) {
        const meta = deriveFlowListMeta(uiLang, graph.getGraphDocument());
        items.unshift({
          id: draftId,
          name: localName,
          status: 'draft',
          channel: 'telegram',
          ...meta,
        });
      }
    }
    const enrich = (item, doc) => {
      const meta = deriveFlowListMeta(uiLang, doc);
      const running = serverRunProjectId === item.id && isServerRunning;
      return {
        ...item,
        ...meta,
        status: running ? 'active' : item.status,
        analyticsCount: running ? Math.max(meta.nodeCount * 4, 8) : meta.nodeCount * 2,
      };
    };
    if (activeProjectId && activeProjectId !== '__draft__') {
      return items.map((item) => (
        item.id === activeProjectId
          ? enrich(item, graph.getGraphDocument())
          : item
      ));
    }
    return items;
  }, [
    userProjects,
    projectName,
    activeProjectId,
    uiLang,
    graph,
    graphRevision,
    serverRunProjectId,
    isServerRunning,
  ]);

  const controlPanelSectionLists = React.useMemo(() => ({
    flows: flowListItems,
    automations: flowListItems.filter((i) => i.status === 'active'),
    broadcasts: [],
    audience: [],
    analytics: [],
    templates: [],
    settings: [
      {
        id: 'modules',
        name: uiLang === 'en' ? 'Module library' : uiLang === 'uk' ? 'Бібліотека модулів' : 'Библиотека модулей',
        kind: 'system',
        status: 'active',
      },
      {
        id: 'bot-profile',
        name: uiLang === 'en' ? 'Bot & account' : uiLang === 'uk' ? 'Бот і акаунт' : 'Бот и аккаунт',
        kind: 'bot',
        status: 'active',
      },
    ],
  }), [flowListItems, uiLang]);

  const sidebarNavCounts = React.useMemo(() => ({
    flows: flowListItems.length,
    automations: flowListItems.filter((i) => i.status === 'active').length,
    audience: 0,
    broadcasts: 0,
    templates: 0,
    analytics: 0,
    settings: controlPanelSectionLists.settings?.length ?? 0,
  }), [flowListItems, controlPanelSectionLists.settings]);

  const handleGlobalPublish = useCallback(async () => {
    setPublishBusy(true);
    try {
      await saveProject();
    } finally {
      setPublishBusy(false);
    }
  }, [saveProject]);

  const handleGlobalPreview = useCallback(() => {
    setPreviewPanelOpen((v) => {
      const next = !v;
      if (next && !isMobileView && simulatorDocked) {
        setInspectorTab('simulator');
        useSelectionStore.getState().requestInspectorReveal();
      }
      return next;
    });
  }, [setPreviewPanelOpen, isMobileView, simulatorDocked, setInspectorTab]);

  const handleDuplicateFlow = useCallback(async (projectId) => {
    if (!currentUser?.id) {
      showToast(uiLang === 'en' ? 'Sign in to duplicate' : 'Войдите, чтобы дублировать', 'info');
      return;
    }
    try {
      let doc;
      let baseName;
      if (projectId === '__draft__' || !projectId) {
        doc = graph.getGraphDocument();
        baseName = projectName.trim() || (uiLang === 'en' ? 'Untitled' : 'Без названия');
      } else {
        const project = await loadProjectFromCloud(projectId);
        if (!project?.graph_document) {
          showToast(uiLang === 'en' ? 'Could not load project' : 'Не удалось загрузить проект', 'error');
          return;
        }
        doc = project.graph_document;
        baseName = project.name || (uiLang === 'en' ? 'Untitled' : 'Без названия');
      }
      const copyName = `${baseName} (${uiLang === 'en' ? 'copy' : 'копия'})`;
      usePersistenceStore.getState().beginSave();
      await saveProjectToCloud(currentUser.id, copyName, doc, null);
      await loadUserProjects(currentUser.id);
      usePersistenceStore.getState().endSave(graphRevision);
      showToast(uiLang === 'en' ? 'Flow duplicated' : 'Сценарий продублирован', 'success');
    } catch (e) {
      usePersistenceStore.getState().setSaveError(e?.message);
      showToast(e?.message || (uiLang === 'en' ? 'Duplicate failed' : 'Не удалось дублировать'), 'error');
    }
  }, [currentUser?.id, graph, projectName, graphRevision, loadUserProjects, showToast, uiLang]);

  const handleArchiveFlow = useCallback((projectId) => {
    if (!projectId || projectId === '__draft__') return;
    showToast(
      uiLang === 'en' ? 'Flow moved to archive' : 'Сценарий перемещён в архив',
      'info',
    );
  }, [showToast, uiLang]);

  const handleExportFlow = useCallback(async (projectId) => {
    try {
      if (!projectId || projectId === '__draft__') {
        exportProjectToFile(graph.getGraphDocument());
      } else {
        const project = await loadProjectFromCloud(projectId);
        if (!project?.graph_document) {
          showToast(uiLang === 'en' ? 'Could not load project' : 'Не удалось загрузить', 'error');
          return;
        }
        exportProjectToFile(project.graph_document);
      }
      showToast(uiLang === 'en' ? 'JSON exported' : 'JSON экспортирован', 'info');
    } catch (e) {
      showToast(e?.message || (uiLang === 'en' ? 'Export failed' : 'Не удалось экспортировать'), 'error');
    }
  }, [graph, showToast, uiLang]);

  const canRunFlowTest = graphHasRunnableBot(graph, currentUser);

  const handleBulkDeleteFlows = useCallback(async (ids) => {
    if (!currentUser?.id) {
      showToast(
        uiLang === 'en' ? 'Sign in to delete projects' : 'Войдите, чтобы удалять проекты',
        'info',
      );
      return;
    }
    try {
      for (const id of ids) {
        await deleteProject(id);
      }
      await loadUserProjects();
      if (ids.includes(activeProjectId)) {
        setActiveProjectId(null);
      }
      showToast(
        uiLang === 'en' ? 'Projects deleted' : 'Проекты удалены',
        'info',
      );
    } catch (e) {
      showToast(e?.message || (uiLang === 'en' ? 'Delete failed' : 'Не удалось удалить'), 'error');
    }
  }, [activeProjectId, currentUser?.id, loadUserProjects, showToast, uiLang]);

  const handleSelectFlowListItem = useCallback(async (projectId) => {
    if (!projectId || projectId === '__draft__') return;
    if (projectId === activeProjectId) return;
    try {
      const project = await loadProjectFromCloud(projectId);
      if (!project?.graph_document) {
        showToast(uiLang === 'en' ? 'Could not load project' : 'Не удалось загрузить проект', 'error');
        return;
      }
      const check = validateGraphDocumentForEditor(project.graph_document);
      if (!check.ok) {
        showToast(check.errors[0]?.message || check.issues?.[0]?.message || 'Проект повреждён', 'error');
        return;
      }
      const done = beginLoad();
      try {
        const migrated = migrateGraphDocument(graph, createGraphDocument(project.graph_document));
        if (!migrated?.ok) {
          showToast(migrated?.error || 'Не удалось загрузить проект', 'error');
          return;
        }
      } finally {
        done();
      }
      applyCanvasLayout();
      syncGraphUidSequence();
      setProjectName(project.name);
      setActiveProjectId(project.id);
      setMobileZone('canvas');
      setAppSection('flows');
      showToast(`📁 ${builderUi.projectBadge(project.name)}`, 'info');
    } catch (e) {
      showToast(e?.message || 'Не удалось загрузить проект', 'error');
    }
  }, [
    activeProjectId,
    beginLoad,
    builderUi,
    graph,
    showToast,
    syncGraphUidSequence,
    uiLang,
  ]);

  const handleTestFlow = useCallback(async (projectId) => {
    if (projectId && projectId !== '__draft__' && projectId !== activeProjectId) {
      await handleSelectFlowListItem(projectId);
    }
    setAppSection('flows');
    setMobileZone('canvas');
    setPreviewPanelOpen(true);
    useSelectionStore.getState().requestInspectorReveal();
  }, [
    activeProjectId,
    handleSelectFlowListItem,
    isMobileView,
    setAppSection,
    setInspectorTab,
    setMobileZone,
    setPreviewPanelOpen,
  ]);

  const useInspectorSimulator = Boolean(
    currentUser
    && isCanvasSection(appSection)
    && simulatorDocked
    && (!isMobileView || mobileZone === 'right'),
  );
  const useFloatingSimulator = Boolean(
    currentUser && previewPanelOpen && !simulatorDocked && !isMobileView && isCanvasSection(appSection),
  );

  const handleControlPanelSelectItem = useCallback(async (itemId) => {
    if (appSection === 'flows' || appSection === 'automations') {
      await handleSelectFlowListItem(itemId);
      return;
    }
    if (appSection === 'settings') {
      if (itemId === 'modules') {
        setShowLibrary(true);
      } else if (itemId === 'bot-profile') {
        setProfileInitialTab('projects');
        setShowProfileModal(true);
      }
    }
  }, [appSection, handleSelectFlowListItem]);

  const stopBot = useCallback(async (mode = 'sandbox') => {
    const serverMode = mode === 'server';
    if (serverMode) setIsStoppingServer(true);
    else setIsStoppingSandbox(true);
    setStopBotError(null);
    try {
      const userId = getRuntimeUserId();
      if (!userId) {
        setAuthTab('login');
        setShowAuthModal(true);
        setStopBotError('Войдите в аккаунт, чтобы остановить бота');
        return;
      }
      const response = await postJsonWithCsrf('/api/stop', { userId, mode });
      const data = await response.json().catch(() => ({}));
      const alreadyStopped = Boolean(data.alreadyStopped);
      if (!response.ok && !alreadyStopped) {
        setStopBotError(data.error || `Ошибка остановки (HTTP ${response.status})`);
        return;
      }
      if (data.error && !alreadyStopped) {
        setStopBotError(data.error);
        return;
      }
      botStopSyncSkipRef.current = Date.now();
      if (serverMode) {
        setIsServerRunning(false);
        setServerRunProjectId(null);
        sessionStorage.removeItem(SERVER_PROJECT_STORAGE_KEY);
        showToast(
          alreadyStopped ? 'Бот уже был остановлен' : '⛔ Серверный бот остановлен',
          'info',
        );
      } else {
        setIsSandboxRunning(false);
        if (sandboxCountdownRef.current) clearInterval(sandboxCountdownRef.current);
        setSandboxSecondsLeft(null);
        showToast(
          alreadyStopped ? 'Тест уже был остановлен' : '⛔ Тест на холсте остановлен',
          'info',
        );
      }
      setBotDebugActive(false);
      try {
        const logMode = serverMode ? 'server' : 'sandbox';
        const lr = await fetch(
          `${resolveApiUrl('/api/bot/logs')}?userId=${encodeURIComponent(userId)}&mode=${logMode}`,
          { credentials: 'include' },
        );
        const logData = await lr.json().catch(() => ({}));
        if (typeof logData.logs === 'string') setBotDebugLogs(logData.logs);
      } catch { /* ignore */ }
      setTimeout(() => checkBotStatus(userId), 400);
    } catch (e) {
      setStopBotError(e.message);
    } finally {
      if (serverMode) setIsStoppingServer(false);
      else setIsStoppingSandbox(false);
    }
  }, [showToast, getRuntimeUserId, checkBotStatus]);

  const stopSandboxBot = useCallback(() => stopBot('sandbox'), [stopBot]);
  const stopServerBot = useCallback(() => stopBot('server'), [stopBot]);

  const authModalNode = showAuthModal ? (
    <AuthModal
      tab={authTab}
      setTab={setAuthTab}
      canClose={!!currentUser}
      onClose={() => setShowAuthModal(false)}
      onLogin={async (email, password, totp, tgData, passkeyMode = false) => {
        let user;
        if (oauth2faPending) {
          user = await completeOauth2FA(totp);
        } else if (tgData) {
          user = await telegramAuth(tgData);
        } else if (passkeyMode) {
          user = await loginWithPasskey(email);
        } else {
          user = await loginUser(email, password, totp);
        }
        saveSession(user);
        setOauth2faPending(false);
        if (peekReturnTo()) {
          redirectIfReturnTo();
          return;
        }
        setCurrentUser(user);
        await loadUserProjects(user.id);
        await checkBotStatus(user.id);
        setShowAuthModal(false);
        showToast('Вход выполнен!', 'success');
      }}
      oauth2faPending={oauth2faPending}
      onRegister={async (name, email, password) => {
        const result = await registerUser(name, email, password);
        if (result.needVerify) {
          return result; // AuthModal переключится на экран "проверьте почту"
        }
        const registeredUser = normalizeSessionUser(result.user);
        if (registeredUser) {
          saveSession(registeredUser);
          if (peekReturnTo()) {
            redirectIfReturnTo();
            return;
          }
          setCurrentUser(registeredUser);
          setShowAuthModal(false);
          await loadUserProjects(registeredUser.id);
          fireRegistrationConfetti();
          showToast('Регистрация успешна! 3 дня PRO уже на аккаунте.', 'success');
        }
      }}
    />
  ) : null;

  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  if (isAdminRoute) {
    return (
      <>
        <AdminRoute
          currentUser={currentUser}
          onLoginClick={() => { setAuthTab('login'); setShowAuthModal(true); }}
        />
        {authModalNode}
      </>
    );
  }

  if (!currentUser) {
    const openRegister = () => { setAuthTab('register'); setShowAuthModal(true); };
    const openLogin    = () => { setAuthTab('login');    setShowAuthModal(true); };
    const lp = isMobileView;
    return (
      <div className="lp-page" style={{ minHeight: '100vh', overflow: 'auto' }}>
        {/* ── NAV ── */}
        <nav className="lp-landing-nav" style={{ padding: lp ? '0 var(--space-2)' : '0 var(--space-4)', height: 56, display:'flex', alignItems:'center', justifyContent:'space-between', gap: 'var(--space-2)' }}>
          <div style={{ lineHeight: 1, display:'flex', alignItems:'center', gap: 8, flexShrink: 0 }}>
            <span className="lp-brand-icon">◈</span>
            <span className="lp-brand-word">Cicada</span>
            <span className="lp-brand-suffix">studio</span>
          </div>
          {/* Nav links — desktop only */}
          {!lp && (
            <div style={{ display:'flex', alignItems:'center', gap:2, flex:1, justifyContent:'center' }}>
              {LANDING_NAV_PILLS.map(({ id, label, icon, clr, external, onClick }) => (
                <button
                  key={id}
                  type="button"
                  className="lp-nav-pill"
                  style={{ '--pill-clr': clr }}
                  onClick={external ? onClick : () => setLandingInfoPage(id)}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = clr;
                    e.currentTarget.style.boxShadow = `0 0 14px ${clr.replace('0.45', '0.18')}, 0 2px 8px rgba(0,0,0,0.25)`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span className="pill-icon">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
          {/* Right actions */}
          <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <button onClick={openLogin} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.82)', fontSize:13, fontWeight:600, cursor:'pointer', padding: lp ? '7px 10px' : '7px 18px', borderRadius:8, fontFamily:'system-ui,sans-serif', transition:'color .2s' }}
              onMouseEnter={e=>e.currentTarget.style.color='#fff'}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.82)'}
            >Войти</button>
            <button className="lp-btn-gold" onClick={openRegister} style={{ borderRadius:9, padding: lp ? '8px 14px' : '9px 20px', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
              {lp ? '→' : 'Начать бесплатно →'}
            </button>
          </div>
        </nav>

        <div style={{ position:'relative' }}>
          {landingInfoPage && LANDING_PAGE_CONTENT[landingInfoPage] && (
            <LandingInfoModal page={landingInfoPage} onClose={() => setLandingInfoPage(null)} isMobile={lp} />
          )}

          {/* ── HERO ── */}
          <div style={{ maxWidth:1220, margin:'0 auto', padding: lp ? '24px 16px 16px' : '36px 40px 40px' }}>
            <div style={{ display:'grid', gridTemplateColumns: lp ? '1fr' : '1fr 1.05fr', gap: lp ? 24 : 40, alignItems:'flex-start', width:'100%' }}>

              {/* Left */}
              <div className="lp-fadeup">
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, border:'1px solid rgba(251,191,36,0.35)', borderRadius:999, padding:'5px 12px', fontSize:11, color:'#fde68a', background:'rgba(251,191,36,0.1)', marginBottom: lp ? 10 : 16 }}>✨ Studio для Telegram-ботов</div>
                <h1 style={{ fontFamily:'Syne,system-ui', fontWeight:800, fontSize: lp ? 32 : 48, lineHeight: lp ? 1.05 : 1.0, letterSpacing:'-0.02em', marginBottom: lp ? 8 : 12 }}>
                  Запусти<br/>красивого бота<br/><span style={{ color:'#fbbf24' }}>за вечер</span>
                </h1>
                <p style={{ color:'rgba(255,255,255,0.7)', fontSize: lp ? 12 : 15, lineHeight:1.5, maxWidth:500, marginBottom: lp ? 10 : 16 }}>
                  Собирай Telegram-бота блоками, проверяй сценарий и запускай в пару кликов. Без длинной настройки и без ручного кода в начале.
                </p>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:14 }}>
                  <button className="lp-btn-gold" onClick={openRegister} style={{ borderRadius:10, padding:'11px 22px', fontSize:14 }}>Начать бесплатно →</button>

                </div>
                <div style={{ marginTop:10, fontSize:11, color:'rgba(255,255,255,0.45)', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:'#3ecf8e', boxShadow:'0 0 6px #3ecf8e', display:'inline-block' }} />
                  Бесплатно навсегда для одного проекта
                </div>
              </div>

              {/* Right — mockup */}
              {!lp && (
                <div style={{ position:'relative', animation:'panelFloat 5.8s ease-in-out infinite', paddingTop:28, overflow:'visible' }} className="lp-fadeup">
                  {/* Glow arc — как на скриншоте */}
                  <svg style={{ position:'absolute', top:'0%', right:'-14%', width:'135%', height:'120%', pointerEvents:'none', zIndex:0 }} viewBox="0 0 500 420" fill="none">
                    <path d="M420 400 Q490 210 380 65 Q295 -15 155 25" stroke="url(#arcGrad)" strokeWidth="1.5" strokeDasharray="820" strokeDashoffset="820" style={{ animation:'glowArc 2.8s 0.3s ease forwards' }} opacity="0.7"/>
                    <defs>
                      <linearGradient id="arcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#7c6ef2" stopOpacity="0"/>
                        <stop offset="35%" stopColor="#7c6ef2" stopOpacity="0.9"/>
                        <stop offset="65%" stopColor="#ffd700" stopOpacity="0.7"/>
                        <stop offset="100%" stopColor="#ffd700" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  {/* Telegram bubble */}
                  <div style={{ position:'absolute', right:-28, top:'15%', width:52, height:52, borderRadius:'50%', background:'radial-gradient(circle at 35% 35%,#60a5fa,#2563eb)', border:'1px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 28px rgba(37,99,235,0.45)', animation:'landingPulse 3.5s ease-in-out infinite', zIndex:2 }}>
                    <svg viewBox="0 0 24 24" width="22" height="22"><path fill="#fff" d="M9.36 15.86l-.39 5.47c.56 0 .8-.24 1.09-.53l2.61-2.5 5.4 3.95c.99.55 1.69.26 1.96-.91l3.55-16.66h.01c.32-1.49-.54-2.08-1.5-1.72L1.55 10.9C.11 11.47.13 12.28 1.31 12.64l5.24 1.64L18.7 6.62c.57-.38 1.1-.17.67.21"/></svg>
                  </div>
                  <div className="mock-neon-wrap">
                  <div style={{ position:'relative', zIndex:1, borderRadius:18, background:'linear-gradient(180deg,rgba(12,14,24,0.99),rgba(6,8,16,1))', overflow:'hidden', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>
                    {/* titlebar */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(8,10,16,0.9)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:9, height:9, borderRadius:'50%', background:'#f87171' }} />
                        <span style={{ width:9, height:9, borderRadius:'50%', background:'#fbbf24' }} />
                        <span style={{ width:9, height:9, borderRadius:'50%', background:'#34d399' }} />
                        <span style={{ marginLeft:8, fontSize:12, color:'rgba(255,255,255,0.75)', fontFamily:'Syne,system-ui', fontWeight:700 }}>Мой Бот</span>
                        <span style={{ background:'rgba(62,207,142,0.15)', border:'1px solid rgba(62,207,142,0.3)', color:'#3ecf8e', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>● Опубликован</span>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ fontSize:11, color:'rgba(255,255,255,0.45)' }}>🔍 Тестировать</span>
                        <button style={{ background:'linear-gradient(135deg,#fbbf24,#f59e0b)', color:'#111', borderRadius:7, padding:'5px 11px', fontSize:11, fontWeight:700, border:'none' }}>Опубликовать</button>
                      </div>
                    </div>
                    {/* body */}
                    <div style={{ display:'grid', gridTemplateColumns:'38px 1fr 150px' }}>
                      {/* sidebar */}
                      <div style={{ borderRight:'1px solid rgba(255,255,255,0.07)', padding:'10px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                        <div style={{ width:14, height:14, background:'#ffd700', clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)', marginBottom:8 }} />
                        {[['⛓','Сценарий',true],['🧩','Блоки'],['🔌','Вход'],['⚙','Настройки'],['📊','Аналитика']].map(([icon,label,active]) => (
                          <div key={label} style={{ width:36, height:36, borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:active?'rgba(255,214,0,0.12)':'none', gap:2 }}>
                            <span style={{ fontSize:13 }}>{icon}</span>
                            <span style={{ fontSize:7, color:active?'#fbbf24':'rgba(255,255,255,0.4)', fontFamily:'Syne,system-ui' }}>{label}</span>
                          </div>
                        ))}
                      </div>
                      {/* canvas */}
                      <div style={{ padding:10, background:'#11121a', backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.035) 1px,transparent 1px)', backgroundSize:'16px 16px' }}>
                        {[['/start','Команда','⌨'],['Приветствие','Сообщение','💬'],['Меню','Кнопки','🔘']].map(([title,sub,icon],i) => (
                          <React.Fragment key={title}>
                            <div style={{ border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, padding:'6px 8px', width:110, background:'rgba(255,255,255,0.03)' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                                <span style={{ fontSize:10 }}>{icon}</span>
                                <span style={{ fontSize:10, fontWeight:600, color:'#e5e7eb', fontFamily:'Syne,system-ui' }}>{title}</span>
                              </div>
                              <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', paddingLeft:14 }}>{sub}</div>
                            </div>
                            {i < 2 && <div style={{ width:1, height:12, background:'rgba(255,255,255,0.18)', margin:'0 0 0 54px', position:'relative' }}><div style={{ position:'absolute', bottom:0, left:-3, borderLeft:'4px solid transparent', borderRight:'4px solid transparent', borderTop:'5px solid rgba(255,255,255,0.18)' }} /></div>}
                          </React.Fragment>
                        ))}
                        <div style={{ display:'flex', gap:6, marginTop:6, paddingLeft:6 }}>
                          {[['О нас','Сообщение','📝'],['Контакты','Контакты','📞']].map(([t,s,ic]) => (
                            <div key={t}>
                              <div style={{ width:1, height:12, background:'rgba(255,255,255,0.18)', margin:'0 auto 3px' }} />
                              <div style={{ border:'1px solid rgba(255,255,255,0.1)', borderRadius:7, padding:'5px 7px', width:80, background:'rgba(255,255,255,0.03)', opacity:.9 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:3, marginBottom:2 }}><span style={{ fontSize:9 }}>{ic}</span><span style={{ fontSize:9, fontWeight:600, color:'#e5e7eb', fontFamily:'Syne,system-ui' }}>{t}</span></div>
                                <div style={{ fontSize:7, color:'rgba(255,255,255,0.45)', paddingLeft:12 }}>{s}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* code */}
                      <div style={{ borderLeft:'1px solid rgba(255,255,255,0.07)', padding:'10px 8px', background:'#0c0d14', fontFamily:"'JetBrains Mono','Courier New',monospace", fontSize:9, lineHeight:1.65, overflowX:'hidden' }}>
                        <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', marginBottom:8, fontFamily:'Syne,system-ui' }}>Код сценария</div>
                        <div><span style={{ color:'#c678dd' }}>при</span> <span style={{ color:'#3ecf8e' }}>команде</span> <span style={{ color:'#61afef' }}>/start</span>:</div>
                        <div style={{ paddingLeft:8 }}><span style={{ color:'#3ecf8e' }}>  отправить</span> <span style={{ color:'#e5c07b' }}>"Привет! 👋</span></div>
                        <div style={{ paddingLeft:8 }}><span style={{ color:'#e5c07b' }}>  Я твой бот."</span></div>
                        <div style={{ paddingLeft:8 }}><span style={{ color:'#3ecf8e' }}>  показать</span> кнопки [</div>
                        <div style={{ paddingLeft:12 }}><span style={{ color:'#e5c07b' }}>"О нас"</span>, <span style={{ color:'#e5c07b' }}>"Контакты"</span> ]</div>
                        <div style={{ marginTop:6 }}><span style={{ color:'#e06c75' }}>при</span> <span style={{ color:'#3ecf8e' }}>нажатии</span> <span style={{ color:'#e5c07b' }}>"О нас"</span>:</div>
                        <div style={{ paddingLeft:8 }}><span style={{ color:'#3ecf8e' }}>  отправить</span> <span style={{ color:'#e5c07b' }}>"Мы команда</span></div>
                        <div style={{ paddingLeft:8 }}><span style={{ color:'#e5c07b' }}>  Cicada Studio."</span></div>
                        <div style={{ marginTop:6 }}><span style={{ color:'#e06c75' }}>при</span> <span style={{ color:'#3ecf8e' }}>нажатии</span> <span style={{ color:'#e5c07b' }}>"Контакты"</span>:</div>
                        <div style={{ paddingLeft:8 }}><span style={{ color:'#3ecf8e' }}>  отправить</span> <span style={{ color:'#61afef' }}>контакт</span> <span style={{ color:'#e5c07b' }}>@cicada</span></div>
                        <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                          <button style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)', padding:'5px', borderRadius:6, fontSize:9, cursor:'pointer' }}>Редактировать код</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>{/* end mock-neon-wrap */}
                  {/* glow under */}
                  <div style={{ position:'absolute', bottom:-50, left:'50%', transform:'translateX(-50%)', width:320, height:80, background:'radial-gradient(ellipse,rgba(99,40,240,0.4) 0%,rgba(59,130,246,0.2) 40%,transparent 70%)', pointerEvents:'none' }} />
                </div>
              )}
            </div>
          </div>

          <>
          {/* ── STATS ── */}
          <div style={{ padding: lp ? '24px 16px' : '32px 40px' }}>
            <div style={{ maxWidth:1220, margin:'0 auto', display:'grid', gridTemplateColumns: lp ? '1fr 1fr' : 'repeat(4,1fr)', gap:16 }}>
              {[
                { icon:'🟣', iconBg:'rgba(139,92,246,0.25)', iconBorder:'rgba(139,92,246,0.5)', num:'2 000+', label:'ботов создано' },
                { icon:'🕐', iconBg:'rgba(34,197,94,0.2)',   iconBorder:'rgba(34,197,94,0.45)',  num:'5 мин',   label:'среднее время запуска' },
                { icon:'📊', iconBg:'rgba(249,115,22,0.2)',  iconBorder:'rgba(249,115,22,0.45)', num:'24/7',    label:'стабильная работа' },
                { icon:'❤️', iconBg:'rgba(239,68,68,0.2)',   iconBorder:'rgba(239,68,68,0.45)',  num:'98%',     label:'довольных пользователей' },
              ].map(({ icon, iconBg, iconBorder, num, label }) => (
                <div key={num} className="stat-card">
                  <div style={{ width:48, height:48, borderRadius:12, background:iconBg, border:`1px solid ${iconBorder}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{icon}</div>
                  <div>
                    <div style={{ fontFamily:'Syne,system-ui', fontWeight:800, fontSize: lp ? 24 : 30, color:'#fff', lineHeight:1 }}>{num}</div>
                    <div style={{ fontSize: lp ? 11 : 12, color:'rgba(255,255,255,0.5)', marginTop:4 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── FEATURES ── */}
          <div style={{ maxWidth:1220, margin:'0 auto', padding: lp ? '48px 16px' : '72px 40px' }}>
            <div style={{ marginBottom:10, fontSize:11, fontWeight:700, color:'#fbbf24', textTransform:'uppercase', letterSpacing:'0.1em' }}>✦ Всё, что нужно</div>
            <h2 style={{ fontFamily:'Syne,system-ui', fontWeight:800, fontSize: lp ? 28 : 38, marginBottom:8, lineHeight:1.15 }}>Полный набор инструментов</h2>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize: lp ? 13 : 15, marginBottom:36, maxWidth:480 }}>Всё необходимое для создания, настройки и запуска Telegram-бота любой сложности.</p>
            <div style={{ display:'grid', gridTemplateColumns: lp ? '1fr 1fr' : 'repeat(5,1fr)', gap:12 }}>
              {[
                ['🟣','Визуальный конструктор','Собирай сценарии из блоков как конструктор','#8b5cf6'],
                ['🤖','AI-помощник','Опиши идею — и получи готовый сценарий','#3ecf8e'],
                ['🚀','Запуск в 1 клик','Публикуй бота и получай ссылку за секунды','#f97316'],
                ['🧩','Готовые модули','Библиотека блоков для любых задач','#60a5fa'],
                ['📈','Аналитика','Следи за статистикой и развивай своего бота','#fbbf24'],
              ].map(([icon,title,text,color]) => (
                <div key={title} className="lp-card" style={{ padding: lp ? '16px 14px' : '22px 18px' }}>
                  <div style={{ fontSize:24, marginBottom:12 }}>{icon}</div>
                  <div style={{ fontFamily:'Syne,system-ui', fontSize:13, fontWeight:700, color, marginBottom:6 }}>{title}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.55)', lineHeight:1.5 }}>{text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── HOW IT WORKS ── */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.012)', padding: lp ? '48px 16px' : '72px 40px' }}>
            <div style={{ maxWidth:1220, margin:'0 auto' }}>
              <div style={{ marginBottom:10, fontSize:11, fontWeight:700, color:'#fbbf24', textTransform:'uppercase', letterSpacing:'0.1em' }}>✦ Как это работает</div>
              <h2 style={{ fontFamily:'Syne,system-ui', fontWeight:800, fontSize: lp ? 28 : 38, marginBottom:40, lineHeight:1.15 }}>Запусти бота за 4 шага</h2>
              <div style={{ display:'grid', gridTemplateColumns: lp ? '1fr 1fr' : 'repeat(4,1fr)', gap: lp ? 20 : 0, position:'relative' }}>
                {!lp && <div style={{ position:'absolute', top:22, left:'8%', right:'8%', height:1, background:'linear-gradient(to right,transparent,rgba(255,255,255,0.08),rgba(255,255,255,0.08),transparent)' }} />}
                {[['1','Добавь блоки','Перетащи нужные блоки на холст. Начни с «Бот» и «Старт».'],['2','Соедини логику','Связывай блоки сценарием — код генерируется сам.'],['3','Протестируй','Запусти тест прямо в редакторе без публикации.'],['4','Опубликуй','Один клик — и бот живёт в Telegram.']].map(([num,title,text]) => (
                  <div key={num} style={{ padding: lp ? '0' : '0 24px', position:'relative', zIndex:1 }}>
                    <div className="lp-step-dot">{num}</div>
                    <div style={{ fontFamily:'Syne,system-ui', fontWeight:700, fontSize:15, marginBottom:8 }}>{title}</div>
                    <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── PRICING ── */}
          <div style={{ maxWidth:1220, margin:'0 auto', padding: lp ? '48px 16px' : '72px 40px' }}>
            <div style={{ marginBottom:10, fontSize:11, fontWeight:700, color:'#fbbf24', textTransform:'uppercase', letterSpacing:'0.1em' }}>✦ Тарифы</div>
            <h2 style={{ fontFamily:'Syne,system-ui', fontWeight:800, fontSize: lp ? 28 : 38, marginBottom:8, lineHeight:1.15 }}>Прозрачные цены</h2>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize: lp ? 13 : 15, marginBottom:40 }}>Начни бесплатно и масштабируйся по мере роста.</p>
            <div style={{ display:'grid', gridTemplateColumns: lp ? '1fr' : 'repeat(3,1fr)', gap:20 }}>
              {/* Free */}
              <div className="lp-price-card">
                <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Бесплатно</div>
                <div style={{ fontFamily:'Syne,system-ui', fontSize:38, fontWeight:800, marginBottom:4 }}>0₽<span style={{ fontSize:16, fontWeight:500, color:'rgba(255,255,255,0.5)' }}> /мес</span></div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:20 }}>Навсегда бесплатно</div>
                <div style={{ height:1, background:'rgba(255,255,255,0.08)', marginBottom:18 }} />
                {['1 проект','Визуальный конструктор','Базовые блоки','Экспорт bot.py'].map(f => <div key={f} style={{ display:'flex', alignItems:'center', fontSize:13, color:'rgba(255,255,255,0.7)', marginBottom:9 }}><span className="lp-check">✓</span>{f}</div>)}
                {['AI-помощник','Аналитика'].map(f => <div key={f} style={{ display:'flex', alignItems:'center', fontSize:13, color:'rgba(255,255,255,0.35)', marginBottom:9 }}><span className="lp-cross">✗</span>{f}</div>)}
                <button className="lp-btn-ghost" onClick={openRegister} style={{ width:'100%', marginTop:16, padding:'11px', borderRadius:9, fontSize:14 }}>Начать бесплатно</button>
              </div>
              {/* Pro */}
              <div className="lp-price-card featured" style={{ position:'relative' }}>
                <div style={{ position:'absolute', top:-13, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(135deg,#ffd700,#f59e0b)', color:'#111', fontSize:11, fontWeight:800, padding:'3px 14px', borderRadius:20, fontFamily:'Syne,system-ui', whiteSpace:'nowrap' }}>⭐ Популярный</div>
                <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Pro</div>
                <div style={{ fontFamily:'Syne,system-ui', fontSize:38, fontWeight:800, marginBottom:4 }}>{proMonthlyPrice}<span style={{ fontSize:16, fontWeight:500, color:'rgba(255,255,255,0.5)' }}> /мес</span></div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:20 }}>Биллинг ежемесячно</div>
                <div style={{ height:1, background:'rgba(255,255,255,0.08)', marginBottom:18 }} />
                {['До 10 проектов','Все блоки и модули','AI-помощник','Продвинутая аналитика','Приоритетная поддержка','Webhooks и интеграции'].map(f => <div key={f} style={{ display:'flex', alignItems:'center', fontSize:13, color:'rgba(255,255,255,0.7)', marginBottom:9 }}><span className="lp-check">✓</span>{f}</div>)}
                <button className="lp-btn-gold" onClick={openRegister} style={{ width:'100%', marginTop:16, padding:'11px', borderRadius:9, fontSize:14 }}>Выбрать Pro</button>
              </div>
              {/* Team */}
              <div className="lp-price-card">
                <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Команда</div>
                <div style={{ fontFamily:'Syne,system-ui', fontSize:38, fontWeight:800, marginBottom:4 }}>2490₽<span style={{ fontSize:16, fontWeight:500, color:'rgba(255,255,255,0.5)' }}> /мес</span></div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:20 }}>До 5 пользователей</div>
                <div style={{ height:1, background:'rgba(255,255,255,0.08)', marginBottom:18 }} />
                {['Неограниченно проектов','Командный доступ','AI-помощник без лимитов','White-label','SLA и dedicated поддержка','API-доступ'].map(f => <div key={f} style={{ display:'flex', alignItems:'center', fontSize:13, color:'rgba(255,255,255,0.7)', marginBottom:9 }}><span className="lp-check">✓</span>{f}</div>)}
                <button className="lp-btn-ghost" style={{ width:'100%', marginTop:16, padding:'11px', borderRadius:9, fontSize:14, cursor:'pointer' }}>Связаться с нами</button>
              </div>
            </div>
          </div>

          {/* ── CTA ── */}
          <div style={{ textAlign:'center', padding: lp ? '48px 16px' : '80px 40px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center,rgba(251,191,36,0.07) 0%,transparent 65%)', pointerEvents:'none' }} />
            <h2 style={{ fontFamily:'Syne,system-ui', fontWeight:800, fontSize: lp ? 30 : 44, marginBottom:14, position:'relative' }}>Готов запустить бота?</h2>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize: lp ? 14 : 16, marginBottom:32, position:'relative' }}>Присоединяйся к тысячам создателей и запусти своего бота за вечер.</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', position:'relative' }}>
              <button className="lp-btn-gold" onClick={openRegister} style={{ borderRadius:10, padding:'14px 28px', fontSize:15 }}>Начать бесплатно →</button>
              <button className="lp-btn-ghost" onClick={openLogin} style={{ padding:'14px 24px', fontSize:15, borderRadius:10 }}>Войти в аккаунт</button>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', padding: lp ? '24px 16px' : '32px 40px' }}>
            <div style={{ maxWidth:1220, margin:'0 auto', display:'flex', flexDirection: lp ? 'column' : 'row', alignItems: lp ? 'flex-start' : 'center', justifyContent:'space-between', gap: lp ? 16 : 0 }}>
              <div>
                <div style={{ fontFamily:'Syne,system-ui', fontSize:18, fontWeight:800, color:'#fff', marginBottom:4 }}>
                  <span style={{ color:'#ffd700' }}>◈</span> Cicada <span style={{ color:'rgba(255,255,255,0.4)', fontWeight:400, fontSize:13 }}>studio</span>
                </div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>© 2026 Cicada Studio. Все права защищены.</div>
              </div>
              <div style={{ display:'flex', gap: lp ? 16 : 28, flexWrap:'wrap' }}>
                {['Поддержка','Telegram'].map(l => (
                  <button key={l} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:13, cursor:'pointer', transition:'color .2s' }} onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.7)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.35)'}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          </>

        </div>
        {authModalNode}
      </div>
    );
  }

  return (
    <StoreProvider>
    <BuilderUiContext.Provider value={builderUiContextValue}>
    <GraphValidationProvider
      softStatus={graphValidationContextValue.softStatus}
      fullResult={graphValidationContextValue.fullResult}
      fullCheckBusy={graphValidationContextValue.fullCheckBusy}
      requestFullValidation={graphValidationContextValue.requestFullValidation}
      dismissFullOverlay={graphValidationContextValue.dismissFullOverlay}
      blockingOverlayActive={graphValidationContextValue.blockingOverlayActive}
      lastRepairResult={graphValidationContextValue.lastRepairResult}
      repairHighlight={graphValidationContextValue.repairHighlight}
      repairBusy={graphValidationContextValue.repairBusy}
      requestAutoRepair={graphValidationContextValue.requestAutoRepair}
      undoLastRepair={graphValidationContextValue.undoLastRepair}
      showRepairHighlights={graphValidationContextValue.showRepairHighlights}
    >
    <AddBlockContext.Provider value={addBlockFromContext}>
    <BlockInfoContext.Provider value={handleBlockInfoRequest}>
    <div className="editor-shell editor-shell--saas" data-editor-ui="saas">
      {/* Top bar */}
      <div className="editor-topbar editor-shell__topbar mc-editor-topbar">
        <div className="mc-editor-topbar__cluster editor-topbar__brand" style={{ flexShrink: isMobileView ? 1 : 0, minWidth: 0, display:'flex', alignItems:'center', gap: isMobileView ? 8 : 10 }}>
          <img src={cicadaLogo} alt="" className="editor-brand-logo" />
          <div style={{ display:'flex', alignItems:'baseline', lineHeight:1 }}>
            <span className="editor-brand-word">Cicada</span>
            {!isMobileView && <span className="editor-brand-suffix">Studio</span>}
          </div>
        </div>
        {/* Mobile Examples Button */}
        {isMobileView && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              ref={examplesToggleRef}
              type="button"
              data-tour="mobile-examples"
              title={builderUi.examplesOpen}
              onClick={() => setShowExamples(!showExamples)}
              style={{ width: 36, height: 34, display:'flex', alignItems:'center', justifyContent:'center', gap:2, background:'transparent', color:'var(--text3)', padding:0, border:'1px solid var(--border2)', borderRadius:10, fontSize:15, whiteSpace: 'nowrap', flexShrink: 0 }}
            >{builderUi.examplesOpen}</button>
          </div>
        )}
        {!isMobileView && <div className="tb-divider" />}
        {!isMobileView && currentUser && (
          <SaveStatusIndicator lang={uiLang} />
        )}
        {!isMobileView && <div className="tb-divider" />}
        {/* Desktop: secondary actions in overflow (primary bar = run + ···) */}
        {!isMobileView && (
          <div className="mc-editor-topbar__cluster mc-editor-topbar__legacy-tools">
            <div style={{ position: 'relative' }}>
              <button
                ref={examplesToggleRef}
                type="button"
                className="tb-btn tb-btn-ghost"
                data-tour="top-examples-desktop"
                onClick={() => setShowExamples(!showExamples)}
              >{builderUi.examplesOpen}</button>
            </div>
            <button
              className={`tb-btn tb-btn-ai${canUseAiGenerator ? '' : ' locked-premium'}`}
              data-tour="top-ai-desktop"
              title={canUseAiGenerator ? builderUi.aiTitle : builderUi.aiTitleDisabled}
              onClick={openAiGeneratorModal}
            >{canUseAiGenerator ? '✨ AI' : '🔒 AI'}</button>
            <button
              className="tb-btn tb-btn-danger"
              data-tour="top-clear-desktop"
              title={builderUi.clearCanvas}
              onClick={handleClearCanvas}
            >✕</button>
            <button
              type="button"
              className="tb-btn tb-btn-ghost"
              title={uiLang === 'en' ? 'Undo (Ctrl+Z)' : 'Отменить (Ctrl+Z)'}
              onClick={handleGraphUndo}
              disabled={!graphHistory.canUndo}
              aria-label={uiLang === 'en' ? 'Undo' : 'Отменить'}
            >↶</button>
            <button
              type="button"
              className="tb-btn tb-btn-ghost"
              title={uiLang === 'en' ? 'Redo (Ctrl+Y)' : 'Повторить (Ctrl+Y)'}
              onClick={handleGraphRedo}
              disabled={!graphHistory.canRedo}
              aria-label={uiLang === 'en' ? 'Redo' : 'Повторить'}
            >↷</button>
            <div className="tb-divider" />
            <div style={{ position: 'relative' }}>
            <button
              ref={filesMenuToggleRef}
              className="tb-btn tb-btn-ghost"
              data-tour="top-files-desktop"
              title={showFilesMenu ? undefined : builderUi.filesMenuTitle}
              aria-expanded={showFilesMenu}
              aria-haspopup="menu"
              onClick={() => setShowFilesMenu(v => !v)}
            >📁 <span style={{ opacity: 0.5, fontSize: 10 }}>▼</span></button>
            </div>
            <button
              className="tb-btn tb-btn-ghost"
              data-tour="bot-preview"
              title={builderUi.previewTitle}
              type="button"
              onClick={() => setPreviewPanelOpen((v) => !v)}
              style={previewPanelOpen ? { outline: '1px solid rgba(56,189,248,0.55)', borderRadius: 8 } : undefined}
            >💬</button>
            <button
              className="tb-btn tb-btn-ghost"
              data-tour="analytics-hub"
              title={uiLang === 'en' ? 'Analytics' : 'Аналитика'}
              type="button"
              onClick={() => setAnalyticsPanelOpen((v) => !v)}
              style={analyticsPanelOpen ? { outline: '1px solid rgba(99,102,241,0.45)', borderRadius: 8 } : undefined}
            >📊</button>
            <button
              className="tb-btn tb-btn-ghost"
              data-tour="top-debug-desktop"
              title={builderUi.debugTitle}
              type="button"
              onClick={() => setBotDebugOpen(v => !v)}
              style={botDebugOpen ? { outline: '1px solid rgba(250,204,21,0.45)', borderRadius: 8 } : undefined}
            >🧾</button>
            <div className="tb-divider" />
            {isProjectMode && (
              <div
                title={builderUi.projectFilesNote}
                style={{
                  fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 8,
                  color: '#3ecf8e', background: 'rgba(62,207,142,0.1)',
                  border: '1px solid rgba(62,207,142,0.25)', maxWidth: 180,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {builderUi.projectBadge(projectName.trim() || '…')}
              </div>
            )}
          </div>
        )}
        {!isMobileView && currentUser && (
          <div className="mc-editor-topbar__cluster">
            <EditorOverflowMenu lang={uiLang}>
              <EditorOverflowItem onSelect={() => setShowExamples(true)}>
                {builderUi.examplesOpen}
              </EditorOverflowItem>
              <EditorOverflowItem onSelect={openAiGeneratorModal}>
                {canUseAiGenerator ? `✨ ${builderUi.aiTitle}` : `🔒 ${builderUi.aiTitleDisabled}`}
              </EditorOverflowItem>
              <EditorOverflowItem onSelect={handleClearCanvas}>
                {builderUi.clearCanvas}
              </EditorOverflowItem>
              <EditorOverflowSeparator />
              <EditorOverflowItem onSelect={handleGraphUndo} disabled={!graphHistory.canUndo}>
                {uiLang === 'en' ? 'Undo' : 'Отменить'}
              </EditorOverflowItem>
              <EditorOverflowItem onSelect={handleGraphRedo} disabled={!graphHistory.canRedo}>
                {uiLang === 'en' ? 'Redo' : 'Повторить'}
              </EditorOverflowItem>
              <EditorOverflowSeparator />
              <EditorOverflowItem onSelect={() => setShowFilesMenu(true)}>
                {builderUi.filesMenuTitle}
              </EditorOverflowItem>
              <EditorOverflowItem onSelect={() => setPreviewPanelOpen(true)}>
                {builderUi.previewTitle}
              </EditorOverflowItem>
              <EditorOverflowItem onSelect={() => setBotDebugOpen(true)}>
                {builderUi.debugTitle}
              </EditorOverflowItem>
              <EditorOverflowSeparator />
              <EditorOverflowItem onSelect={() => setShowInstructions(true)}>
                {uiLang === 'en' ? 'Help' : 'Справка'}
              </EditorOverflowItem>
            </EditorOverflowMenu>
          </div>
        )}
        {!isMobileView && (
          <div className="mc-editor-topbar__cluster mc-editor-topbar__cluster--primary">
            {!isSandboxRunning ? (
              <>
                <button
                  className="tb-btn tb-btn-run"
                  data-tour="run-desktop"
                  onClick={startBot}
                  disabled={
                    isStartingSandbox
                    || !graphHasRunnableBot(graph, currentUser)
                  }
                  title={
                    !graphHasBotBlock(graph)
                      ? builderUi.addBotTokenTitle
                      : !graphHasRunnableBot(graph, currentUser)
                        ? builderUi.needBotToken
                        : builderUi.start
                  }
                >{builderUi.start}</button>
                {isServerRunning && (
                  <span style={{ fontSize:10, color:'#38bdf8', fontFamily:'var(--mono)' }} title={builderUi.serverRunningParallel}>
                    ☁ {builderUi.serverRunning}
                  </span>
                )}
              </>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(62,207,142,0.08)', border:'1px solid rgba(62,207,142,0.2)', borderRadius:8, padding:'5px 10px' }}>
                  <div style={{
                    width:7, height:7, borderRadius:'50%', background:'#3ecf8e',
                    boxShadow:'0 0 7px #3ecf8e',
                    animation:'botPulse 1.5s ease-in-out infinite',
                    flexShrink:0,
                  }} />
                  <span style={{ fontSize:11, color:'#3ecf8e', fontFamily:'var(--mono)', letterSpacing:'0.02em' }}>
                    {sandboxSecondsLeft !== null
                      ? builderUi.autoStop(Math.floor(sandboxSecondsLeft/60), String(sandboxSecondsLeft%60).padStart(2,'0'))
                      : builderUi.running}
                  </span>
                </div>
                <button
                  type="button"
                  className="tb-btn tb-btn-stop"
                  data-tour="run-desktop"
                  disabled={isStoppingSandbox}
                  onClick={stopSandboxBot}
                >{isStoppingSandbox ? '…' : builderUi.stop}</button>
              </div>
            )}
          </div>
        )}

        {currentUser ? (
          <div className="mc-editor-topbar__cluster mc-editor-topbar__cluster--end">
            <div style={{ flex:1, minWidth: 8 }} />
            {isAdmin ? (
              <TopBarAdminButton
                isMobileView={isMobileView}
                onClick={() => openAdminMenu()}
              />
            ) : isMobileView ? (
              <button
                type="button"
                onClick={openAiGeneratorModal}
                data-tour="mobile-ai"
                title={canUseAiGenerator ? builderUi.aiTitle : builderUi.aiTitleDisabled}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 38,
                  height: 34,
                  padding: 0,
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(251,146,60,0.12) 100%)',
                  border: '1px solid rgba(251,191,36,0.45)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fde68a',
                  fontFamily: 'Syne, system-ui',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 0 12px rgba(251,191,36,0.12)',
                  opacity: canUseAiGenerator ? 1 : 0.65,
                  filter: canUseAiGenerator ? undefined : 'saturate(0.6)',
                }}
              >{canUseAiGenerator ? 'AI' : '🔒'}</button>
            ) : (
              <button
                onClick={openPremiumPurchase}
                data-tour="top-premium-desktop"
                title="Premium"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(220,38,38,0.08))',
                  border: '1px solid rgba(249,115,22,0.35)',
                  borderRadius: 20, cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(249,115,22,0.22), rgba(220,38,38,0.14))'; e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.boxShadow = '0 0 16px rgba(249,115,22,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(220,38,38,0.08))'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ fontSize: 11 }}>★</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316', fontFamily: 'Syne, system-ui', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                  Premium
                </span>
              </button>
            )}
            {isAdmin && (
              <>
                {adminOpenSupportCount > 0 && (
                  <button
                    type="button"
                    onClick={() => openAdminMenu('support')}
                    title={`Новые обращения: ${adminOpenSupportCount}`}
                    style={{
                      position: 'relative',
                      width: isMobileView ? 34 : 38,
                      height: isMobileView ? 34 : 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      border: '1px solid rgba(248,113,113,0.45)',
                      background: 'rgba(248,113,113,0.1)',
                      color: '#fecaca',
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: '0 0 18px rgba(248,113,113,0.2)',
                    }}
                  >
                    🔔
                    <span style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 17,
                      height: 17,
                      padding: '0 5px',
                      borderRadius: 999,
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.55)',
                    }}>{adminOpenSupportCount > 99 ? '99+' : adminOpenSupportCount}</span>
                  </button>
                )}
              </>
            )}
            {userSupportUnreadCount > 0 && (
              <button
                type="button"
                onClick={openSupportModal}
                title={`Ответы поддержки: ${userSupportUnreadCount}`}
                style={{
                  position: 'relative',
                  width: isMobileView ? 34 : 38,
                  height: isMobileView ? 34 : 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  border: '1px solid rgba(62,207,142,0.5)',
                  background: 'rgba(62,207,142,0.1)',
                  color: '#bbf7d0',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 0 18px rgba(62,207,142,0.22)',
                }}
              >
                🔔
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 17,
                  height: 17,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: '#10b981',
                  color: '#04130d',
                  fontSize: 10,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.55)',
                }}>{userSupportUnreadCount > 99 ? '99+' : userSupportUnreadCount}</span>
              </button>
            )}
            {/* User button */}
            <button
              data-tour="profile-button"
              onClick={openProfileModal}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--bg3)', padding: isMobileView ? 3 : '6px 14px', borderRadius: 20,
                border: '1px solid var(--border2)', cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#f97316'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #f97316, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#1a1a1a', flexShrink: 0,
                overflow: 'hidden',
              }}>
                {currentUser.photo_url
                  ? <img src={currentUser.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : currentUser.name[0].toUpperCase()
                }
              </div>
              {!isMobileView && <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{currentUser.name}</span>}
            </button>
          </div>
        ) : (
          <div className="mc-editor-topbar__cluster mc-editor-topbar__cluster--end">
            <div style={{ flex:1 }} />
            <button
              onClick={() => { setAuthTab('login'); setShowAuthModal(true); }}
              style={{
                background: 'linear-gradient(135deg, #f97316, #dc2626)',
                color: '#fff', padding: isMobileView ? '7px 14px' : '8px 20px', borderRadius: 8,
                fontSize: isMobileView ? 12 : 13,
                fontWeight: 700, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(249,115,22,0.4)', whiteSpace: 'nowrap',
              }}
            >Войти</button>
          </div>
        )}
        {isMobileView && (
          <div style={{ position: 'relative', flexShrink: 0, marginLeft: 4 }}>
            <button
              type="button"
              data-tour="mobile-more"
              onClick={() => setMobileMoreOpen(v => !v)}
              style={{
                background: mobileMoreOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text3)', width: 36, height: 34, padding: 0,
                border: '1px solid var(--border2)', borderRadius: 8, fontSize: 16,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >⋯</button>
          </div>
        )}
      </div>

      {/* Instructions Modal */}

      {showLibrary && (
        <ModuleLibraryModal
          t={builderUi}
          lang={uiLang}
          currentUser={currentUser}
          onUpgrade={() => { setShowLibrary(false); openPremiumPurchase(); }}
          onClose={() => setShowLibrary(false)}
          onComposeGraph={(payload) => {
            handleComposeGraphModules(payload);
            setShowLibrary(false);
          }}
        />
      )}
      <AiFlowStudio
        open={aiStudioOpen}
        onClose={() => {
          useAiFlowStore.getState().patch({ studioOpen: false });
          setShowAIModal(false);
        }}
        onApplyStacks={applyAiGeneratedStacks}
        canUseAi={canUseAiGenerator}
        onUpgrade={openPremiumPurchase}
        lang={uiLang}
      />

      {showInstructions && (
          <InstructionsModal lang={uiLang} onClose={() => setShowInstructions(false)} />
        )}


      
      {showFilesMenu && typeof document !== 'undefined' && filesMenuRect && createPortal(
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, zIndex: 10050 }}
            onClick={() => setShowFilesMenu(false)}
          />
          <div
            role="menu"
            className="tb-files-menu"
            style={{
              position: 'fixed',
              top: filesMenuRect.top,
              left: filesMenuRect.left,
              minWidth: filesMenuRect.minWidth,
              zIndex: 10051,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tb-files-menu-item"
              onClick={async () => {
                setShowFilesMenu(false);
                await saveProject();
              }}
            >
              <span style={{ color: '#3ecf8e' }}>💾</span> {currentUser ? builderUi.saveCloud : builderUi.saveFile}
            </button>
            <button
              type="button"
              className="tb-files-menu-item"
              onClick={() => {
                try {
                  exportProjectToFile(graph.getGraphDocument());
                  showToast('Файл экспортирован', 'info');
                } catch (e) {
                  showToast(e?.message || 'Не удалось экспортировать файл', 'error');
                }
                setShowFilesMenu(false);
              }}
            >
              <span style={{ color: '#94a3b8' }}>⬇</span> {builderUi.exportFile}
            </button>
            <button type="button" className="tb-files-menu-item" onClick={() => { loadProject(); setShowFilesMenu(false); }}>
              <span style={{ color: '#60a5fa' }}>📂</span> {builderUi.loadFile}
            </button>
          </div>
        </>,
        document.body,
      )}
      {showExamples && typeof document !== 'undefined' && createPortal(
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, zIndex: 10050 }}
            onClick={() => setShowExamples(false)}
          />
          <div
            role="menu"
            style={{
              position: 'fixed',
              top: examplesMenuRect?.top ?? 68,
              left: examplesMenuRect?.left ?? 12,
              minWidth: examplesMenuRect?.minWidth ?? 200,
              zIndex: 10051,
              background: 'var(--bg2)',
              border: `1px solid ${isMobileView ? 'var(--border)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              ['echo', builderUi.examplesEcho],
              ['weather', builderUi.examplesWeather],
              ['shop', builderUi.examplesShop],
              ['keyboards', builderUi.examplesKeyboards],
              ['fsm', builderUi.examplesFsm],
              ['callbacks', builderUi.examplesCallbacks],
              ['media', builderUi.examplesMedia],
              ['full', builderUi.examplesFull],
              ['fullTest', builderUi.examplesFullTest],
            ].map(([key, label], i, arr) => (
              <button
                key={key}
                type="button"
                onClick={() => { loadExampleFromFile(key); setShowExamples(false); }}
                style={{
                  width: '100%',
                  padding: isMobileView ? '14px 18px' : '11px 16px',
                  textAlign: 'left',
                  background: 'transparent',
                  color: 'var(--text)',
                  border: 'none',
                  borderBottom: i < arr.length - 1 ? (isMobileView ? '1px solid var(--border)' : '1px solid rgba(255,255,255,0.07)') : 'none',
                  cursor: 'pointer',
                  fontSize: isMobileView ? 14 : 13,
                  fontFamily: isMobileView ? 'inherit' : 'Syne,system-ui',
                  display: 'block',
                }}
              >{label}</button>
            ))}
            {isMobileView && (
              <button
                type="button"
                onClick={() => { setShowLibrary(true); setShowExamples(false); }}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  textAlign: 'left',
                  background: 'transparent',
                  color: '#ffd700',
                  border: 'none',
                  borderTop: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'block',
                  fontWeight: 700,
                }}
              >{builderUi.moduleLibrary}</button>
            )}
            {isMobileView && (
              <button
                type="button"
                onClick={() => { openEsphomeConstructor(); setShowExamples(false); }}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  textAlign: 'left',
                  background: 'transparent',
                  color: '#4ade80',
                  border: 'none',
                  borderTop: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'block',
                  fontWeight: 700,
                }}
              >{builderUi.espHome}</button>
            )}
          </div>
        </>,
        document.body,
      )}

      {mobileMoreOpen && isMobileView && typeof document !== 'undefined' && createPortal(
        <>
          <div
            role="presentation"
            style={{ position: 'fixed', inset: 0, zIndex: 10052 }}
            onClick={() => setMobileMoreOpen(false)}
          />
          <div
            role="menu"
            style={{
              position: 'fixed',
              top: 58,
              right: 8,
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              zIndex: 10053,
              minWidth: 220,
              boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
              overflow: 'hidden',
              padding: '6px 0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {isAdmin && adminOpenSupportCount > 0 && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { openAdminMenu('support'); setMobileMoreOpen(false); }}
                  style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'rgba(248,113,113,0.08)', color:'#fecaca', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', display:'flex', alignItems:'center', gap:8, fontWeight:800 }}
                >🔔 Обращения: {adminOpenSupportCount}</button>
                <div style={{ height:1, background:'var(--border)', margin:'4px 0' }} />
              </>
            )}
            {userSupportUnreadCount > 0 && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { openSupportModal(); setMobileMoreOpen(false); }}
                  style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'rgba(62,207,142,0.08)', color:'#bbf7d0', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', display:'flex', alignItems:'center', gap:8, fontWeight:800 }}
                >🔔 Ответы поддержки: {userSupportUnreadCount}</button>
                <div style={{ height:1, background:'var(--border)', margin:'4px 0' }} />
              </>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => { handleClearCanvas(); setMobileMoreOpen(false); }}
              style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'transparent', color:'#f87171', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', display:'flex', alignItems:'center', gap:8 }}
            >✕ {builderUi.clearCanvas}</button>
            <button
              type="button"
              role="menuitem"
              onClick={async () => { setMobileMoreOpen(false); await saveProject(); }}
              style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'transparent', color:'#3ecf8e', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', display:'flex', alignItems:'center', gap:8 }}
            >💾 {currentUser ? builderUi.saveCloud : builderUi.saveFile}</button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                try {
                  exportProjectToFile(graph.getGraphDocument());
                  showToast('Файл экспортирован', 'info');
                } catch (e) {
                  showToast(e?.message || 'Не удалось экспортировать файл', 'error');
                }
                setMobileMoreOpen(false);
              }}
              style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'transparent', color:'#94a3b8', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', display:'flex', alignItems:'center', gap:8 }}
            >⬇ {builderUi.exportFile}</button>
            <div style={{ height:1, background:'var(--border)', margin:'4px 0' }} />
            <button
              type="button"
              role="menuitem"
              data-tour="bot-preview"
              onClick={() => {
                setPreviewPanelOpen((v) => !v);
                setMobileMoreOpen(false);
              }}
              style={{
                width:'100%', padding:'10px 16px', textAlign:'left',
                background: previewPanelOpen ? 'rgba(56,189,248,0.12)' : 'transparent',
                color:'#38bdf8', border:'none', cursor:'pointer', fontSize:13,
                fontFamily:'Syne,system-ui', display:'flex', alignItems:'center', gap:8,
                fontWeight: previewPanelOpen ? 700 : 400,
              }}
            >{builderUi.mobileMenuPreview}</button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setBotDebugOpen(v => !v); setMobileMoreOpen(false); }}
              style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'transparent', color:'#fde047', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', display:'flex', alignItems:'center', gap:8 }}
            >{builderUi.mobileMenuDebug}</button>
            {isSandboxRunning ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => { stopSandboxBot(); setMobileMoreOpen(false); }}
                style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'rgba(239,68,68,0.08)', color:'#f87171', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', fontWeight:700, display:'flex', alignItems:'center', gap:8 }}
              >{builderUi.mobileStopBot}</button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => { startBot(); setMobileMoreOpen(false); }}
                disabled={
                  isStartingSandbox
                  || !graphHasRunnableBot(graph, currentUser)
                }
                style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'rgba(62,207,142,0.08)', color:'#3ecf8e', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', fontWeight:700, display:'flex', alignItems:'center', gap:8, opacity: graphHasRunnableBot(graph, currentUser) ? 1 : 0.4 }}
              >{builderUi.mobileStartBot}</button>
            )}
            {isProjectMode && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { setProfileInitialTab('projects'); setShowProfileModal(true); setMobileMoreOpen(false); }}
                disabled={
                  !hasActiveProSubscription
                  || !graphHasRunnableBot(graph, currentUser)
                }
                style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'rgba(56,189,248,0.08)', color:'#38bdf8', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', fontWeight:700, display:'flex', alignItems:'center', gap:8, opacity: hasActiveProSubscription && graphHasRunnableBot(graph, currentUser) ? 1 : 0.45 }}
              >☁ {builderUi.projectStartServer} · Проекты</button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => { openEsphomeConstructor(); setMobileMoreOpen(false); }}
              style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'transparent', color:'#4ade80', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', display:'flex', alignItems:'center', gap:8, fontWeight:700 }}
            >{builderUi.espHome}</button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setShowInstructions(true); setMobileMoreOpen(false); }}
              style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'transparent', color:'var(--text2)', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Syne,system-ui', display:'flex', alignItems:'center', gap:8 }}
            >{builderUi.mobileInstructions}</button>
          </div>
        </>,
        document.body,
      )}

      <GlobalLoading
        open={Boolean(aiGlobalLoading)}
        label={uiLang === 'en' ? 'Generating flow…' : uiLang === 'uk' ? 'Генеруємо сценарій…' : 'Генерируем сценарий…'}
      />

      <ProductWelcome
        open={showProductWelcome && Boolean(currentUser)}
        onClose={() => setShowProductWelcome(false)}
        onStartTour={() => {
          setShowProductWelcome(false);
          setTourStep(0);
          setTourActive(true);
        }}
        lang={uiLang}
        storageKey={productWelcomeKey}
      />

      {currentUser ? (
        <AppLayoutProvider
          isMobile={isMobileView}
          section={appSection}
          setSection={setAppSection}
          mobileZone={mobileZone}
          setMobileZone={setMobileZone}
          listSearch={listSearch}
          setListSearch={setListSearch}
          listFilter={listFilter}
          setListFilter={setListFilter}
        >
        <EditorUxLayer
          enabled={isCanvasSection(appSection)}
          lang={uiLang}
          graphHistory={graphHistory}
          canvasUxRef={canvasUxRef}
          onUndo={handleGraphUndo}
          onRedo={handleGraphRedo}
          onSave={() => { void persistProjectToCloud(); }}
          onToggleFocus={() => window.dispatchEvent(new Event('cicada:toggle-focus'))}
          onOpenHelp={() => window.dispatchEvent(new Event('cicada:open-keyboard-help'))}
          onToggleHistory={handleToggleHistory}
          onAddMessage={handleQuickAddMessage}
          onAddCondition={handleQuickAddCondition}
          onTestFlow={() => { void handleTestFlow(activeProjectId); }}
          onDuplicateSelection={handleDuplicateSelectionUx}
          onDeleteSelection={handleDeleteSelectionUx}
          onGroupSelection={handleGroupSelectionUx}
          setAppSection={setAppSection}
        >
        <EditorKeyboardShortcuts
          enabled={isCanvasSection(appSection)}
          lang={uiLang}
          onUndo={handleGraphUndo}
          onRedo={handleGraphRedo}
          onSave={() => { void persistProjectToCloud(); }}
          onClosePanels={handleEditorClosePanels}
        />
        <EditorShell
          lang={uiLang}
          canvasControls={null}
          left={(
            <LeftPanel
              lang={uiLang}
              sectionListItems={controlPanelSectionLists}
              activeListId={(appSection === 'flows' || appSection === 'automations') ? activeProjectId : null}
              navCounts={sidebarNavCounts}
              onOpenAnalytics={() => setAnalyticsPanelOpen(true)}
              onSelectListItem={handleControlPanelSelectItem}
              onCreateFlow={handleCreateFlow}
              onBulkDelete={handleBulkDeleteFlows}
              onDuplicateFlow={handleDuplicateFlow}
              onTestFlow={handleTestFlow}
              onExportFlow={handleExportFlow}
              onArchiveFlow={handleArchiveFlow}
              onApplyTemplate={handleApplyFlowTemplate}
              onOpenAi={openAiGeneratorModal}
              onOpenModuleLibrary={() => setShowLibrary(true)}
              onOpenEsphome={() => openEsphomeConstructor({
                projectId: activeProjectId,
                projectName: projectName.trim() || undefined,
              })}
              onGoToAutomation={() => {
                setAppSection('flows');
                setMobileZone('canvas');
              }}
              activeFlowName={projectName.trim() || flowListItems.find((f) => f.id === activeProjectId)?.name || ''}
              listLoading={projectsLoading && (appSection === 'flows' || appSection === 'automations')}
              palette={(
                <Sidebar
                  onDragStart={handlePaletteDragStart}
                  onDragEnd={endPaletteDrag}
                  onTapAdd={isMobileView ? addBlockFromPaletteTap : null}
                />
              )}
            />
          )}
          center={isCanvasSection(appSection) ? (
            <FlowEditorCenter
              canvasRef={canvasRef}
              canvasUxRef={canvasUxRef}
              graphCanvasActions={graphCanvasActions}
              uiLang={uiLang}
              graphHistory={graphHistory}
              flowLayoutMode={flowLayoutMode}
              handleGraphUndo={handleGraphUndo}
              handleGraphRedo={handleGraphRedo}
              handleFlowLayoutModeChange={handleFlowLayoutModeChange}
              applyCanvasLayout={applyCanvasLayout}
              handleSelectNode={handleSelectNode}
              handleInspectNode={handleInspectNode}
              handleConnectFeedback={handleConnectFeedback}
              handleCanvasDrop={handleCanvasDrop}
              handleInsertNodeOnEdge={handleInsertNodeOnEdge}
              handleRequestDeleteNodes={handleRequestDeleteNodes}
              graph={graph}
              graphRevision={graphRevision}
              handleHighlightCompileNodes={handleHighlightCompileNodes}
              handleFitAllCanvasNodes={handleFitAllCanvasNodes}
              handleResetCorruptedGraph={handleResetCorruptedGraph}
              guidedCanvasActions={guidedCanvasActions}
              mobileZone={mobileZone}
              showCanvasOnboarding={showCanvasOnboarding}
              canUseAiGenerator={canUseAiGenerator}
              handleApplyFlowTemplate={handleApplyFlowTemplate}
              openAiGeneratorModal={openAiGeneratorModal}
              setTourStep={setTourStep}
              setTourActive={setTourActive}
              aiGlobalLoading={aiGlobalLoading}
            />
          ) : (
            <CenterPanel>
              <EmptyState
                icon="⚡"
                title={uiLang === 'en' ? 'Build on the canvas' : 'Сборка на холсте'}
                hint={uiLang === 'en'
                  ? 'Open Flows or Templates in the sidebar to edit your bot.'
                  : 'Откройте «Сценарии» или «Шаблоны» в боковой панели.'}
                actions={(
                  <button
                    type="button"
                    className="ds-btn ds-btn--primary ds-btn--sm"
                    onClick={() => setAppSection('flows')}
                  >
                    {uiLang === 'en' ? 'Open flows' : 'Открыть сценарии'}
                  </button>
                )}
              />
            </CenterPanel>
          )}
          right={isCanvasSection(appSection) ? (
            <RightInspectorPanel
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              canSeeCode={canSeeCode}
              onLockedCodeTab={openPremiumPurchase}
              lang={uiLang}
              block={selectedBlock}
              nodeId={selectedBlockId}
              graph={graph}
              graphRevision={graphRevision}
              blockTypes={builderBlockTypes}
              flowName={projectName}
              nodeCount={graphNodeCount}
              onChange={handlePropChange}
              onKeyboardDataChange={handleKeyboardDataChange}
              onAddAttachment={(kind) => handleAddFooterAction(selectedBlock?.id, kind)}
              onAttachmentChange={handleAttachmentChange}
              onAttachmentDelete={handleAttachmentDelete}
              graphRefIndex={graphRefIndex}
              graphDocument={graph.getGraphDocument()}
              onJumpToNode={(nodeId) => nodeId && handleHighlightCompileNodes([nodeId])}
              onDeleteNode={handleRequestDeleteNode}
              onDuplicateNode={handleDuplicateNode}
              onConvertNode={() => showToast(
                uiLang === 'en'
                  ? 'Replace the step from Templates or add a new block on canvas.'
                  : 'Замените шаг из «Шаблонов» или добавьте новый блок на холсте.',
                'info',
              )}
              onValidationToast={showToast}
              showToast={showToast}
              onFocusCanvas={() => setMobileZone('canvas')}
              onCreateCallbackHandler={(ref) => {
                const doc = graph.getGraphDocument();
                const compileValue = String(ref?.compileValue || '').trim()
                  || generateCallbackId(ref?.displayLabel || 'button');
                const enriched = { ...ref, compileValue };
                const result = createCallbackHandlerForReference(
                  doc,
                  enriched,
                  { blockTypes: builderBlockTypes },
                );
                if (!result.modified) {
                  showToast(uiLang === 'en' ? 'Could not create handler' : 'Не удалось создать обработчик', 'error');
                  return;
                }
                for (const op of result.operations || []) {
                  graph.dispatch(op.type, op.payload, op.meta);
                }
                const kbId = enriched.ownerNodeId;
                const buttonId = enriched.attachmentId;
                if (kbId && buttonId && result.handlerNodeId) {
                  const linked = linkKeyboardButtonToHandler(
                    graph.getGraphDocument(),
                    kbId,
                    buttonId,
                    result.handlerNodeId,
                    { graphRefId: enriched.id, callbackId: compileValue },
                  );
                  for (const op of linked.operations || []) {
                    graph.dispatch(op.type, op.payload, op.meta);
                  }
                }
                if (result.handlerNodeId) setSelectedBlockId(result.handlerNodeId);
                showToast(uiLang === 'en' ? 'Handler created and linked' : 'Обработчик создан и привязан', 'success');
              }}
              projectId={activeProjectId || ''}
              isProjectMode={isProjectMode}
              hasActiveProSubscription={hasActiveProSubscription}
              codePane={(
                <PythonPane
                  getGraphDocument={graph.getGraphDocument}
                  graphRevision={graphRevision}
                  isMobile={isMobileView}
                  onClose={undefined}
                />
              )}
              lockedCodePane={(
                <PremiumLockedPanel
                  title="Код сценария доступен в Pro"
                  text="Нажми, чтобы открыть меню покупки Premium."
                  isMobile={isMobileView}
                  onUpgrade={openPremiumPurchase}
                />
              )}
              simulatorProps={useInspectorSimulator ? {
                isMobileView,
                generateCodegenSnapshot: generateBotPythonSnapshot,
                getGraphDocument: () => graph.getGraphDocument(),
                graphPalette,
                paletteOptions: { lang: uiLang, blockTypes: builderBlockTypes },
                onHighlightNodes: (ids) => handleTraceHighlightChange({ active: ids }),
                onTraceId: (id) => {
                  if (id) {
                    setDebugTraceId(id);
                    setDebugTraceOpen(true);
                  }
                },
                onDebugSnapshot: setDebugCodegenSnapshot,
                botName: projectName || 'Test Bot',
                flowId: analyticsFlowId,
              } : null}
              onUndockSimulator={() => {
                setSimulatorDocked(false);
                setPreviewPanelOpen(true);
              }}
            />
          ) : (
            <RightInspectorPanel
              tab="props"
              onTabChange={() => {}}
              lang={uiLang}
              inspector={(
                <EmptyState
                  icon="📋"
                  title={uiLang === 'en' ? 'Nothing selected' : 'Ничего не выбрано'}
                  hint={uiLang === 'en'
                    ? 'Pick an item from the left list to configure it.'
                    : 'Выберите элемент в списке слева для настройки.'}
                />
              )}
            />
          )}
          mobileNav={isMobileView ? (
            <MobileZoneNav
              labels={{
                canvas: builderUi.mobileTabCanvas,
                list: builderUi.mobileTabBlocks,
                inspector: builderUi.mobileTabProps,
              }}
              runSlot={(() => {
                const _canRun = graphHasRunnableBot(graph, currentUser);
                return (
                  <button
                    data-tour="mobile-run"
                    type="button"
                    onClick={isSandboxRunning ? stopSandboxBot : (_canRun ? startBot : undefined)}
                    disabled={!isSandboxRunning && !_canRun}
                    title={
                      !isSandboxRunning && !_canRun
                        ? (!graphHasBotBlock(graph) ? builderUi.addBotTokenTitle : builderUi.needBotToken)
                        : ''
                    }
                    style={{
                      width: 70, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 1,
                      background: isSandboxRunning
                        ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                        : _canRun ? 'linear-gradient(135deg,#f97316,#dc2626)' : 'rgba(45,55,72,0.6)',
                      border: 'none', cursor: (!isSandboxRunning && !_canRun) ? 'not-allowed' : 'pointer',
                      borderTop: `2px solid ${isSandboxRunning ? '#ef4444' : _canRun ? '#f97316' : 'transparent'}`,
                      borderLeft: '1px solid rgba(99,102,241,0.2)',
                      flexShrink: 0, position: 'relative', overflow: 'hidden',
                      opacity: (!isSandboxRunning && !_canRun) ? 0.4 : 1,
                      transition: 'all 0.2s',
                      boxShadow: (_canRun || isSandboxRunning) ? '0 0 20px rgba(249,115,22,0.3)' : 'none',
                    }}
                  >
                    {isSandboxRunning && sandboxSecondsLeft !== null && (
                      <div style={{
                        position:'absolute', bottom:0, left:0, height:2,
                        background:'rgba(255,255,255,0.45)',
                        width:`${(sandboxSecondsLeft/300)*100}%`,
                        transition:'width 1s linear',
                      }} />
                    )}
                    <span style={{ fontSize: 18 }}>{isSandboxRunning ? '■' : '▶'}</span>
                    <span style={{ fontSize: 9, color: '#fff', fontFamily: 'Syne, system-ui', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {isSandboxRunning ? builderUi.mobileStop : builderUi.mobileRun}
                    </span>
                    {isSandboxRunning && sandboxSecondsLeft !== null && (
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--mono)' }}>
                        {Math.floor(sandboxSecondsLeft/60)}:{String(sandboxSecondsLeft%60).padStart(2,'0')}
                      </span>
                    )}
                  </button>
                );
              })()}
            />
          ) : null}
        />
        </EditorUxLayer>
        </AppLayoutProvider>
      ) : (
        /* Non-logged-in: just show auth modal, empty background */
        <div style={{
          background: 'linear-gradient(160deg, #06030f 0%, #0a0518 50%, #080615 100%)',
        }} />
      )}

      {/* Onboarding tour (first login, desktop + mobile) */}
      {tourActive && currentUser && onboardingSteps.length > 0 && (
        <OnboardingTour
          steps={onboardingSteps}
          stepIndex={tourStep}
          labels={builderUi}
          onPrev={() => setTourStep(s => Math.max(0, s - 1))}
          onNext={() => {
            if (tourStep >= onboardingSteps.length - 1) finishTour();
            else setTourStep(s => Math.min(onboardingSteps.length - 1, s + 1));
          }}
          onSkip={finishTour}
        />
      )}

      {/* Auth Modal */}
      {authModalNode}

      {/* Profile Modal */}
      {showProfileModal && currentUser && (
        <ProfileModal
          user={currentUser}
          projects={userProjects}
          initialTab={profileInitialTab}
          onClose={() => setShowProfileModal(false)}
          onLogout={async () => {
            await clearSession();
            setCurrentUser(null);
            setUserProjects([]);
            setShowProfileModal(false);
            setAuthTab('login');
            setShowAuthModal(true);
          }}
          onUpdateUser={async (updates) => {
            try {
              const { _silent, ...serverUpdates } = updates;
              const updated = await updateUser(currentUser.id, serverUpdates, currentUser);
              setCurrentUser(updated);
              saveSession(updated);
              if (!_silent) showToast('Профиль обновлён', 'success');
              return updated;
            } catch (e) {
              showToast(e.message, 'error');
              throw e;
            }
          }}
          onUploadAvatar={async (dataUrl) => {
            const merged = await uploadAvatar(currentUser.id, dataUrl, currentUser);
            setCurrentUser(merged);
            saveSession(merged);
            return merged;
          }}
          onLoadProject={async (projectId) => {
            const project = await loadProjectFromCloud(projectId);
            if (project?.graph_document) {
              const check = validateGraphDocumentForEditor(project.graph_document);
              if (!check.ok) {
                showToast(check.errors[0]?.message || check.issues?.[0]?.message || 'Проект повреждён', 'error');
                return;
              }
              const done = beginLoad();
              try {
                const migrated = migrateGraphDocument(graph, createGraphDocument(project.graph_document));
                if (!migrated?.ok) {
                  showToast(migrated?.error || 'Не удалось загрузить проект', 'error');
                  return;
                }
              } finally {
                done();
              }
              const metaMode = readLayoutModeFromMetadata(graph.getGraphDocument().metadata);
              setFlowLayoutMode(metaMode);
              applyCanvasLayout(metaMode);
              syncGraphUidSequence();
              setProjectName(project.name);
              setActiveProjectId(project.id);
              setShowProfileModal(false);
              showToast(`📁 ${builderUi.projectBadge(project.name)}`, 'info');
            }
          }}
          onDeleteProject={async (projectId) => {
            const ok = await appConfirm({
              title: 'Удалить проект?',
              message: 'Проект и его данные будут удалены без возможности восстановления.',
              confirmText: 'Удалить',
              cancelText: 'Отмена',
              variant: 'danger',
            });
            if (!ok) return;
            await deleteProject(projectId);
            await loadUserProjects(currentUser.id);
            showToast('Проект удалён', 'info');
          }}
          onSaveToCloud={async (name) => {
            try {
              await saveProjectToCloudWithReminder(name);
            } catch (e) {
              showToast(e?.message || 'Не удалось сохранить проект', 'error');
            }
          }}
          onOpenInstructions={() => setShowInstructions(true)}
          showToast={showToast}
          isMobile={isMobileView}
          botControl={{
            isSandboxRunning,
            isServerRunning,
            serverProjectId: serverRunProjectId,
            isStartingSandbox,
            isStartingServer,
            isStoppingSandbox,
            isStoppingServer,
            hasPremium: hasActiveProSubscription,
          }}
          onStartBotOnServer={startBotOnServerForProject}
          onStopBot={stopServerBot}
          onOpenPremium={openPremiumPurchase}
        />
      )}

      <ChatSimulatorPanel
        open={useFloatingSimulator}
        variant="floating"
        onClose={() => setPreviewPanelOpen(false)}
        isMobileView={isMobileView}
        panelPos={previewPanelPos}
        onPanelPosChange={setPreviewPanelPos}
        generateCodegenSnapshot={generateBotPythonSnapshot}
        getGraphDocument={() => graph.getGraphDocument()}
        graphPalette={graphPalette}
        paletteOptions={{ lang: uiLang, blockTypes: builderBlockTypes }}
        onHighlightNodes={(ids) => handleTraceHighlightChange({ active: ids })}
        onTraceId={(id) => {
          if (id) {
            setDebugTraceId(id);
            setDebugTraceOpen(true);
          }
        }}
        onDebugSnapshot={setDebugCodegenSnapshot}
        botName={projectName || 'Test Bot'}
        flowId={analyticsFlowId}
      />

      <AnalyticsHub
        open={Boolean(currentUser && analyticsPanelOpen)}
        onClose={() => setAnalyticsPanelOpen(false)}
        flowId={analyticsFlowId}
        nodeIds={analyticsNodeIds}
        getGraphDocument={() => graph.getGraphDocument()}
        onHighlightNodes={(ids) => handleTraceHighlightChange({ active: ids })}
        lastTraceId={debugTraceId}
        panelPos={analyticsPanelPos}
        onPanelPosChange={setAnalyticsPanelPos}
        isMobileView={isMobileView}
      />

      {graphDiagOpen && (
        <div
          style={{
            position: 'fixed',
            right: isMobileView ? 8 : 20,
            top: isMobileView ? 72 : 88,
            width: isMobileView ? 'calc(100vw - 16px)' : 'min(380px, 34vw)',
            zIndex: 9597,
          }}
        >
          <GraphDiagnosticsPanel
            document={graph.getGraphDocument()}
            strict={graphStrictMode}
            fullValidation={fullValidationResult}
            lang={uiLang}
            onClose={() => setGraphDiagOpen(false)}
            onStrictChange={(v) => {
              setGraphStrictMode(v);
              try { localStorage.setItem('cicada_graph_strict', v ? '1' : '0'); } catch { /* ignore */ }
            }}
            onApplyRepair={(operations) => {
              for (const op of operations || []) {
                graph.dispatch(op.type, op.payload);
              }
            }}
            onResetGraph={handleResetCorruptedGraph}
            onHighlightNodeIds={handleHighlightCompileNodes}
            onHighlightEdge={(edgeId) => {
              if (edgeId) handleHighlightCompileNodes({ nodeIds: [], edgeIds: [edgeId] });
            }}
          />
        </div>
      )}

      {botDebugOpen && (
        <div
          ref={botDebugPanelRef}
          style={{
            position: 'fixed',
            ...(botDebugPanelPos
              ? {
                  left: botDebugPanelPos.left,
                  top: botDebugPanelPos.top,
                  right: 'auto',
                  bottom: 'auto',
                  ...(isMobileView
                    ? { width: 'calc(100vw - 16px)', maxWidth: 480, height: 'min(440px, 52vh)' }
                    : { width: 'min(420px, 38vw)', height: 'min(440px, 52vh)' }),
                }
              : isMobileView
                ? { left: 8, right: 8, bottom: 72, top: '14vh', maxHeight: '62vh' }
                : { left: 20, bottom: 20, width: 'min(420px, 38vw)', height: 'min(440px, 52vh)' }),
            zIndex: 9598,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(160deg,#111318,#0c0e13)',
            border: '1px solid rgba(250,204,21,0.32)',
            borderRadius: 14,
            boxShadow: '0 24px 50px rgba(0,0,0,0.55)',
            overflow: 'hidden',
            fontFamily: 'var(--mono, ui-monospace, monospace)',
          }}
        >
          <div
            role="presentation"
            onMouseDown={startBotDebugPanelDrag}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(250,204,21,0.06)',
              fontFamily: 'Syne,system-ui, sans-serif',
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fef08a' }}>
              Отладка · cicada --dev
            </div>
            <button
              type="button"
              aria-label="Закрыть"
              onClick={() => setBotDebugOpen(false)}
              style={{
                border: 'none', background: 'rgba(255,255,255,0.06)',
                color: '#94a3b8', cursor: 'pointer', borderRadius: 8,
                width: 30, height: 30, fontSize: 16, lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.92)', padding: '6px 12px', lineHeight: 1.45, fontFamily: 'Syne,system-ui, sans-serif' }}>
            Поток stdout/stderr процесса на сервере. Обновляется каждые ~1.2 с, пока открыто окно.
          </div>
          <pre
            ref={botDebugScrollRef}
            style={{
              flex: 1, minHeight: 0, margin: 0, padding: '10px 12px',
              overflow: 'auto', fontSize: 11, lineHeight: 1.45,
              color: 'rgba(226,232,240,0.92)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
          >
            {botDebugLogs
              || (botDebugActive
                ? 'Процесс запущен. Ожидание stdout/stderr (aiogram пишет в лог после старта polling)…'
                : isBotRunning
                  ? 'Ожидание логов…'
                  : 'Нет активного процесса. Запусти бота или открой окно сразу после остановки — последние строки могут быть доступны.')}</pre>
        </div>
      )}

      <ToastHost toast={toast} isMobile={isMobileView} />

      {/* Bot Starting Loading Modal */}
      {(isStartingSandbox || isStartingServer) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #0d0920 0%, #10082a 100%)',
            borderRadius: 20,
            border: '1px solid rgba(249,115,22,0.3)',
            padding: '40px 50px',
            textAlign: 'center',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 40px rgba(249,115,22,0.12)',
          }}>
            <div style={{
              width: 60, height: 60,
              border: '4px solid rgba(249,115,22,0.2)',
              borderTopColor: '#f97316',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 18, color: '#f97316', fontWeight: 600, marginBottom: 8 }}>
              {isStartingServer ? 'Запуск на сервере…' : 'Запуск теста…'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Пожалуйста, подождите 
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              {isStartingSandbox ? 'Тест на холсте остановится через 5 минут' : 'Бот работает до конца подписки Premium'}
            </div>
          </div>
        </div>
      )}

      {/* Bot Start Error Modal */}
      {startBotError && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          overflowY: 'auto',
          backdropFilter: 'blur(8px)',
        }} onClick={() => setStartBotError(null)}>
          <div style={{
            background: 'linear-gradient(145deg, #16181c 0%, #1a1d24 100%)',
            borderRadius: 20,
            border: '1px solid rgba(239,68,68,0.3)',
            padding: '35px 45px',
            textAlign: 'center',
            maxWidth: 400,
            width: 'min(400px, calc(100vw - 32px))',
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <div style={{ fontSize: 18, color: '#ef4444', fontWeight: 600, marginBottom: 12 }}>
              Ошибка запуска
            </div>
            <div style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 24,
              whiteSpace: 'pre-wrap',
              textAlign: 'left',
              maxHeight: '45dvh',
              overflowY: 'auto',
            }}>
              {startBotError}
            </div>
            <button
              onClick={() => setStartBotError(null)}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#fff',
                padding: '12px 30px',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Bot Stopping Loading Modal */}
      {(isStoppingSandbox || isStoppingServer) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #16181c 0%, #1a1d24 100%)',
            borderRadius: 20,
            border: '1px solid rgba(239,68,68,0.2)',
            padding: '40px 50px',
            textAlign: 'center',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(239,68,68,0.1)',
          }}>
            <div style={{
              width: 60, height: 60,
              border: '4px solid rgba(239,68,68,0.2)',
              borderTopColor: '#ef4444',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontSize: 18, color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>
              Остановка бота...
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Пожалуйста, подождите
            </div>
          </div>
        </div>
      )}

      {/* Bot Stop Error Modal */}
      {stopBotError && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          overflowY: 'auto',
          backdropFilter: 'blur(8px)',
        }} onClick={() => setStopBotError(null)}>
          <div style={{
            background: 'linear-gradient(145deg, #16181c 0%, #1a1d24 100%)',
            borderRadius: 20,
            border: '1px solid rgba(239,68,68,0.3)',
            padding: '35px 45px',
            textAlign: 'center',
            maxWidth: 400,
            width: 'min(400px, calc(100vw - 32px))',
            maxHeight: 'calc(100dvh - 32px)',
            overflowY: 'auto',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <div style={{ fontSize: 18, color: '#ef4444', fontWeight: 600, marginBottom: 12 }}>
              Ошибка остановки
            </div>
            <div style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 24,
              whiteSpace: 'pre-wrap',
              textAlign: 'left',
              maxHeight: '45dvh',
              overflowY: 'auto',
            }}>
              {stopBotError}
            </div>
            <button
              onClick={() => setStopBotError(null)}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#fff',
                padding: '12px 30px',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      <DebugTracePanel
        open={debugTraceOpen}
        traceId={debugTraceId}
        transpileTrace={debugCodegenSnapshot?.transpileTrace}
        compileWarnings={debugCodegenSnapshot?.compileWarnings}
        onClose={() => setDebugTraceOpen(false)}
        onHighlightChange={handleTraceHighlightChange}
      />

    </div>
    </BlockInfoContext.Provider>
    </AddBlockContext.Provider>
    </GraphValidationProvider>
    </BuilderUiContext.Provider>
    </StoreProvider>
  );
}
