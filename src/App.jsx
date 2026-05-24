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
  BlockInfoModal,
  Sidebar,
  PropsPanel,
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
import { useGraphEditor } from './constructor/graph_document/useGraphEditor.js';
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
  normalizeInboundEvent,
  resolveEventToPaletteEntry,
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
} from './builder/graph_node_delete.js';
import { getChainStepBelow } from './builder/blockLayout.js';
import { validateGraphSemantics, getNodePortDescriptors, canConnect, validateConnection } from './constructor/graph_document/operation_registry.js';
import { normalizeGraphError, normalizeConnectionError } from './builder/graph_error_messages.js';
import { shouldShowCanvasOnboardingOverlay } from './constructor/graph_document/graph_canvas_state.js';
import CanvasOnboardingOverlay from './builder/CanvasOnboardingOverlay.jsx';
import { scheduleCanvasFocusAfterMutation } from './builder/canvas_graph_focus.js';
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
    throw new Error(validation.errors[0]?.message || validation.issues?.[0]?.message || 'Graph validation failed before cloud save');
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
    throw new Error(validation.errors[0]?.message || validation.issues?.[0]?.message || 'Graph validation failed before export');
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
  return buildPreviewCodegenSnapshot(getDocument, options);
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

const PREVIEW_SESSION_STORAGE_KEY = 'cicada_preview_session_id';

function getOrCreatePreviewSessionId() {
  try {
    let s = sessionStorage.getItem(PREVIEW_SESSION_STORAGE_KEY);
    if (!s || s.length < 8) {
      s =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `pv_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      sessionStorage.setItem(PREVIEW_SESSION_STORAGE_KEY, s);
    }
    return s;
  } catch {
    return `pv_${Date.now()}`;
  }
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

const TELEGRAM_HTML_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a']);
const HTML_ENTITY_MAP = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeHtmlEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, ent) => {
    if (ent[0] === '#') {
      const n = ent[1]?.toLowerCase() === 'x'
        ? Number.parseInt(ent.slice(2), 16)
        : Number.parseInt(ent.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return HTML_ENTITY_MAP[ent] ?? m;
  });
}

function safePreviewHref(href) {
  const s = String(href || '').trim();
  return /^(https?:|tg:|mailto:)/i.test(s) ? s : '';
}

function parseTelegramHtmlText(text) {
  const root = { tag: null, children: [] };
  const stack = [root];
  const re = /<\/?([a-zA-Z][\w-]*)(?:\s+[^>]*)?>/g;
  let last = 0;
  let m;

  const pushText = (value) => {
    if (value) stack[stack.length - 1].children.push(decodeHtmlEntities(value));
  };

  while ((m = re.exec(String(text ?? '')))) {
    pushText(String(text ?? '').slice(last, m.index));
    const raw = m[0];
    const tag = String(m[1] || '').toLowerCase();
    last = re.lastIndex;
    if (!TELEGRAM_HTML_TAGS.has(tag)) {
      pushText(raw);
      continue;
    }
    if (raw.startsWith('</')) {
      const idx = stack.findLastIndex((node) => node.tag === tag);
      if (idx > 0) stack.length = idx;
      continue;
    }
    const hrefMatch = tag === 'a' ? raw.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) : null;
    const rawHref = hrefMatch ? decodeHtmlEntities(hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || '') : '';
    const node = {
      tag,
      attrs: hrefMatch ? { href: safePreviewHref(rawHref) } : {},
      children: [],
    };
    stack[stack.length - 1].children.push(node);
    if (!raw.endsWith('/>')) stack.push(node);
  }
  pushText(String(text ?? '').slice(last));
  return root.children;
}

function findUnescapedMarker(text, marker, start) {
  let i = start;
  while (i < text.length) {
    const at = text.indexOf(marker, i);
    if (at < 0) return -1;
    let slashes = 0;
    for (let j = at - 1; j >= 0 && text[j] === '\\'; j -= 1) slashes += 1;
    if (slashes % 2 === 0) return at;
    i = at + marker.length;
  }
  return -1;
}

function parseTelegramMarkdownV2Text(input) {
  const text = String(input ?? '');
  const nodes = [];
  let plain = '';
  let i = 0;

  const flush = () => {
    if (plain) {
      nodes.push(plain);
      plain = '';
    }
  };

  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length) {
      plain += text[i + 1];
      i += 2;
      continue;
    }

    if (text.startsWith('```', i)) {
      const end = findUnescapedMarker(text, '```', i + 3);
      if (end > i) {
        flush();
        nodes.push({ tag: 'pre', children: [text.slice(i + 3, end)] });
        i = end + 3;
        continue;
      }
    }

    if (text[i] === '`') {
      const end = findUnescapedMarker(text, '`', i + 1);
      if (end > i) {
        flush();
        nodes.push({ tag: 'code', children: [text.slice(i + 1, end)] });
        i = end + 1;
        continue;
      }
    }

    const marker = text.startsWith('__', i) ? '__' : text.startsWith('||', i) ? '||' : text[i];
    const tag = marker === '__' ? 'u'
      : marker === '||' ? 'spoiler'
      : marker === '*' ? 'strong'
      : marker === '_' ? 'em'
      : marker === '~' ? 's'
      : null;
    if (tag) {
      const end = findUnescapedMarker(text, marker, i + marker.length);
      if (end > i) {
        flush();
        nodes.push({ tag, children: parseTelegramMarkdownV2Text(text.slice(i + marker.length, end)) });
        i = end + marker.length;
        continue;
      }
    }

    if (text[i] === '[') {
      const labelEnd = findUnescapedMarker(text, ']', i + 1);
      if (labelEnd > i && text[labelEnd + 1] === '(') {
        const urlEnd = findUnescapedMarker(text, ')', labelEnd + 2);
        if (urlEnd > labelEnd) {
          flush();
          nodes.push({
            tag: 'a',
            attrs: { href: text.slice(labelEnd + 2, urlEnd).replace(/\\(.)/g, '$1') },
            children: parseTelegramMarkdownV2Text(text.slice(i + 1, labelEnd)),
          });
          i = urlEnd + 1;
          continue;
        }
      }
    }

    plain += text[i];
    i += 1;
  }

  flush();
  return nodes;
}

function renderPreviewRichNode(node, key) {
  if (typeof node === 'string') return <React.Fragment key={key}>{node}</React.Fragment>;
  const children = (node.children || []).map((child, i) => renderPreviewRichNode(child, `${key}.${i}`));
  switch (node.tag) {
    case 'b':
    case 'strong':
      return <strong key={key}>{children}</strong>;
    case 'i':
    case 'em':
      return <em key={key}>{children}</em>;
    case 'u':
    case 'ins':
      return <span key={key} style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</span>;
    case 's':
    case 'strike':
    case 'del':
      return <span key={key} style={{ textDecoration: 'line-through' }}>{children}</span>;
    case 'code':
      return <code key={key} style={{ background: 'rgba(15,23,42,0.75)', borderRadius: 4, padding: '1px 4px' }}>{children}</code>;
    case 'pre':
      return <code key={key} style={{ display: 'block', background: 'rgba(15,23,42,0.75)', borderRadius: 6, padding: '6px 7px', margin: '3px 0', whiteSpace: 'pre-wrap' }}>{children}</code>;
    case 'a': {
      const href = safePreviewHref(node.attrs?.href);
      if (!href) return <span key={key}>{children}</span>;
      return <a key={key} href={href} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>{children}</a>;
    }
    case 'spoiler':
      return <span key={key} style={{ background: 'rgba(148,163,184,0.35)', borderRadius: 3, padding: '0 2px' }}>{children}</span>;
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>;
  }
}

function PreviewRichText({ text, format }) {
  const fmt = String(format || '').toLowerCase();
  const nodes = fmt === 'html'
    ? parseTelegramHtmlText(text)
    : (fmt === 'markdown_v2' || fmt === 'markdownv2')
      ? parseTelegramMarkdownV2Text(text)
      : [String(text ?? '')];
  return <>{nodes.map((node, i) => renderPreviewRichNode(node, `pvrt.${i}`))}</>;
}

function previewFormatFromOutbound(o) {
  const parseMode = String(o?.parse_mode || o?.parseMode || o?.params?.parse_mode || '').toLowerCase();
  if (o?.type === 'html' || parseMode === 'html') return 'html';
  if (o?.type === 'markdown_v2' || parseMode === 'markdownv2' || parseMode === 'markdown_v2') return 'markdown_v2';
  return '';
}

/** Label for reply/inline button (worker may send plain strings or { text, callback_data, url }). */
function previewKeyboardButtonLabel(btn) {
  if (btn == null) return '';
  if (typeof btn === 'string') return btn;
  if (typeof btn === 'object' && btn.text != null) return String(btn.text);
  return String(btn);
}

/** Stable React key for preview keyboard buttons (survives reorder/delete). */
function previewKeyboardButtonKey(prefix, rowIndex, colIndex, btn) {
  const label = previewKeyboardButtonLabel(btn);
  const cd = typeof btn === 'object' && btn != null ? String(btn.callback_data ?? '') : label;
  const url = typeof btn === 'object' && btn != null ? String(btn.url ?? '') : '';
  return `${prefix}:r${rowIndex}:c${colIndex}:${label}:${cd}:${url}`;
}

function previewKeyboardRows(keyboard) {
  if (!Array.isArray(keyboard) || keyboard.length === 0) return [];
  if (Array.isArray(keyboard[0])) return keyboard;
  return [keyboard];
}

function previewNormalizeReplyKeyboard(keyboard) {
  return previewKeyboardRows(keyboard).map((row) =>
    (Array.isArray(row) ? row : [])
      .map((btn) => previewKeyboardButtonLabel(btn))
      .filter((lbl) => lbl.length > 0),
  ).filter((row) => row.length > 0);
}

function previewNormalizeInlineKeyboard(keyboard) {
  return previewKeyboardRows(keyboard).map((row) =>
    (Array.isArray(row) ? row : []).map((btn) => {
      if (typeof btn === 'string') {
        return { text: btn, callback_data: btn, url: null };
      }
      const text = previewKeyboardButtonLabel(btn);
      return {
        text,
        callback_data: btn?.callback_data != null ? btn.callback_data : text,
        url: btn?.url ?? null,
      };
    }),
  ).filter((row) => row.length > 0);
}

function previewOutboundToEntries(outbound) {
  const skip = new Set(['answer_callback', 'set_commands']);
  const entries = [];
  for (const o of outbound || []) {
    if (skip.has(o.type)) continue;
    const format = previewFormatFromOutbound(o);
    if (o.type === 'send_message' || o.type === 'markdown' || o.type === 'html' || o.type === 'markdown_v2') {
      entries.push({ role: 'bot', kind: 'text', text: o.text ?? '', format });
    } else if (o.type === 'reply_keyboard') {
      entries.push({
        role: 'bot',
        kind: 'reply_keyboard',
        text: o.text ?? '',
        format,
        keyboard: previewNormalizeReplyKeyboard(o.keyboard),
      });
    } else if (o.type === 'inline_keyboard') {
      entries.push({
        role: 'bot',
        kind: 'inline_keyboard',
        text: o.text ?? '',
        format,
        rows: previewNormalizeInlineKeyboard(o.keyboard),
      });
    } else if (o.type === 'photo') {
      entries.push({
        role: 'bot',
        kind: 'text',
        text: `[фото] ${o.source ?? ''}${o.caption ? `\n${o.caption}` : ''}`,
      });
    } else if (o.type === 'api_call') {
      entries.push({ role: 'bot', kind: 'sys', text: `API ${o.method ?? '?'}` });
    } else {
      entries.push({ role: 'bot', kind: 'sys', text: String(o.type || '?') });
    }
  }
  return entries;
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
  graphCanChainAfter,
  layoutAllFlowChains,
  spreadOverlappingNodes,
  resolveUiAttachmentTargetNodeId,
  resolveFlowInsertAnchorId,
  graphUniqueBlockLabel,
} from './app/graph/graphHelpers.js';
import { UnknownBlockTypeError } from './constructor/graph_document/graph_node_payload.js';
import { isPlaceholderBotToken } from '../core/botTokenPlaceholders.mjs';

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

  const graph = useGraphEditor();
  // Memoize per-revision so ReactFlow / projection consumers don't see a new
  // object identity on every unrelated App render. The graph editor API's
  // accessors are stable, so depending on them is safe.
  const graphRevision = React.useMemo(
    () => graph.getGraphDocument().metadata.revision,
    [graph, graph.getGraphDocument().metadata.revision],
  );
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
  const { userProjects, setUserProjects, loadUserProjects } = useUserProjects();
  const canvasProjection = React.useMemo(
    () => graph.getCanvasProjection(),
    [graph, graphRevision],
  );

  const graphNodeCount = React.useMemo(
    () => Object.keys(graph.getGraphDocument().nodes || {}).length,
    [graph, graphRevision],
  );

  const showCanvasOnboarding = React.useMemo(() => {
    const doc = graph.getGraphDocument();
    return shouldShowCanvasOnboardingOverlay(doc);
  }, [graph, graphRevision, graphNodeCount]);

  const focusCanvasAfterContent = useCallback(() => {
    scheduleCanvasFocusAfterMutation(
      graph,
      {
        width: canvasRef.current?.clientWidth,
        height: canvasRef.current?.clientHeight,
      },
      {
        onLayout: () => {
          spreadOverlappingNodes(graph);
          layoutAllFlowChains(graph);
        },
        onSelectNode: (id) => setSelectedBlockId(id),
      },
    );
  }, [graph]);

  const [debugTraceId, setDebugTraceId] = useState(null);
  const [debugTraceOpen, setDebugTraceOpen] = useState(false);
  const [debugCodegenSnapshot, setDebugCodegenSnapshot] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [mobileAttentionBlockId, setMobileAttentionBlockId] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  /** { type, props } — окно справки по кнопке «i» на блоке */
  const [blockInfo, setBlockInfo] = useState(null);
  const [draggingPaletteEntry, setDraggingPaletteEntry] = useState(null);
  const canvasRef = useRef(null);
  const layoutChainRef = useRef(null);

  const handleFitAllCanvasNodes = useCallback(() => {
    spreadOverlappingNodes(graph);
    layoutAllFlowChains(graph);
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
  const [projectName, setProjectName] = useState('');
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [serverRunProjectId, setServerRunProjectId] = useState(null);
  const [showExamples, setShowExamples] = useState(false);
  /** Якорь кнопки «Примеры» — меню рендерим в portal, иначе перекрывается холстом / stacking context шапки */
  const examplesToggleRef = useRef(null);
  const [examplesMenuRect, setExamplesMenuRect] = useState(null);
  const filesMenuToggleRef = useRef(null);
  const [filesMenuRect, setFilesMenuRect] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingStep, setAiLoadingStep] = useState(0);
  const [aiError, setAiError] = useState('');
  const [aiPartialResult, setAiPartialResult] = useState(null);
  const [aiDiagnosticsOpen, setAiDiagnosticsOpen] = useState(false);
  const [landingInfoPage, setLandingInfoPage] = useState(null); // features | templates | docs | pricing | null
  const [proMonthlyUsd, setProMonthlyUsd] = useState(null);

  // Toast notification state
  const [toast, setToast] = useState(null); // { message, type, visible }
  const toastTimeoutRef = useRef(null);
  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    if (!message) return;
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast({ message, type, visible: true });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast((prev) => prev ? { ...prev, visible: false } : prev);
      toastTimeoutRef.current = null;
    }, duration);
  }, []);
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
    spreadOverlappingNodes(graph);
    layoutAllFlowChains(graph);
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

  const openAiGeneratorModal = useCallback(() => {
    if (!canUseAiGenerator) {
      openPremiumPurchase();
      return;
    }
    setAiPrompt('');
    setAiError('');
    setAiPartialResult(null);
    setAiDiagnosticsOpen(false);
    setShowAIModal(true);
  }, [canUseAiGenerator, openPremiumPurchase]);

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

  // Mobile state
  const [mobileTab, setMobileTab] = useState('canvas'); // 'canvas' | 'blocks' | 'props' | 'dsl'
  const isMobile = isMobileBuilderViewport();
  const [isMobileView, setIsMobileView] = useState(() => isMobileBuilderViewport());
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [showFilesMenu, setShowFilesMenu] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

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
          onEnter: () => setMobileTab('blocks'),
        },
        {
          selector: '[data-tour="mobile-tab-canvas"]',
          title: ui.tourMobileCanvasTitle,
          text: ui.tourMobileCanvasBody,
          onEnter: () => setMobileTab('canvas'),
        },
        {
          selector: '[data-tour="mobile-tab-props"]',
          title: ui.tourMobilePropsTitle,
          text: ui.tourMobilePropsBody,
          onEnter: () => setMobileTab('props'),
        },
        {
          selector: '[data-tour="mobile-tab-dsl"]',
          title: ui.tourMobileDslTitle,
          text: ui.tourMobileDslBody,
          onEnter: () => { if (canSeeCode) setMobileTab('dsl'); },
        },
        {
          selector: '[data-tour="mobile-run"]',
          title: ui.tourRunTitle,
          text: ui.tourRunBody,
          onEnter: () => setMobileTab('canvas'),
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
    if (!canSeeCode && mobileTab === 'dsl') setMobileTab('canvas');
  }, [canSeeCode, mobileTab]);

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

  useEffect(() => {
    if (!tourActive) return;
    const step = onboardingSteps[tourStep];
    if (step?.onEnter) step.onEnter();
  }, [tourActive, tourStep, onboardingSteps]);

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
    const parent = doc.nodes[effectiveParentId];
    if (!parent) return { ok: false, error: 'Unknown parent' };
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
    layoutChainRef.current?.(parentId);
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
    spreadOverlappingNodes(graph);
    layoutAllFlowChains(graph);
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
        ? 'Частичный сценарий добавлен на холст. Проверьте диагностику перед запуском.'
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
    setSelectedBlockId(nodeId);
    const doc = graph.getGraphDocument();
    const node = doc.nodes[nodeId];
    if (!node) return;
    const resolvedType = graphResolveNodeType(node);
    const props = { ...(node.data || {}) };
    setBlockInfo({ type: resolvedType, props, nodeId });
    if (isMobileView) setMobileTab('props');
  }, [graph, isMobileView]);

  const handleConnectFeedback = useCallback((result) => {
    if (!result) return;
    if (result.ok) return;
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

  const graphCanvasActions = React.useMemo(() => ({
    onSelectNode: handleSelectNode,
    onDeleteNode: handleRequestDeleteNode,
  }), [handleSelectNode, handleRequestDeleteNode]);

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
        graph.undo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z
      if ((mod && e.key === 'y') || (mod && e.key === 'z' && e.shiftKey)) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        graph.redo();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleRequestDeleteNode, selectedBlockId, graph]);

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
    setDraggingPaletteEntry(null);
  }, []);

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

  // Layout chain starting from startNodeId: set positions of subsequent nodes
  const layoutChain = useCallback((startNodeId) => {
    if (!startNodeId) return;
    let currentId = startNodeId;
    const visited = new Set();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const doc = graph.getGraphDocument();
      const current = doc.nodes[currentId];
      if (!current) break;
      const out = getOutgoingEdge(doc, currentId);
      if (!out) break;
      const next = doc.nodes[out.target];
      if (!next) break;
      const newPos = {
        x: current.position.x,
        y: current.position.y + getChainStepBelow(current, doc),
      };
      try {
        moveNode(graph, next.id, newPos);
      } catch (err) {
        console.warn('[layoutChain] moveNode failed', err);
      }
      currentId = next.id;
    }
  }, [graph, getOutgoingEdge]);

  layoutChainRef.current = layoutChain;

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
    const paletteId = event?.dataTransfer?.getData('cicada/palette-id');
    const paletteOpts = { lang: uiLang, blockTypes: builderBlockTypes };
    const entry = paletteId ? getPaletteEntry(paletteId, paletteOpts) : draggingPaletteEntry;
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
    const position = flowPosition ?? { x: 120, y: 120 };
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

    // If a block is selected, insert the new block after it in the chain.
    if (selectedBlockId) {
      const inserted = insertNodeAfter(selectedBlockId, nodeId, type, props);
      if (!inserted?.ok) {
        showToast(inserted?.errorDetail?.fix || inserted?.error || 'Не удалось добавить узел в цепочку', 'info');
        endPaletteDrag();
        return;
      }
      setSelectedBlockId(nodeId);
    } else {
      // No parent selected — create an independent branch at canvas center
      const result = graphAddNode(graph, {
        nodeId,
        type,
        position: getCanvasCenterPosition(),
        data: props,
      });
      if (!result?.ok) {
        showToast(result?.error || 'Не удалось добавить узел', 'info');
        endPaletteDrag();
        return;
      }
      setSelectedBlockId(nodeId);
    }
    endPaletteDrag();
    focusCanvasAfterContent();
  }, [endPaletteDrag, currentUser, showToast, graph, draggingPaletteEntry, uiLang, builderBlockTypes, builderUi, selectedBlockId, insertNodeAfter, getCanvasCenterPosition, attachLegacyUiToNode, focusCanvasAfterContent]);


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
    saveCanvasForKey(canvasStorageKey, graph);
    showToast('Холст очищен', 'info');
  }, [graph, builderUi.clearCanvas, showToast, canvasStorageKey]);

  const handleResetCorruptedGraph = useCallback(async () => {
    const confirmed = await appConfirm({
      title: builderUi.resetCorruptedGraph || 'Сброс повреждённого graph state',
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
        showToast(result?.error || 'Не удалось сбросить graph state', 'error');
        return;
      }
      graph.setViewport({ x: 0, y: 0, zoom: 1 });
      setSelectedBlockId(null);
      setActiveProjectId(null);
      try {
        localStorage.removeItem(canvasStorageKey);
      } catch { /* ignore */ }
      saveCanvasForKey(canvasStorageKey, graph);
      showToast(builderUi.resetCorruptedGraphDone || 'Graph state сброшен', 'success');
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
    setMobileTab('canvas');
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
      setMobileTab('canvas');
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
    if (selectedBlockId) {
      const inserted = insertNodeAfter(selectedBlockId, nodeId, type, props);
      if (!inserted?.ok) {
        showToast(inserted?.error || 'Не удалось добавить узел', 'info');
        return;
      }
    } else {
      const result = graphAddNode(graph, { nodeId, type, position, data: props });
      if (!result?.ok) {
        showToast(result?.error || 'Не удалось добавить узел', 'info');
        return;
      }
    }
    setSelectedBlockId(nodeId);
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
    const anchorId = blockInfo?.nodeId || selectedBlockId;
    const conflict = graphGetUniqueConflictMessage(graph, type, props, uiLang);
    if (conflict) {
      showToast(conflict, 'info');
      setBlockInfo(null);
      return;
    }
    if (anchorId && tryAttachLegacyUiToSelected(type, props, anchorId)) {
      showToast('Элемент добавлен к выбранному блоку', 'success');
      focusMobileAddedBlock(anchorId);
      setBlockInfo(null);
      return;
    }
    const nodeId = uid();
    if (anchorId) {
      const inserted = insertNodeAfter(anchorId, nodeId, type, props);
      if (!inserted?.ok) {
        showToast(inserted?.errorDetail?.fix || inserted?.error || 'Не удалось добавить узел', 'info');
        setBlockInfo(null);
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
        showToast(result?.error || 'Не удалось добавить узел', 'info');
        setBlockInfo(null);
        return;
      }
    }
    setSelectedBlockId(nodeId);
    focusMobileAddedBlock(nodeId);
    setBlockInfo(null);
    } catch (err) {
      const msg = err instanceof UnknownBlockTypeError
        ? (uiLang === 'en' ? `Unknown block type: ${err.type || type}` : `Неизвестный тип блока: ${err.type || type}`)
        : (err?.message || 'Не удалось добавить блок');
      showToast(msg, 'info');
      setBlockInfo(null);
    }
  }, [
    focusMobileAddedBlock,
    getCanvasCenterPosition,
    currentUser,
    showToast,
    graph,
    uiLang,
    selectedBlockId,
    blockInfo?.nodeId,
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
    layoutAllFlowChains(graph);
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
  }, [graph, showToast, currentUser, builderUi, beginLoad, syncGraphUidSequence]);

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
    const saved = await saveProjectToCloud(
      currentUser.id,
      name,
      graph.getGraphDocument(),
      activeProjectId,
    );
    if (saved?.id) setActiveProjectId(saved.id);
    if (!projectName.trim()) setProjectName(name);
    await loadUserProjects(currentUser.id);
    return saved;
  }, [currentUser?.id, projectName, activeProjectId, loadUserProjects]);

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
          layoutAllFlowChains(graph);
          syncGraphUidSequence();
        } catch (err) {
          showToast('Ошибка загрузки файла', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [showToast, graph, beginLoad, syncGraphUidSequence]);

  // Bot run/stop: sandbox (тест 5 мин на холсте) и server (Premium) — независимые слоты
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [isStartingSandbox, setIsStartingSandbox] = useState(false);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [startBotError, setStartBotError] = useState(null);
  const [isStoppingSandbox, setIsStoppingSandbox] = useState(false);
  const [isStoppingServer, setIsStoppingServer] = useState(false);
  const [stopBotError, setStopBotError] = useState(null);
  const [sandboxSecondsLeft, setSandboxSecondsLeft] = useState(null);
  const sandboxCountdownRef = useRef(null);
  const botDebugModeRef = useRef('sandbox');

  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [previewMessages, setPreviewMessages] = useState([]);
  const [previewDraft, setPreviewDraft] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewErr, setPreviewErr] = useState(null);
  const previewScrollRef = useRef(null);
  const previewPanelRef = useRef(null);
  const previewFileInputRef = useRef(null);
  /** null — позиция по умолчанию (правый нижний угол); иначе фиксированные left/top в px */
  const [previewPanelPos, setPreviewPanelPos] = useState(null);
  const previewDragRef = useRef(null);

  const [botDebugOpen, setBotDebugOpen] = useState(false);
  const [graphDiagOpen, setGraphDiagOpen] = useState(false);
  const [graphStrictMode, setGraphStrictMode] = useState(() => {
    try {
      return localStorage.getItem('cicada_graph_strict') === '1';
    } catch {
      return false;
    }
  });

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
  const [repairHighlight, setRepairHighlight] = useState({
    nodeIds: [],
    edgeIds: [],
    until: 0,
  });

  /** Focus canvas on diagnostic target — pulse highlight, selection, viewport pan. */
  const handleHighlightCompileNodes = useCallback((target) => {
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
      setRepairHighlight({ nodeIds: [], edgeIds: [], until: 0 });
      return;
    }
    handleHighlightCompileNodes(active);
  }, [handleHighlightCompileNodes]);

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
    });
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
    setRepairHighlight({ nodeIds: [], edgeIds: [], until: 0 });
    requestFullValidation();
    showToast(uiLang === 'en' ? 'Repair undone' : 'Исправление отменено', 'info');
  }, [lastRepairResult, graph, requestFullValidation, showToast, uiLang]);

  React.useEffect(() => {
    if (!repairHighlight.until) return undefined;
    const left = repairHighlight.until - Date.now();
    if (left <= 0) {
      setRepairHighlight({ nodeIds: [], edgeIds: [], until: 0 });
      return undefined;
    }
    const t = setTimeout(() => {
      setRepairHighlight({ nodeIds: [], edgeIds: [], until: 0 });
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

  const runPreviewStep = useCallback(
    async ({ text = '', callbackData = null, event = null }) => {
      setPreviewBusy(true);
      setPreviewErr(null);
      try {
        const snap = generateBotPythonSnapshot();
        setDebugCodegenSnapshot(snap);
        const { runDebugExecution } = await import('./constructor/previewBridge.js');
        const out = await runDebugExecution({
          graphIR: snap.graph,
          generatedPython: snap.generatedPython,
          compileWarnings: snap.compileWarnings,
          transpileTrace: snap.transpileTrace,
          text: text != null ? String(text) : '',
          callbackData,
          event,
          palette: graphPalette,
          paletteOptions: { lang: uiLang, blockTypes: builderBlockTypes },
        });
        if (out.debugSnapshot) setDebugCodegenSnapshot(out.debugSnapshot);
        if (out.traceId) {
          setDebugTraceId(out.traceId);
          setDebugTraceOpen(true);
        }
        const raw = { ok: true, outbound: out.effects ?? [] };
        if (Array.isArray(raw.outbound) && raw.outbound.length) {
          setPreviewMessages((prev) => [...prev, ...previewOutboundToEntries(raw.outbound)]);
        }
      } catch (e) {
        setPreviewErr(e.message || String(e));
      } finally {
        setPreviewBusy(false);
      }
    },
    [generateBotPythonSnapshot, graphPalette, uiLang, builderBlockTypes],
  );

  const sendPreviewUserText = useCallback(
    async (t) => {
      const text = String(t ?? '').trim();
      if (!text || previewBusy) return;
      setPreviewMessages((prev) => [...prev, { role: 'user', kind: 'text', text }]);
      await runPreviewStep({ event: { kind: 'text', text } });
    },
    [runPreviewStep, previewBusy],
  );

  const sendPreviewPaletteEvent = useCallback(
    async (inboundEvent, userLabel) => {
      if (previewBusy) return;
      const label = userLabel || normalizeInboundEvent(inboundEvent).text || inboundEvent?.kind || 'event';
      setPreviewMessages((prev) => [...prev, { role: 'user', kind: 'text', text: label }]);
      const entry = resolveEventToPaletteEntry(inboundEvent, graphPalette, {
        lang: uiLang,
        blockTypes: builderBlockTypes,
      });
      if (entry && import.meta.env?.DEV) {
        console.warn(
          `[palette-debug] preview event → entry ${entry.id} (${entry.type}/${entry.paletteKind})`,
        );
      }
      await runPreviewStep({ event: inboundEvent });
    },
    [previewBusy, runPreviewStep, graphPalette, uiLang, builderBlockTypes],
  );

  const sendPreviewUserVoice = useCallback(
    () => sendPreviewPaletteEvent({ kind: 'voice' }, '🎤 голосовое'),
    [sendPreviewPaletteEvent],
  );

  const sendPreviewUserSticker = useCallback(
  () => sendPreviewPaletteEvent(
      { kind: 'sticker', stickerId: 'preview_sticker_file_id', stickerEmoji: '🙂' },
      '🎭 стикер',
    ),
    [sendPreviewPaletteEvent],
  );

  const sendPreviewUserCommand = useCallback(
    (cmd) => {
      const c = String(cmd || '').trim();
      if (!c) return;
      const command = c.startsWith('/') ? c : `/${c}`;
      return sendPreviewPaletteEvent({ kind: 'command', command, text: command }, command);
    },
    [sendPreviewPaletteEvent],
  );

  const sendPreviewUserFile = useCallback(
    async (file) => {
      if (!file || previewBusy) return;
      const name = file.name || 'file';
      setPreviewMessages((prev) => [
        ...prev,
        { role: 'user', kind: 'document', fileName: name, text: `[file] ${name}` },
      ]);
      await sendPreviewPaletteEvent({ kind: 'document', fileId: name }, `📎 ${name}`);
    },
    [previewBusy, sendPreviewPaletteEvent],
  );

  const sendPreviewCallback = useCallback(
    async (data) => {
      const cb = normalizeCallbackData(data);
      if (!cb || previewBusy) return;
      setPreviewMessages((prev) => [...prev, { role: 'user', kind: 'text', text: `ⓘ ${cb}` }]);
      await runPreviewStep({ event: { kind: 'callback', callbackData: cb } });
    },
    [runPreviewStep, previewBusy],
  );

  const resetPreviewSession = useCallback(() => {
    try {
      sessionStorage.removeItem(PREVIEW_SESSION_STORAGE_KEY);
    } catch { /* ignore */ }
    setPreviewMessages([]);
    setPreviewErr(null);
    setPreviewDraft('');
  }, []);

  const startPreviewPanelDrag = useCallback((e) => {
    if (e.button !== 0) return;
    const el = e.target;
    if (el.closest && (el.closest('button') || el.closest('input') || el.closest('a'))) return;
    const panel = previewPanelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    setPreviewPanelPos({ left: rect.left, top: rect.top });
    previewDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    const move = (ev) => {
      const d = previewDragRef.current;
      if (!d) return;
      let left = d.originLeft + (ev.clientX - d.startX);
      let top = d.originTop + (ev.clientY - d.startY);
      const margin = 8;
      left = Math.max(margin, Math.min(left, window.innerWidth - d.width - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - d.height - margin));
      setPreviewPanelPos({ left, top });
    };
    const up = () => {
      previewDragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    e.preventDefault();
  }, []);

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
    if (!previewPanelOpen) return;
    const el = previewScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [previewPanelOpen, previewMessages, previewBusy]);

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
        setStartBotError(firstUx?.hint || firstUx?.title || snap.compileErrors[0]?.message || 'Ошибка компиляции схемы');
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
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#06030f 0%,#0b0720 40%,#080518 70%,#05030e 100%)', color: '#fff', fontFamily: 'system-ui,sans-serif' }}>
        <style>{`
          @keyframes landingGrid { from{background-position:0 0} to{background-position:60px 60px} }
          @keyframes landingPulse { 0%,100%{opacity:.45} 50%{opacity:.9} }
          @keyframes panelFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
          @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
          @keyframes fadeUpDelay { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
          @keyframes glowArc { 0%{stroke-dashoffset:800} 100%{stroke-dashoffset:0} }
          @keyframes starTwinkle { 0%,100%{opacity:0;transform:scale(0.5)} 50%{opacity:1;transform:scale(1)} }
          @keyframes orbFloat { 0%,100%{transform:translateY(0) translateX(0)} 33%{transform:translateY(-18px) translateX(8px)} 66%{transform:translateY(10px) translateX(-6px)} }
          @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
          @keyframes neonPulse { 0%,100%{opacity:0.7;filter:blur(18px)} 50%{opacity:1;filter:blur(22px)} }
          .lp-fadeup { animation: fadeUp .65s ease both; }
          .lp-fadeup2 { animation: fadeUp .65s .15s ease both; }
          .lp-fadeup3 { animation: fadeUp .65s .3s ease both; }
          .lp-card { border:1px solid rgba(255,255,255,0.09); border-radius:14px; background:rgba(255,255,255,0.03); transition:border-color .2s,transform .2s,background .2s; }
          .lp-card:hover { border-color:rgba(255,255,255,0.18); background:rgba(255,255,255,0.055); transform:translateY(-2px); }
          .lp-btn-ghost { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.9); border-radius:10px; border:1px solid rgba(255,255,255,0.2); font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; padding:10px 20px; display:flex; align-items:center; gap:8px; }
          .lp-btn-ghost:hover { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.35); }
          .lp-btn-gold { background:linear-gradient(135deg,#ff9f00,#f59e0b,#ffd700); color:#111; border:none; font-weight:800; cursor:pointer; transition:all .2s; font-family:Syne,system-ui; box-shadow:0 4px 20px rgba(245,158,11,0.35); }
          .lp-btn-gold:hover { filter:brightness(1.1); box-shadow:0 8px 32px rgba(245,158,11,0.55); transform:translateY(-2px); }
          .lp-step-dot { width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; font-family:Syne,system-ui; font-weight:800; font-size:16px; color:#fbbf24; margin-bottom:14px; }
          .lp-nav-link { background:none; border:none; color:rgba(255,255,255,0.7); font-size:14px; cursor:pointer; transition:color .2s; padding:4px 2px; }
          .lp-nav-link:hover { color:#fff; }
          .lp-nav-pill {
            display:inline-flex; align-items:center; gap:6px;
            padding:7px 16px; border-radius:999px; font-size:13px; font-weight:600;
            cursor:pointer; transition:all .22s ease; white-space:nowrap;
            font-family:Syne,system-ui; letter-spacing:0.01em;
            border:1px solid rgba(99,102,241,0.32);
            background:linear-gradient(135deg,rgba(29,20,82,0.62),rgba(16,12,45,0.5));
            color:rgba(235,230,255,0.76);
            position:relative; overflow:hidden; backdrop-filter:blur(10px) saturate(130%);
            box-shadow:inset 0 0 18px rgba(99,102,241,0.1),0 6px 18px rgba(0,0,0,0.16);
          }
          .lp-nav-pill::before {
            content:''; position:absolute; inset:0 auto auto 0; width:58%; height:1px;
            background:linear-gradient(90deg,var(--pill-clr),transparent); opacity:.75;
          }
          .lp-nav-pill:hover {
            background:linear-gradient(135deg,rgba(59,130,246,0.2),rgba(168,85,247,0.14));
            color:#fff;
            transform:translateY(-1px);
          }
          .lp-nav-pill .pill-icon { font-size:13px; line-height:1; transition:transform .22s; }
          .lp-nav-pill:hover .pill-icon { transform:scale(1.2); }
          .lp-price-card { border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:24px; background:rgba(255,255,255,0.03); transition:border-color .2s; }
          .lp-price-card:hover { border-color:rgba(255,255,255,0.2); }
          .lp-price-card.featured { border-color:#fbbf24; background:rgba(251,191,36,0.04); }
          .lp-check { color:#3ecf8e; margin-right:6px; }
          .lp-cross { color:#f87171; margin-right:6px; }
          .lp-star { position:absolute; border-radius:50%; background:#fff; animation:starTwinkle var(--dur,3s) var(--delay,0s) ease-in-out infinite; }
          .mock-panel { animation: panelFloat 5.8s ease-in-out infinite; }
          .mock-neon-wrap { border-radius:20px; padding:2px; background:linear-gradient(135deg,rgba(99,102,241,0.8),rgba(59,130,246,0.6),rgba(139,92,246,0.8)); box-shadow:0 0 40px rgba(99,102,241,0.5),0 0 80px rgba(59,130,246,0.25),0 0 120px rgba(139,92,246,0.15); }
          .feat-card { border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:22px 18px; background:rgba(255,255,255,0.025); transition:all .25s; cursor:default; }
          .feat-card:hover { border-color:rgba(255,215,0,0.3); background:rgba(255,215,0,0.04); transform:translateY(-3px); box-shadow:0 12px 32px rgba(0,0,0,0.4); }
          .stat-card { border-radius:14px; border:1px solid rgba(255,255,255,0.12); background:rgba(10,8,25,0.7); backdrop-filter:blur(10px); padding:18px 20px; display:flex; align-items:center; gap:16px; transition:border-color .2s,transform .2s; }
          .stat-card:hover { border-color:rgba(255,255,255,0.22); transform:translateY(-2px); }
        `}</style>

        {/* ambient glows — cyberpunk */}
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0 }}>
          {/* Orange/amber — top left */}
          <div style={{ position:'absolute', top:'-5%', left:'-8%', width:'60%', height:'65%', background:'radial-gradient(ellipse at 30% 30%,rgba(245,128,11,0.22) 0%,rgba(180,60,0,0.12) 35%,transparent 65%)' }} />
          {/* Blue — top right */}
          <div style={{ position:'absolute', top:'-5%', right:'-10%', width:'60%', height:'60%', background:'radial-gradient(ellipse at 70% 25%,rgba(59,130,246,0.22) 0%,rgba(99,40,240,0.14) 40%,transparent 65%)' }} />
          {/* Purple — center */}
          <div style={{ position:'absolute', top:'30%', left:'30%', width:'45%', height:'45%', background:'radial-gradient(ellipse,rgba(124,58,237,0.12) 0%,transparent 65%)', animation:'neonPulse 6s ease-in-out infinite' }} />
          {/* Cyan glow — bottom right */}
          <div style={{ position:'absolute', bottom:'5%', right:'10%', width:'40%', height:'40%', background:'radial-gradient(ellipse,rgba(6,182,212,0.1) 0%,transparent 65%)', animation:'orbFloat 9s ease-in-out infinite' }} />
          {/* Grid overlay */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(99,102,241,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.06) 1px,transparent 1px)', backgroundSize:'60px 60px', opacity:1 }} />
          {/* Diagonal scan lines */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)', opacity:0.4 }} />
          {/* Stars */}
          {[...Array(35)].map((_,i) => (
            <div key={i} className="lp-star" style={{
              width: Math.random()*2+1+'px', height: Math.random()*2+1+'px',
              top: Math.random()*100+'%', left: Math.random()*100+'%',
              '--dur': (Math.random()*4+2)+'s', '--delay': (Math.random()*5)+'s',
              opacity: Math.random()*0.5+0.15,
            }} />
          ))}
          {/* Floating neon orbs */}
          <div style={{ position:'absolute', top:'20%', right:'15%', width:380, height:380, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,40,240,0.12) 0%,transparent 65%)', animation:'orbFloat 14s ease-in-out infinite' }} />
          <div style={{ position:'absolute', top:'60%', left:'5%', width:240, height:240, borderRadius:'50%', background:'radial-gradient(circle,rgba(245,128,11,0.1) 0%,transparent 65%)', animation:'orbFloat 10s ease-in-out infinite reverse' }} />
          <div style={{ position:'absolute', bottom:'10%', right:'30%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(6,182,212,0.08) 0%,transparent 65%)', animation:'orbFloat 11s ease-in-out infinite 2s' }} />
        </div>

        {/* ── NAV ── */}
        <nav style={{ position:'sticky', top:0, zIndex:100, backdropFilter:'blur(18px)', background:'rgba(5,7,12,0.85)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding: lp ? '0 16px' : '0 40px', height:62, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          {/* Logo */}
          <div style={{ fontFamily:'Syne,system-ui', fontSize:22, fontWeight:800, lineHeight:1, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <span style={{ color:'#ffd700', textShadow:'0 0 14px rgba(255,215,0,0.5)', fontSize:20 }}>◈</span>
            <span style={{ background:'linear-gradient(135deg,#ffd700 0%,#ffaa00 55%,#ffd700 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Cicada</span>
            <span style={{ color:'rgba(255,255,255,0.45)', fontSize:13, fontWeight:400 }}>studio</span>
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
    <BlockInfoContext.Provider value={setBlockInfo}>
    <style>{`
      :root {
        --bg: #040018;
        --bg2: #090127;
        --bg3: #170848;
        --glass: rgba(21, 9, 68, 0.64);
        --glass-strong: rgba(33, 14, 96, 0.78);
        --panel: rgba(8, 3, 34, 0.78);
        --text: rgba(255,255,255,0.92);
        --text2: rgba(255,255,255,0.62);
        --text3: rgba(255,255,255,0.38);
        --border: rgba(121, 88, 255, 0.28);
        --border2: rgba(178, 128, 255, 0.42);
        --accent: #ff7a35;
        --accent2: #6f46ff;
        --cyan: #19d8ff;
        --violet: #8b5cf6;
        --hot: #ff3fd7;
        --mono: 'JetBrains Mono', ui-monospace, monospace;
      }
      @keyframes editorNeonPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
      @keyframes editorGridShift { from{background-position:0 0} to{background-position:60px 60px} }
      @keyframes editorOrbFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-22px) scale(1.04)} }
      @keyframes editorScanLine { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
      @keyframes editorStarDrift { from{background-position:0 0, 0 0} to{background-position:72px 54px, -44px 68px} }
      @keyframes blockEntrance { from{opacity:0;transform:translateY(-6px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
      @keyframes editorNewBlockBlink { 0%,100%{opacity:1;filter:drop-shadow(0 0 7px var(--new-block-glow,#f97316));transform:scale(1)} 50%{opacity:.42;filter:drop-shadow(0 0 18px var(--new-block-glow,#f97316));transform:scale(1.035)} }
      @keyframes neonBlink { 0%,90%,100%{opacity:1} 95%{opacity:0.6} }
      @keyframes editorRunPulse { 0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0)} 50%{box-shadow:0 0 0 6px rgba(249,115,22,0.25)} }
      .editor-shell::before,
      .editor-shell::after {
        content:''; position:absolute; pointer-events:none; z-index:0; filter:blur(4px);
      }
      .editor-shell::before {
        inset:-16% -10% auto -8%; height:54%;
        background:
          radial-gradient(circle at 18% 9%, rgba(25,216,255,.24), transparent 28%),
          radial-gradient(circle at 56% 4%, rgba(139,92,246,.42), transparent 36%),
          radial-gradient(circle at 86% 24%, rgba(255,63,215,.22), transparent 32%);
      }
      .editor-shell::after {
        inset:0;
        background:
          radial-gradient(circle, rgba(255,255,255,.12) 0 1px, transparent 1.4px),
          radial-gradient(circle, rgba(25,216,255,.12) 0 1px, transparent 1.5px),
          radial-gradient(circle at 50% 34%, rgba(111,70,255,.18), transparent 44%);
        background-size: 46px 46px, 88px 88px, auto;
        mask-image: linear-gradient(to bottom, rgba(0,0,0,.88), rgba(0,0,0,.4));
        animation: editorStarDrift 18s linear infinite;
      }
      .editor-topbar {
        background:
          linear-gradient(90deg, rgba(9,3,37,.92), rgba(42,13,116,.76) 48%, rgba(8,3,32,.94)),
          radial-gradient(circle at 38% -20%, rgba(25,216,255,.24), transparent 38%) !important;
        border-bottom: 1px solid rgba(255,122,53,.28) !important;
        box-shadow: 0 12px 42px rgba(8,2,30,.62), 0 0 32px rgba(111,70,255,.2), inset 0 1px 0 rgba(255,255,255,.1) !important;
        backdrop-filter: blur(24px) saturate(1.45);
        -webkit-backdrop-filter: blur(24px) saturate(1.45);
      }
      .editor-brand-logo {
        width: 29px; height: 29px; border-radius: 9px; object-fit: cover;
        box-shadow: 0 0 18px rgba(25,216,255,.38), 0 0 30px rgba(139,92,246,.28);
        filter: saturate(1.25) contrast(1.05);
      }
      @media (max-width: 360px) {
        .editor-brand-word { display: none; }
      }
      .editor-brand-mark {
        color:#21d6ff !important;
        text-shadow: 0 0 18px rgba(33,214,255,.72), 0 0 36px rgba(139,92,246,.55) !important;
      }
      .editor-subbar {
        position: relative; z-index: 80;
        min-height: 66px; padding: 11px 12px;
        display:flex; align-items:center; gap:12px;
        background:
          linear-gradient(90deg, rgba(9,4,34,.84), rgba(39,13,110,.62) 45%, rgba(9,4,34,.86)),
          radial-gradient(circle at 70% 10%, rgba(255,63,215,.12), transparent 38%);
        border-bottom: 1px solid rgba(121,88,255,.24);
        box-shadow: 0 12px 34px rgba(7,3,24,.42), inset 0 1px 0 rgba(255,255,255,.06);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }
      .editor-subbar-left,
      .editor-subbar-center,
      .editor-subbar-right {
        display:flex; align-items:center; gap:9px; min-width:0;
      }
      .editor-subbar-left { width: 126px; flex-shrink:0; }
      .editor-subbar-center { flex:1; }
      .editor-subbar-right { justify-content:flex-end; }
      .editor-chip {
        display:inline-flex; align-items:center; gap:7px;
        height:38px; padding:0 15px; border-radius:19px;
        background: linear-gradient(135deg, rgba(255,255,255,.07), rgba(111,70,255,.07));
        border: 1px solid rgba(178,128,255,.28);
        color: rgba(255,255,255,.82);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.09), 0 8px 22px rgba(5,2,20,.28);
        font-family: Syne, system-ui; font-size:12px; font-weight:700;
        white-space:nowrap;
      }
      .editor-chip.active {
        color:#fff;
        background: linear-gradient(135deg, rgba(255,122,53,.22), rgba(111,70,255,.18));
        border-color: rgba(255,122,53,.64);
        box-shadow: 0 0 18px rgba(255,122,53,.22), inset 0 1px 0 rgba(255,255,255,.12);
      }
      .editor-chip.small { width:38px; justify-content:center; padding:0; font-size:14px; border-radius:13px; }
      .editor-chip.hot {
        color:#fff; border-color: rgba(255,122,53,.42);
        background: linear-gradient(135deg, rgba(255,122,53,.95), rgba(255,79,216,.72));
        box-shadow: 0 0 22px rgba(255,122,53,.34);
      }
      .editor-chip.premium {
        color:#ffd29a;
        border-color: rgba(255,122,53,.48);
        background: linear-gradient(135deg, rgba(255,122,53,.16), rgba(255,63,215,.08));
      }
      .editor-chip.esphome {
        color: #d7fbe2;
        border-color: rgba(34, 197, 94, 0.55);
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.22), rgba(14, 165, 233, 0.1));
        box-shadow: 0 0 16px rgba(34, 197, 94, 0.18), inset 0 1px 0 rgba(255,255,255,.1);
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }
      .editor-chip.esphome:hover {
        transform: translateY(-1px);
        border-color: rgba(74, 222, 128, 0.75);
        box-shadow: 0 0 22px rgba(34, 197, 94, 0.32), inset 0 1px 0 rgba(255,255,255,.12);
      }
      @media (max-width: 768px) {
        .editor-subbar {
          min-height: 52px;
          padding: 8px 10px;
          gap: 8px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .editor-subbar-left { width: auto; flex-shrink: 0; }
        .editor-subbar-center { flex: 1; min-width: max-content; }
        .editor-subbar-right { display: none; }
        .editor-chip {
          height: 34px;
          padding: 0 11px;
          font-size: 11px;
          gap: 5px;
        }
      }
      .editor-main-grid {
        border-top: 1px solid rgba(255,255,255,.025);
        background: radial-gradient(circle at 48% 20%, rgba(116,61,255,.34), transparent 35%);
      }
      .editor-main-grid > * {
        min-height: 0;
      }
      .editor-sidebar-shell,
      .editor-right-panel {
        background:
          linear-gradient(180deg, rgba(11,4,43,.86), rgba(6,2,25,.95)),
          radial-gradient(circle at 50% 0%, rgba(111,70,255,.18), transparent 42%) !important;
        backdrop-filter: blur(20px) saturate(1.2);
        -webkit-backdrop-filter: blur(20px) saturate(1.2);
      }
      .editor-sidebar-shell {
        border-right: 1px solid rgba(121,88,255,.32) !important;
        box-shadow: 10px 0 34px rgba(5,2,20,.46), inset -1px 0 0 rgba(255,255,255,.025) !important;
      }
      .editor-right-panel {
        border-left: 1px solid rgba(121,88,255,.32) !important;
        box-shadow: -10px 0 34px rgba(5,2,20,.46), inset 1px 0 0 rgba(255,255,255,.025) !important;
      }
      .editor-panel-title {
        background: linear-gradient(90deg, rgba(25,216,255,.12), rgba(139,92,246,.12), transparent) !important;
        border-bottom: 1px solid rgba(121,88,255,.26) !important;
        color: rgba(205,217,255,.74) !important;
      }
      .canvas-bg {
        background:
          radial-gradient(circle at 56% 14%, rgba(153,89,255,.42), transparent 34%),
          radial-gradient(circle at 31% 78%, rgba(25,216,255,.12), transparent 38%),
          radial-gradient(circle at 84% 72%, rgba(255,63,215,.14), transparent 34%),
          linear-gradient(160deg, #060019 0%, #14053d 48%, #050116 100%) !important;
      }
      .canvas-bg::before {
        content:''; position:absolute; inset:0; pointer-events:none; z-index:0;
        background:
          linear-gradient(rgba(162,132,255,.09) 1px, transparent 1px),
          linear-gradient(90deg, rgba(162,132,255,.09) 1px, transparent 1px),
          radial-gradient(circle, rgba(255,255,255,.18) 0 1px, transparent 1.5px);
        background-size: 48px 48px, 48px 48px, 24px 24px;
        opacity:.62;
      }
      .canvas-bg::after {
        content:''; position:absolute; inset:0; pointer-events:none; z-index:0;
        background:
          radial-gradient(circle at center, transparent 0 45%, rgba(3,1,12,.28) 74%, rgba(3,1,12,.65) 100%),
          repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 4px);
      }
      .editor-empty-card {
        background: linear-gradient(180deg, rgba(21,9,68,.68), rgba(7,2,28,.74)) !important;
        border: 1px solid rgba(178,128,255,.25) !important;
        box-shadow: 0 28px 80px rgba(5,1,22,.66), 0 0 42px rgba(111,70,255,.16), inset 0 1px 0 rgba(255,255,255,.08) !important;
      }
      input, textarea, select {
        background: rgba(255,255,255,.045) !important;
        border-color: rgba(167,139,250,.25) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      }
      input:focus, textarea:focus, select:focus {
        border-color: rgba(33,214,255,.62) !important;
        box-shadow: 0 0 0 3px rgba(33,214,255,.08), inset 0 1px 0 rgba(255,255,255,.05);
      }
      select option {
        background: #12072f;
        color: #f8fafc;
      }
      select option:checked {
        background: #2563eb;
        color: #fff;
      }
      .tb-btn, .editor-chip, .editor-mobile-tab, .editor-panel-title, .editor-subbar {
        font-family: Syne, system-ui, sans-serif;
      }
      .tb-btn {
        display: inline-flex; align-items: center; gap: 4px;
        min-width: 38px; height: 34px; justify-content: center;
        padding: 0 12px; border-radius: 12px; font-size: 11px; font-weight: 700;
        cursor: pointer; transition: all 0.18s ease; white-space: nowrap;
        font-family: Syne, system-ui; letter-spacing: 0.01em; line-height: 1;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
      }
      .tb-btn-ghost {
        background: linear-gradient(135deg, rgba(255,255,255,0.07), rgba(111,70,255,0.08));
        color: rgba(255,255,255,0.74);
        border: 1px solid rgba(178,128,255,0.3);
      }
      .tb-btn-ghost:hover { background: rgba(127,92,255,0.18); color: rgba(255,255,255,0.94); border-color: rgba(167,139,250,0.55); box-shadow:0 0 18px rgba(127,92,255,.18); }
      .tb-btn-danger { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
      .tb-btn-danger:hover { background: rgba(239,68,68,0.18); color: #fca5a5; border-color: rgba(239,68,68,0.5); }
      .tb-btn-green { background: rgba(62,207,142,0.08); color: #3ecf8e; border: 1px solid rgba(62,207,142,0.22); }
      .tb-btn-green:hover { background: rgba(62,207,142,0.18); border-color: #3ecf8e; }
      .tb-btn-blue { background: rgba(96,165,250,0.08); color: #60a5fa; border: 1px solid rgba(96,165,250,0.22); }
      .tb-btn-blue:hover { background: rgba(96,165,250,0.18); border-color: #60a5fa; }
      .tb-btn-purple { background: rgba(167,139,250,0.08); color: #a78bfa; border: 1px solid rgba(167,139,250,0.22); }
      .tb-btn-purple:hover { background: rgba(167,139,250,0.18); border-color: #a78bfa; }
      .tb-btn-run {
        background: linear-gradient(135deg,#f97316,#dc2626); color:#fff;
        border:1px solid rgba(255,205,132,.2); font-weight:800; font-size:13px;
        min-width: 82px; border-radius: 18px;
        box-shadow:0 2px 18px rgba(249,115,22,0.48), inset 0 1px 0 rgba(255,255,255,.24);
        animation: editorRunPulse 2.5s ease-in-out infinite;
      }
      .tb-btn-run:hover { background:linear-gradient(135deg,#fb923c,#ef4444); box-shadow:0 4px 20px rgba(249,115,22,0.6); transform:translateY(-1px); }
      .tb-btn-run:disabled { background:rgba(249,115,22,0.15); color:rgba(249,115,22,0.35); box-shadow:none; cursor:not-allowed; transform:none; animation:none; }
      .tb-btn-stop {
        background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff;
        border:none; font-weight:700;
        box-shadow:0 2px 14px rgba(239,68,68,0.4);
      }
      .tb-btn-stop:hover { background:linear-gradient(135deg,#f87171,#ef4444); box-shadow:0 4px 18px rgba(239,68,68,0.6); transform:translateY(-1px); }
      .tb-divider { width:1px; height:22px; background:rgba(99,102,241,0.22); flex-shrink:0; }
      .tb-btn-ai {
        background:linear-gradient(135deg,rgba(25,216,255,0.14),rgba(139,92,246,0.16));
        color:#8beaff; border:1px solid rgba(25,216,255,0.38); font-weight:700;
      }
      .tb-btn-ai:hover {
        background:linear-gradient(135deg,rgba(33,214,255,0.22),rgba(139,92,246,0.24));
        border-color:rgba(33,214,255,0.72); color:#fff; box-shadow:0 0 18px rgba(33,214,255,0.22);
      }
      .tb-btn.locked-premium {
        opacity:.64;
        filter:saturate(.58);
        cursor:pointer;
        border-color:rgba(251,191,36,.28);
      }
      .tb-btn.locked-premium:hover {
        opacity:.92;
        filter:saturate(.85);
        color:#fde68a;
        border-color:rgba(251,191,36,.55);
        box-shadow:0 0 18px rgba(251,191,36,.16);
      }
      .tb-files-menu {
        background: var(--bg2); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px; min-width: 186px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6); overflow: hidden;
      }
      .tb-files-menu-item {
        width: 100%; padding: 10px 14px; text-align: left;
        background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.06);
        cursor: pointer; font-size: 12px; font-family: Syne,system-ui;
        display: flex; align-items: center; gap: 8px; transition: background 0.15s;
        color: var(--text);
      }
      .tb-files-menu-item:last-child { border-bottom: none; }
      .tb-files-menu-item:hover { background: rgba(255,255,255,0.06); }
      .tb-files-menu-item.locked-premium { color: rgba(253,230,138,0.72); filter:saturate(.6); }
      .tb-files-menu-item.locked-premium:hover { color:#fde68a; background:rgba(251,191,36,0.07); }
      .editor-sidebar-block { border-left: 2px solid transparent; }
      .editor-sidebar-block:hover {
        background:linear-gradient(90deg, rgba(127,92,255,0.18), rgba(33,214,255,0.04)) !important;
        border-left-color: rgba(139,92,246,.95);
        transform: translateX(2px);
      }
      .editor-group-header { 
        padding:11px 12px 5px; font-size:9px; letter-spacing:.14em; text-transform:uppercase; font-weight:800;
        border-top:1px solid rgba(127,92,255,0.16); color:rgba(167,139,250,0.68);
        display:flex; align-items:center; gap:6px;
      }
      .editor-group-header::after { content:''; flex:1; height:1px; background:linear-gradient(90deg,rgba(33,214,255,0.32),transparent); }
      .editor-mobile-tab { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; background:transparent; border:none; cursor:pointer; border-top:2px solid transparent; min-width:0; transition:all 0.18s; }
      .editor-mobile-tab.active { border-top-color:#f97316; }
      .editor-mobile-tab.locked-premium { opacity:.58; filter:saturate(.55); }
      .editor-mobile-tab.locked-premium:hover { opacity:.86; filter:saturate(.82); }
      .editor-mobile-tab .tab-icon { font-size:16px; }
      .editor-mobile-tab .tab-label { font-size:9px; font-family:Syne,system-ui; font-weight:600; white-space:nowrap; color:var(--text3); }
      .editor-mobile-tab.active .tab-label { color:#f97316; text-shadow:0 0 8px rgba(249,115,22,0.5); }
      * { scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.3) transparent; }
      *::-webkit-scrollbar { width:4px; height:4px; }
      *::-webkit-scrollbar-track { background:transparent; }
      *::-webkit-scrollbar-thumb { background:rgba(99,102,241,0.35); border-radius:4px; }
      *::-webkit-scrollbar-thumb:hover { background:rgba(249,115,22,0.5); }
    `}</style>
    <div
      className="editor-shell"
      style={{ display:'flex', flexDirection:'column', height:'var(--app-height, 100vh)', background:'var(--bg)', position:'relative', overflow:'hidden' }}
    >
      {/* Top bar */}
      <div className="editor-topbar" style={{
        background: 'linear-gradient(90deg, #0d0920 0%, #080618 100%)',
        borderBottom: '1px solid rgba(99,102,241,0.25)',
        boxShadow: '0 1px 0 rgba(249,115,22,0.08), 0 4px 24px rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', padding: isMobileView ? '0 8px' : '0 18px', gap: isMobileView ? 6 : 10,
        flexShrink: 0, height: isMobileView ? 52 : 64,
        overflow: 'visible',
        position: 'relative', zIndex: 90,
      }}>
        {/* Left neon accent line */}
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:'linear-gradient(180deg, #f97316, #6366f1)', borderRadius:'0 2px 2px 0', opacity:0.9 }} />
        <div style={{ fontFamily:'Syne, system-ui', fontWeight:800, fontSize:isMobileView ? 18 : 22, color:'var(--text)', flexShrink: isMobileView ? 1 : 0, minWidth: 0, paddingLeft: 2, display:'flex', alignItems:'center', gap:isMobileView ? 6 : 8 }}>
          <img src={cicadaLogo} alt="" className="editor-brand-logo" />
          <div style={{ display:'flex', alignItems:'baseline', lineHeight:1 }}>
            <span className="editor-brand-word" style={{ background: 'linear-gradient(135deg, #19d8ff 0%, #a78bfa 56%, #ff7a35 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Cicada</span>
            {!isMobileView && <span style={{ fontSize:13, background:'linear-gradient(135deg,#8b5cf6,#d8b4fe)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', marginLeft:7, fontWeight:500, opacity:0.84 }}>Studio</span>}
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
        {/* Desktop-only buttons */}
        {!isMobileView && (
          <>
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
              onClick={() => { setPreviewPanelOpen(v => !v); setPreviewErr(null); }}
              style={previewPanelOpen ? { outline: '1px solid rgba(56,189,248,0.55)', borderRadius: 8 } : undefined}
            >💬</button>
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
          </>
        )}

        {currentUser ? (
          <>
            <div style={{ flex:1 }} />
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
          </>
        ) : (
          <>
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
          </>
        )}
        {!isMobileView && (
          <button
            className="tb-btn tb-btn-ghost"
            data-tour="top-help-desktop"
            onClick={() => setShowInstructions(true)}
            style={{ marginLeft: 6 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#fbbf24'; e.currentTarget.style.color = '#fbbf24'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
          >📖</button>
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

      {currentUser && (
        <div className="editor-subbar">
          <div className="editor-subbar-left">
            <div className="editor-chip active">
              <span style={{ color: '#ffb86b' }}>🧱</span>
              {builderUi.mobileTabBlocks}
            </div>
          </div>
          <div className="editor-subbar-center">
            <button
              type="button"
              className="editor-chip"
              onClick={() => setShowLibrary(true)}
              title={builderUi.moduleLibrary}
            >
              <span style={{ color: '#8b5cf6' }}>📚</span>
              {builderUi.moduleLibrary}
            </button>
            <button
              type="button"
              className="editor-chip esphome"
              onClick={() => openEsphomeConstructor({
                projectId: activeProjectId,
                projectName: projectName.trim() || undefined,
              })}
              title={builderUi.espHome}
            >
              <span style={{ color: '#4ade80' }}>⚡</span>
              {builderUi.espHome}
            </button>
          </div>
          <div className="editor-subbar-right">
            <div className="editor-chip" title="Текущее время">
              ◷ {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button
              type="button"
              className="editor-chip small"
              onClick={() => setShowInstructions(true)}
              title="Помощь"
            >
              ⌕
            </button>
          </div>
        </div>
      )}

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
      {showAIModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))',
          boxSizing: 'border-box',
          backdropFilter: 'blur(4px)',
        }} onClick={() => !aiLoading && setShowAIModal(false)}>
          <div style={{
            width: '90%', maxWidth: 520,
            maxHeight: 'min(90dvh, calc(100% - 24px))',
            background: 'var(--bg2)', borderRadius: 16,
            border: '1px solid rgba(251,191,36,0.25)',
            boxShadow: '0 0 60px rgba(251,191,36,0.08), 0 24px 60px rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{
              padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(251,191,36,0.06) 0%, transparent 100%)',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24', fontFamily: 'Syne, system-ui', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ✨ Создать бота с AI
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                  Опиши бота — AI сгенерирует схему блоков. Короткого запроса обычно мало: нужны состояния, кнопки и переходы.
                </div>
              </div>
              <button
                onClick={() => setShowAIModal(false)}
                disabled={aiLoading}
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', fontSize: 18, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: aiLoading ? 0.4 : 1 }}
              >×</button>
            </div>

            {/* Body — scrollable when diagnostics / long errors overflow viewport */}
            <div
              style={{
                padding: '20px',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
              }}
            >
              {/* Примеры подсказки */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                {[
                  { label: 'Бот приветствует и показывает меню', text: 'Бот приветствует и показывает меню' },
                  { label: 'Заказ: имя и телефон', text: 'Бот принимает заказы, спрашивает имя и телефон' },
                  { label: 'Бот калькулятор', text: 'Бот калькулятор' },
                  { label: 'Бот с оплатой подписки', text: 'Бот с оплатой подписки' },
                ].map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    title={ex.text.length > 80 ? 'Вставить подробное техническое описание сценария' : undefined}
                    onClick={() => setAiPrompt(ex.text.slice(0, AI_PROMPT_MAX_CHARS))}
                    disabled={aiLoading}
                    style={{
                      padding: '5px 10px', borderRadius: 20, fontSize: 11,
                      background: 'rgba(251,191,36,0.07)', color: '#fbbf24',
                      border: '1px solid rgba(251,191,36,0.2)', cursor: 'pointer',
                      fontFamily: 'system-ui', transition: 'all 0.15s',
                      opacity: aiLoading ? 0.5 : 1,
                      maxWidth: '100%',
                    }}
                  >{ex.label}</button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                value={aiPrompt}
                onChange={(e) => {
                  setAiPrompt(e.target.value.slice(0, AI_PROMPT_MAX_CHARS));
                  if (aiPartialResult?.skeletonFallback) {
                    setAiPartialResult(null);
                    setAiDiagnosticsOpen(false);
                  }
                }}
                disabled={aiLoading}
                maxLength={AI_PROMPT_MAX_CHARS}
                placeholder="Опиши идею бота до 50 символов"
                rows={10}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, padding: '12px 14px',
                  color: 'var(--text)', fontSize: 13, lineHeight: 1.6,
                  fontFamily: 'system-ui', resize: 'vertical',
                  outline: 'none', transition: 'border 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(251,191,36,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
              <div style={{ marginTop: 6, textAlign: 'right', fontSize: 11, color: aiPromptTooLong ? '#f87171' : 'var(--text3)' }}>
                {aiPrompt.length}/{AI_PROMPT_MAX_CHARS}
              </div>

              {/* Error */}
              {aiError && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 12 }}>
                  {aiError}
                </div>
              )}

              {aiPartialResult && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: 'rgba(15,23,42,0.58)',
                    border: '1px solid rgba(251,191,36,0.22)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {aiPartialResult.executionMode === 'FALLBACK_SKELETON' && (
                    <div
                      role="alert"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'rgba(245,158,11,0.14)',
                        border: '1px solid rgba(245,158,11,0.32)',
                        color: '#fbbf24',
                        fontSize: 12,
                        fontWeight: 800,
                        lineHeight: 1.45,
                      }}
                    >
                      Запущен аварийный режим (без AI логики)
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 800 }}>
                        {aiPartialResult.skeletonFallback
                          ? 'Аварийный сценарий готов'
                          : aiPartialResult.templateMode
                            ? 'Готовый шаблон собран'
                            : aiPartialResult.recoveryMode
                            ? 'Сценарий оптимизирован для стабильного выполнения'
                            : 'Сценарий сгенерирован частично'}
                      </div>
                      <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text3)', lineHeight: 1.45 }}>
                        {aiPartialResult.skeletonFallback
                          ? 'Упрощённая схема без сложной логики — можно применить и доработать вручную.'
                          : aiPartialResult.templateMode
                            ? 'Использован проверенный шаблон — можно сразу применить на холст и доработать.'
                          : aiPartialResult.recoveryMode
                            ? 'Первая попытка AI не собрала полную схему; применена упрощённая рабочая версия.'
                          : aiPartialResult.canRunPartial
                            ? 'Часть сценария готова — можно добавить на холст и проверить.'
                            : 'Автоматически применить схему нельзя — попробуйте сгенерировать снова или упростите запрос.'}
                      </div>
                    </div>
                  </div>

                  {!aiDiagnosticsOpen && aiPartialResult.sections.whatWorks.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--text3)', lineHeight: 1.55 }}>
                      {aiPartialResult.sections.whatWorks.slice(0, 4).map((item, index) => (
                        <li key={`${item.code || 'work'}-${index}`}>{item.title}{item.detail ? ` — ${item.detail}` : ''}</li>
                      ))}
                    </ul>
                  )}

                  {aiDiagnosticsOpen && (
                    <>
                      {(aiPartialResult.executionMode || aiPartialResult.rootCause) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{
                            padding: '3px 7px',
                            borderRadius: 999,
                            background: aiPartialResult.aiConfidenceLabel === 'HIGH'
                              ? 'rgba(34,197,94,0.1)'
                              : aiPartialResult.aiConfidenceLabel === 'MEDIUM'
                                ? 'rgba(245,158,11,0.1)'
                                : 'rgba(248,113,113,0.1)',
                            color: aiPartialResult.aiConfidenceLabel === 'HIGH'
                              ? '#86efac'
                              : aiPartialResult.aiConfidenceLabel === 'MEDIUM'
                                ? '#fbbf24'
                                : '#fca5a5',
                            border: '1px solid rgba(255,255,255,0.14)',
                            fontFamily: 'var(--mono, ui-monospace, monospace)',
                            fontSize: 10,
                          }}>
                            уверенность: {aiPartialResult.aiConfidenceLabel}
                          </span>
                          {aiPartialResult.executionMode && (
                            <span style={{ padding: '3px 7px', borderRadius: 999, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.18)', fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: 10 }}>
                              режим: {aiPartialResult.executionMode}
                            </span>
                          )}
                          {aiPartialResult.rootCause && (
                            <span style={{ padding: '3px 7px', borderRadius: 999, background: 'rgba(248,113,113,0.1)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.18)', fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: 10 }}>
                              причина: {aiPartialResult.rootCause}
                            </span>
                          )}
                          <span style={{
                            padding: '3px 7px',
                            borderRadius: 999,
                            fontFamily: 'var(--mono, ui-monospace, monospace)',
                            fontSize: 10,
                            color: aiPartialResult.safeToRun ? '#86efac' : '#fca5a5',
                            background: aiPartialResult.safeToRun ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)',
                            border: aiPartialResult.safeToRun ? '1px solid rgba(34,197,94,0.22)' : '1px solid rgba(248,113,113,0.22)',
                          }}>
                            можно применить: {aiPartialResult.safeToRun ? 'да' : 'нет'}
                          </span>
                        </div>
                      )}

                      {aiPartialResult.reasonCodes.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {aiPartialResult.reasonCodes.map((code) => (
                            <span
                              key={code}
                              style={{
                                padding: '3px 7px',
                                borderRadius: 999,
                                background: 'rgba(59,130,246,0.1)',
                                color: '#93c5fd',
                                border: '1px solid rgba(59,130,246,0.18)',
                                fontFamily: 'var(--mono, ui-monospace, monospace)',
                                fontSize: 10,
                              }}
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      )}

                      <AiDiagnosticSection
                        title="Что готово"
                        items={aiPartialResult.sections.whatWorks}
                        emptyText="Запущена базовая версия сценария (без сложной логики)."
                      />
                      <AiDiagnosticSection
                        title="Что исправлено"
                        items={aiPartialResult.sections.whatWasFixed}
                        emptyText="Автоисправления не применялись."
                      />
                      <AiDiagnosticSection
                        title="Что не удалось"
                        items={aiPartialResult.sections.whatFailed}
                        emptyText="Оставшихся диагностик нет."
                      />
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={!aiPartialResult.canRunPartial || aiLoading}
                      onClick={() => applyAiGeneratedStacks(aiPartialResult.raw.stacks, {
                        partial: true,
                        skeletonFallback: aiPartialResult.skeletonFallback,
                        templateMode: aiPartialResult.templateMode,
                        templateLabel: aiPartialResult.raw?.meta?.semanticTemplate === 'calculator'
                          ? 'Калькулятор'
                          : aiPartialResult.raw?.meta?.semanticTemplate,
                        recoveryMode: aiPartialResult.recoveryMode,
                      })}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 9,
                        border: '1px solid rgba(34,197,94,0.25)',
                        background: aiPartialResult.canRunPartial ? 'rgba(34,197,94,0.16)' : 'rgba(34,197,94,0.06)',
                        color: aiPartialResult.canRunPartial ? '#86efac' : 'rgba(134,239,172,0.35)',
                        cursor: aiPartialResult.canRunPartial && !aiLoading ? 'pointer' : 'not-allowed',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {aiPartialResult.skeletonFallback
                        ? 'Применить аварийный сценарий'
                        : aiPartialResult.templateMode || aiPartialResult.recoveryMode
                          ? 'Применить на холст'
                          : 'Применить частично'}
                    </button>
                    {!aiPartialResult.skeletonFallback && (
                      <button
                        type="button"
                        disabled={aiLoading || aiPromptTooShort || aiPromptTooLong}
                        onClick={runAiGeneration}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 9,
                          border: '1px solid rgba(251,191,36,0.25)',
                          background: 'rgba(251,191,36,0.1)',
                          color: '#fbbf24',
                          cursor: aiLoading || aiPromptTooShort || aiPromptTooLong ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        Сгенерировать снова
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAiDiagnosticsOpen((open) => !open)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 9,
                        border: '1px solid rgba(148,163,184,0.22)',
                        background: 'rgba(148,163,184,0.08)',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {aiDiagnosticsOpen ? 'Скрыть подробности' : 'Подробности'}
                    </button>
                  </div>

                  {aiDiagnosticsOpen && (
                    <pre
                      style={{
                        margin: 0,
                        maxHeight: 180,
                        overflow: 'auto',
                        padding: 10,
                        borderRadius: 8,
                        background: 'rgba(0,0,0,0.24)',
                        color: '#cbd5e1',
                        fontSize: 10,
                        lineHeight: 1.45,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {JSON.stringify({
                        status: aiPartialResult.status,
                        reason: aiPartialResult.reason,
                        reasonCodes: aiPartialResult.reasonCodes,
                        executionMode: aiPartialResult.executionMode,
                        rootCause: aiPartialResult.rootCause,
                        aiConfidenceLabel: aiPartialResult.aiConfidenceLabel,
                        executionDecisionScore: aiPartialResult.executionDecisionScore,
                        isDegraded: aiPartialResult.isDegraded,
                        isAIGenerated: aiPartialResult.isAIGenerated,
                        diagnostics: aiPartialResult.raw.diagnostics || [],
                        repairActions: aiPartialResult.raw.repairActions || [],
                        userActions: aiPartialResult.userActions,
                      }, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => setShowAIModal(false)}
                disabled={aiLoading}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10, fontSize: 13,
                  background: 'rgba(255,255,255,0.05)', color: 'var(--text3)',
                  border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: 'Syne, system-ui',
                }}
              >Отмена</button>
              <button
                disabled={!canSubmitAiPrompt}
                onClick={runAiGeneration}
                style={{
                  flex: 2, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: !canSubmitAiPrompt
                    ? 'rgba(251,191,36,0.15)'
                    : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: !canSubmitAiPrompt ? 'rgba(251,191,36,0.4)' : '#000',
                  border: 'none', cursor: !canSubmitAiPrompt ? 'not-allowed' : 'pointer',
                  fontFamily: 'Syne, system-ui', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {aiLoading ? (
                  <>
                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(251,191,36,0.3)', borderTopColor: '#fbbf24', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    {AI_GEN_LOADING_STEPS[aiLoadingStep]}
                  </>
                ) : aiPartialResult?.skeletonFallback ? 'Измените описание для новой попытки' : '✨ Сгенерировать'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAIModal && aiLoading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10040,
            background: 'rgba(8,10,18,0.88)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          aria-busy="true"
          aria-live="polite"
        >
          <style>{`
            @keyframes aiGenPulse {
              0%, 100% { opacity: 0.35; transform: scale(0.92); }
              50% { opacity: 0.9; transform: scale(1.05); }
            }
            @keyframes aiGenSpin {
              to { transform: rotate(360deg); }
            }
            @keyframes aiGenShimmer {
              0% { background-position: -200% center; }
              100% { background-position: 200% center; }
            }
            @keyframes aiGenDot {
              0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
              40% { opacity: 1; transform: translateY(-3px); }
            }
          `}</style>
          <div
            style={{
              width: 'min(440px, 100%)',
              padding: '40px 36px',
              borderRadius: 22,
              background: 'linear-gradient(165deg, rgba(28,30,38,0.97) 0%, rgba(12,14,20,0.99) 100%)',
              border: '1px solid rgba(251,191,36,0.38)',
              boxShadow:
                '0 0 0 1px rgba(251,191,36,0.1), 0 28px 90px rgba(0,0,0,0.72), 0 0 140px rgba(251,191,36,0.07)',
              textAlign: 'center',
              fontFamily: 'Syne, system-ui, sans-serif',
            }}
          >
            <div style={{ position: 'relative', width: 92, height: 92, margin: '0 auto 26px' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: -10,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(251,191,36,0.28) 0%, transparent 68%)',
                  animation: 'aiGenPulse 2.2s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '3px solid rgba(251,191,36,0.18)',
                  borderTopColor: '#fbbf24',
                  borderRightColor: 'rgba(251,191,36,0.45)',
                  animation: 'aiGenSpin 1s linear infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 16,
                  borderRadius: 18,
                  background: 'linear-gradient(145deg, rgba(251,191,36,0.2), rgba(245,158,11,0.06))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 38,
                  lineHeight: 1,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                ✨
              </div>
            </div>
            <div
              style={{
                fontSize: 23,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(90deg, #fef3c7, #fbbf24, #d97706, #fbbf24, #fef3c7)',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                animation: 'aiGenShimmer 2.8s linear infinite',
                marginBottom: 14,
              }}
            >
              Создаём вашего бота
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'rgba(226,232,240,0.92)',
                lineHeight: 1.55,
                minHeight: 46,
                transition: 'opacity 0.35s ease',
              }}
            >
              {AI_GEN_LOADING_STEPS[aiLoadingStep]}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 6,
                marginTop: 18,
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#fbbf24',
                    animation: `aiGenDot 1.2s ease-in-out ${i * 0.18}s infinite`,
                  }}
                />
              ))}
            </div>
            <div style={{ marginTop: 22, fontSize: 11, color: 'rgba(148,163,184,0.88)', lineHeight: 1.45 }}>
              Подождите — AI собирает и проверяет сценарий. Обычно это от нескольких секунд до минуты.
            </div>
          </div>
        </div>
      )}
      {showInstructions && (
          <InstructionsModal lang={uiLang} onClose={() => setShowInstructions(false)} />
        )}

      {/* Справка по блоку — кнопка «i» на пазле */}
      {blockInfo && (
        <BlockInfoModal block={blockInfo} onClose={() => setBlockInfo(null)} />
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
                setPreviewErr(null);
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

      {currentUser ? (
        /* Main layout */
        <>
        <div className="editor-main-grid" style={{ display:'grid', gridTemplateColumns: isMobileView ? '1fr' : '150px minmax(0, 1fr) 258px', overflow:'hidden', flex: 1, minHeight: 0, height: '100%', position: 'relative', zIndex: 1 }}>

        {/* Sidebar — hidden on mobile unless blocks tab */}
        {(isMobileView && mobileTab !== 'blocks') ? null : (
        <div className="editor-sidebar-shell" style={{
          background:'linear-gradient(180deg, #0d0920 0%, #080618 100%)',
          borderRight: isMobileView ? 'none' : '1px solid rgba(99,102,241,0.2)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          boxShadow: isMobileView ? 'none' : '4px 0 24px rgba(0,0,0,0.4)',
          ...(isMobileView ? { gridColumn: '1', position: 'absolute', top: 0, left: 0, right: 0, bottom: 56, zIndex: 6 } : {}),
        }}
        data-tour={!isMobileView ? 'sidebar-desktop' : undefined}>
          <div className="editor-panel-title" style={{
            padding:'10px 12px 5px', fontSize:9,
            background:'linear-gradient(90deg,rgba(99,102,241,0.12),transparent)',
            borderBottom:'1px solid rgba(99,102,241,0.15)',
            color:'rgba(99,102,241,0.7)', textTransform:'uppercase', letterSpacing:'.14em', fontWeight:700,
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span style={{ color:'#f97316', fontSize:12 }}>🧱</span> {builderUi.mobileTabBlocks}
          </div>
          <Sidebar
            onDragStart={setDraggingPaletteEntry}
            onDragEnd={endPaletteDrag}
            onTapAdd={isMobileView ? addBlockFromPaletteTap : null} />
        </div>
        )}

        {/* Canvas — ReactFlow GraphDocument-native renderer */}
        {(isMobileView && mobileTab !== 'canvas' && mobileTab !== 'dsl') ? null : (
        <div
          ref={canvasRef}
          data-tour="canvas-area"
          className="canvas-bg"
          style={{
            position:'relative', overflow:'hidden',
            width: '100%', height: '100%', minHeight: 0,
            background: 'linear-gradient(160deg, #06030f 0%, #0a0518 50%, #080615 100%)',
            ...(isMobileView ? { gridColumn: '1', display: (mobileTab === 'canvas' || mobileTab === 'dsl') ? 'block' : 'none' } : {}),
          }}
        >
          {/* Ambient glow orbs */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0 }}>
            <div style={{ position:'absolute', top:'-10%', left:'15%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(ellipse,rgba(99,102,241,0.08) 0%,transparent 70%)', animation:'editorOrbFloat 9s ease-in-out infinite' }} />
            <div style={{ position:'absolute', bottom:'-5%', right:'10%', width:420, height:420, borderRadius:'50%', background:'radial-gradient(ellipse,rgba(249,115,22,0.06) 0%,transparent 70%)', animation:'editorOrbFloat 12s ease-in-out infinite reverse' }} />
            <div style={{ position:'absolute', top:'40%', right:'30%', width:260, height:260, borderRadius:'50%', background:'radial-gradient(ellipse,rgba(6,182,212,0.05) 0%,transparent 70%)', animation:'editorOrbFloat 7s ease-in-out infinite 2s' }} />
            <div style={{ position:'absolute', left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(99,102,241,0.15),rgba(249,115,22,0.1),transparent)', animation:'editorScanLine 8s linear infinite', opacity:0.6, pointerEvents:'none' }} />
          </div>

          {/* ReactFlow canvas — GraphDocument-native, no stack transforms */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <GraphCanvasActionsProvider value={graphCanvasActions}>
            <GraphCanvas
              graph={graph}
              projection={canvasProjection}
              selectedBlockId={selectedBlockId}
              repairHighlightNodeIds={
                repairHighlight.until > Date.now() ? repairHighlight.nodeIds : []
              }
              repairHighlightEdgeIds={
                repairHighlight.until > Date.now() ? repairHighlight.edgeIds : []
              }
              onSelectNode={handleSelectNode}
              onInspectNode={handleInspectNode}
              onConnectFeedback={handleConnectFeedback}
              onDropPaletteEntry={handleCanvasDrop}
              onRequestDeleteNodes={handleRequestDeleteNodes}
            />
          </GraphCanvasActionsProvider>
          </div>

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

          <CanvasOnboardingOverlay
            show={showCanvasOnboarding}
            builderUi={builderUi}
            canUseAiGenerator={canUseAiGenerator}
            onOpenAi={openAiGeneratorModal}
            onStartTour={() => { setTourStep(0); setTourActive(true); }}
          />

        </div>
        )}

        {/* Right panel: props + DSL — hidden on mobile unless props/dsl tab */}
        {(isMobileView && mobileTab !== 'props' && mobileTab !== 'dsl') ? null : (
        <div className="editor-right-panel" style={{
          display:'flex', flexDirection:'column',
          borderLeft: isMobileView ? 'none' : '1px solid rgba(99,102,241,0.2)', overflow:'hidden',
          background: 'linear-gradient(180deg, #0d0920 0%, #080618 100%)',
          boxShadow: isMobileView
            ? (mobileTab === 'dsl' ? '0 -10px 34px rgba(0,0,0,0.58)' : 'none')
            : '-4px 0 24px rgba(0,0,0,0.4)',
          minWidth: 0,
          minHeight: 0,
          height: isMobileView ? undefined : '100%',
          position: 'relative',
          zIndex: 2,
          ...(isMobileView ? {
            gridColumn: '1',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 56,
            zIndex: mobileTab === 'dsl' ? 80 : 6,
            borderTop: mobileTab === 'dsl' ? '1px solid rgba(99,102,241,0.3)' : undefined,
            borderRadius: 0,
            transition: 'top 0.22s ease, border-radius 0.22s ease',
          } : {}),
        }}
        data-tour={!isMobileView ? 'props-panel-desktop' : undefined}>
          {(!isMobileView || mobileTab === 'props') && (
            <>
              <div className="editor-panel-title" style={{
                borderBottom:'1px solid rgba(99,102,241,0.15)', padding:'8px 12px',
                fontSize:9, background:'linear-gradient(90deg,rgba(99,102,241,0.12),transparent)',
                color:'rgba(99,102,241,0.7)', textTransform:'uppercase', letterSpacing:'.14em', fontWeight:700,
                display:'flex', alignItems:'center', gap:6,
              }}><span style={{ color:'#06b6d4', fontSize:11 }}>✏️</span> {builderUi.propsHeader}</div>
              <div style={{ flex: isMobileView ? 1 : '1', minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                <PropsPanel
                  block={selectedBlock}
                  onChange={handlePropChange}
                  onKeyboardDataChange={handleKeyboardDataChange}
                  onAddAttachment={(kind) => handleAddFooterAction(selectedBlock?.id, kind)}
                  onAttachmentChange={handleAttachmentChange}
                  onAttachmentDelete={handleAttachmentDelete}
                  graphRefIndex={graphRefIndex}
                  graphDocument={graph.getGraphDocument()}
                  onJumpToNode={(nodeId) => nodeId && handleHighlightCompileNodes([nodeId])}
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
                />
              </div>
            </>
          )}
          {canSeeCode && (!isMobileView || mobileTab === 'dsl') && (
            <PythonPane
              getGraphDocument={graph.getGraphDocument}
              graphRevision={graphRevision}
              isMobile={isMobileView}
              onClose={undefined}
            />
          )}
          {!canSeeCode && (!isMobileView || mobileTab === 'dsl') && (
            <PremiumLockedPanel
              title="Код сценария доступен в Pro"
              text="Нажми, чтобы открыть меню покупки Premium."
              isMobile={isMobileView}
              onUpgrade={openPremiumPurchase}
            />
          )}
        </div>
        )}

      </div>

      {/* Mobile bottom navigation */}
      {isMobileView && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          display: 'flex',
          background: 'linear-gradient(180deg, #0d0920 0%, #06030f 100%)',
          borderTop: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.6)',
          height: 56,
          zIndex: 100,
        }}>
          {[
            { key: 'canvas', icon: '🎨', label: builderUi.mobileTabCanvas },
            { key: 'blocks', icon: '🧱', label: builderUi.mobileTabBlocks },
            { key: 'props',  icon: '✏️', label: builderUi.mobileTabProps },
            { key: 'dsl', icon: canSeeCode ? '📜' : '🔒', label: builderUi.mobileTabDsl, locked: !canSeeCode },
          ].map(tab => (
            <button
              key={tab.key}
              data-tour={tab.key === 'canvas' ? 'mobile-tab-canvas' : tab.key === 'blocks' ? 'mobile-tab-blocks' : tab.key === 'props' ? 'mobile-tab-props' : tab.key === 'dsl' ? 'mobile-tab-dsl' : undefined}
              onClick={() => {
                if (tab.locked) {
                  openPremiumPurchase();
                  return;
                }
                if (tab.key === 'dsl') {
                  setMobileTab(prev => prev === 'dsl' ? 'canvas' : 'dsl');
                  return;
                }
                setMobileTab(tab.key);
              }}
              className={`editor-mobile-tab${mobileTab === tab.key ? ' active' : ''}${tab.locked ? ' locked-premium' : ''}`}
              title={tab.locked ? 'Доступно в Pro' : undefined}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
          {/* Mobile Run/Stop Button */}
          {(() => { const _canRun = graphHasRunnableBot(graph, currentUser); return (
          <button
            data-tour="mobile-run"
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
          ); })()}
        </div>
      )}
        </>
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
              layoutAllFlowChains(graph);
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

      {currentUser && previewPanelOpen && (
        <div
          ref={previewPanelRef}
          style={{
            position: 'fixed',
            ...(previewPanelPos
              ? {
                  left: previewPanelPos.left,
                  top: previewPanelPos.top,
                  right: 'auto',
                  bottom: 'auto',
                  ...(isMobileView
                    ? { width: 'calc(100vw - 16px)', maxWidth: 420, height: 'min(480px, 52vh)' }
                    : { width: 340, height: 'min(480px, 52vh)' }),
                }
              : isMobileView
                ? { left: 8, right: 8, bottom: 72, top: '12vh', maxHeight: '70vh' }
                : { right: 20, bottom: 20, width: 340, height: 'min(480px, 52vh)' }),
            zIndex: 9600,
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(160deg,#111318,#0c0e13)',
            border: '1px solid rgba(56,189,248,0.28)',
            borderRadius: 14,
            boxShadow: '0 24px 50px rgba(0,0,0,0.55)',
            overflow: 'hidden',
            fontFamily: 'Syne,system-ui, sans-serif',
          }}
        >
          <div
            role="presentation"
            onMouseDown={startPreviewPanelDrag}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(56,189,248,0.06)',
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>
              Чат-превью
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { resetPreviewSession(); showToast('Сессия превью сброшена', 'info'); }}
                style={{
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '4px 8px',
                  fontSize: 11, color: 'rgba(226,232,240,0.85)', background: 'transparent', cursor: 'pointer',
                }}
              >
                Новая сессия
              </button>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setPreviewPanelOpen(false)}
                style={{
                  border: 'none', background: 'rgba(255,255,255,0.06)',
                  color: '#94a3b8', cursor: 'pointer', borderRadius: 8,
                  width: 30, height: 30, fontSize: 16, lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.9)', padding: '6px 12px', lineHeight: 1.45 }}>
            Сервер выполняет сценарий через mock Telegram (без вашего Bot API) на установленном ядре{' '}
            <span style={{ color: '#7dd3fc' }}>cicada-studio</span>.
          </div>
          <div
            ref={previewScrollRef}
            style={{
              flex: 1, minHeight: 0,
              overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
            }}
          >
            {previewMessages.length === 0 && (
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.85)', padding: '8px 0' }}>
            Например, отправьте <strong>/start</strong>, текст или файл (как в Telegram). Нажимайте кнопки — для превью это те же сообщения/callback.
              </div>
            )}
            {previewMessages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '92%',
                  borderRadius: 12,
                  padding: '8px 11px',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.45,
                  background:
                    m.role === 'user'
                      ? 'linear-gradient(135deg,#0369a1,#0ea5e9)'
                      : m.kind === 'sys'
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(30,41,59,0.85)',
                  color: m.role === 'user' ? '#f8fafc' : 'rgba(241,245,249,0.95)',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(148,163,184,0.15)',
                }}
              >
                {m.role === 'bot' && m.kind === 'reply_keyboard' && (m.text || '').trim().length > 0 && (
                  <div style={{ marginBottom: 8 }}><PreviewRichText text={m.text} format={m.format} /></div>
                )}
                {m.role === 'bot' && m.kind === 'inline_keyboard' && (m.text || '').trim().length > 0 && (
                  <div style={{ marginBottom: 8 }}><PreviewRichText text={m.text} format={m.format} /></div>
                )}
                {m.role === 'bot' && m.kind === 'text' && <span><PreviewRichText text={m.text} format={m.format} /></span>}
                {m.role === 'user' && m.kind === 'text' && <span>{m.text}</span>}
                {m.role === 'user' && (m.kind === 'document' || m.kind === 'photo') && (
                  <span>
                    {m.kind === 'photo' ? '🖼 ' : '📎 '}{m.fileName || 'файл'}
                    {m.caption ? `\n${m.caption}` : ''}
                  </span>
                )}
                {m.role === 'bot' && m.kind === 'sys' && (
                  <span style={{ opacity: 0.75, fontFamily: 'var(--mono,monospace)', fontSize: 10 }}>{m.text}</span>
                )}
                {m.role === 'bot' && m.kind === 'reply_keyboard' && Array.isArray(m.keyboard) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {m.keyboard.flatMap((row, ri) => (Array.isArray(row) ? row : []).map((lbl, ci) => (
                      <button
                        key={previewKeyboardButtonKey('reply', ri, ci, lbl)}
                        type="button"
                        disabled={previewBusy}
                        onClick={() => sendPreviewUserText(lbl)}
                        style={{
                          border: '1px solid rgba(56,189,248,0.35)',
                          background: 'rgba(14,165,233,0.12)',
                          color: '#e0f2fe', borderRadius: 8,
                          padding: '5px 9px', fontSize: 11, cursor: previewBusy ? 'wait' : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {lbl}
                      </button>
                    )))}
                  </div>
                )}
                {m.role === 'bot' && m.kind === 'inline_keyboard' && Array.isArray(m.rows) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {m.rows.map((row, ri) => (
                      <div key={`inline-row-${ri}-${(row || []).map((b) => previewKeyboardButtonKey('row', ri, 0, b)).join('|')}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(row || []).map((btn, bi) => {
                          const label = btn?.text ?? '';
                          const cd = normalizeCallbackData(
                            btn?.callback_data != null ? btn.callback_data : label,
                          );
                          const url = btn?.url;
                          if (url) {
                            const safeUrl = safePreviewHref(url);
                            if (!safeUrl) return null;
                            return (
                              <a
                                key={previewKeyboardButtonKey('inline-url', ri, bi, btn)}
                                href={safeUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  border: '1px solid rgba(167,139,250,0.45)',
                                  background: 'rgba(139,92,246,0.12)',
                                  color: '#ede9fe', borderRadius: 8,
                                  padding: '5px 9px', fontSize: 11,
                                  textDecoration: 'none',
                                }}
                              >
                                {label}
                              </a>
                            );
                          }
                          return (
                            <button
                              key={previewKeyboardButtonKey('inline', ri, bi, btn)}
                              type="button"
                              disabled={previewBusy || !cd}
                              onClick={() => sendPreviewCallback(cd)}
                              style={{
                                border: '1px solid rgba(167,139,250,0.35)',
                                background: 'rgba(139,92,246,0.12)',
                                color: '#ede9fe', borderRadius: 8,
                                padding: '5px 9px', fontSize: 11,
                                cursor: previewBusy ? 'wait' : 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              {label || cd}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {previewBusy && (
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.8)', alignSelf: 'center' }}>
                …
              </div>
            )}
          </div>
          {previewErr && (
            <div style={{ padding: '0 12px 8px', fontSize: 11, color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
              {previewErr}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid rgba(255,255,255,0.07)', alignItems: 'center' }}>
            <input
              ref={previewFileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) sendPreviewUserFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={previewBusy}
              title="Прикрепить файл"
              aria-label="Прикрепить файл"
              onClick={() => previewFileInputRef.current?.click()}
              style={{
                flexShrink: 0,
                width: 38,
                height: 38,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(15,23,42,0.75)',
                color: '#94a3b8',
                fontSize: 18,
                lineHeight: 1,
                cursor: previewBusy ? 'wait' : 'pointer',
              }}
            >
              📎
            </button>
            <button
              type="button"
              disabled={previewBusy}
              onClick={() => sendPreviewPaletteEvent({ kind: 'start', text: '/start' }, '/start')}
              style={{
                flexShrink: 0, padding: '0 10px', borderRadius: 8,
                border: '1px solid rgba(249,115,22,0.4)', background: 'rgba(249,115,22,0.1)',
                color: '#f97316', fontSize: 11, cursor: previewBusy ? 'wait' : 'pointer',
              }}
            >
              /start
            </button>
            <button
              type="button"
              disabled={previewBusy}
              title="Голосовое (on_voice)"
              onClick={sendPreviewUserVoice}
              style={{
                flexShrink: 0, padding: '0 8px', borderRadius: 8,
                border: '1px solid rgba(129,140,248,0.4)', background: 'rgba(129,140,248,0.1)',
                color: '#a5b4fc', fontSize: 11, cursor: previewBusy ? 'wait' : 'pointer',
              }}
            >
              🎤
            </button>
            <button
              type="button"
              disabled={previewBusy}
              title="Стикер (on_sticker)"
              onClick={sendPreviewUserSticker}
              style={{
                flexShrink: 0, padding: '0 8px', borderRadius: 8,
                border: '1px solid rgba(244,114,182,0.4)', background: 'rgba(244,114,182,0.1)',
                color: '#f9a8d4', fontSize: 11, cursor: previewBusy ? 'wait' : 'pointer',
              }}
            >
              🎭
            </button>
            <button
              type="button"
              disabled={previewBusy}
              title="Команда /help"
              onClick={() => sendPreviewUserCommand('/help')}
              style={{
                flexShrink: 0, padding: '0 8px', borderRadius: 8,
                border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.1)',
                color: '#fcd34d', fontSize: 11, cursor: previewBusy ? 'wait' : 'pointer',
              }}
            >
              /cmd
            </button>
            <input
              value={previewDraft}
              onChange={e => setPreviewDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendPreviewUserText(previewDraft);
                  setPreviewDraft('');
                }
              }}
              placeholder="Текст как в Telegram..."
              disabled={previewBusy}
              style={{
                flex: 1, borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(15,23,42,0.7)', color: '#f1f5f9',
                padding: '8px 10px', fontSize: 13, outline: 'none',
              }}
            />
            <button
              type="button"
              disabled={previewBusy}
              onClick={() => { sendPreviewUserText(previewDraft); setPreviewDraft(''); }}
              style={{
                flexShrink: 0, padding: '0 14px', borderRadius: 10,
                border: 'none', background: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
                color: '#fff', fontWeight: 700, fontSize: 12, cursor: previewBusy ? 'wait' : 'pointer',
              }}
            >
              Отпр.
            </button>
          </div>
        </div>
      )}

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

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: isMobileView ? 'auto' : 20,
          bottom: isMobileView ? 80 : 'auto',
          left: '50%',
          transform: toast.visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-20px)',
          opacity: toast.visible ? 1 : 0,
          transition: 'all 0.3s ease',
          zIndex: 9999,
          maxWidth: isMobileView ? '90%' : 400,
          width: 'auto',
        }}>
          <div style={{
            background: toast.type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
                        toast.type === 'success' ? 'linear-gradient(135deg, #3ecf8e 0%, #059669 100%)' :
                        'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            fontWeight: 500,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{ fontSize: 18 }}>
              {toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✅' : 'ℹ️'}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

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
  );
}
