import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { getCsrfTokenForRequest } from './csrf.js';
import { getConstructorStrings } from './builderI18n.js';
import { LIBRARY_CATEGORY_LABELS, LIBRARY_MODULE_LABELS } from './moduleLibraryBuiltinLabels.js';
import { BUILTIN_MODULE_CATEGORIES } from './modules/index.ts';
import { GRAPH_MODULE_REGISTRY, GRAPH_MODULE_SUITES } from './modules/graph/registry.js';
import { classifyModule, builtinListToById } from './modules/library/module_catalog.js';
import {
  runInsertionPreview,
  commitInsertion,
  runLegacyMigration,
  withAutoDependencies,
} from './modules/library/module_insertion_pipeline.js';
import { ModuleLibraryInsertPanel } from './builder/ModuleLibraryInsertPanel.jsx';
import { appAlert, appConfirm } from './dialog/appDialog.js';

function normalizeUiLang(lang) {
  const lc = String(lang || 'ru').toLowerCase();
  return lc === 'en' || lc === 'uk' ? lc : 'ru';
}

function categoryLabelRuKey(ruCategory, lang) {
  const lc = normalizeUiLang(lang);
  if (lc === 'ru') return ruCategory;
  return LIBRARY_CATEGORY_LABELS[lc]?.[ruCategory] || ruCategory;
}

function localizeBuiltinItem(mod, lang) {
  const lc = normalizeUiLang(lang);
  if (lc === 'ru') return mod;
  const patch = LIBRARY_MODULE_LABELS[lc]?.[mod.id];
  if (!patch) return mod;
  return { ...mod, name: patch.name, desc: patch.desc };
}

/** Inject bot token into graph document nodes. */
function injectTokenIntoGraphDocument(document, currentUser) {
  const token = (currentUser?.test_token || '').trim();
  if (!token || !document?.nodes) return document;
  const nodes = { ...document.nodes };
  for (const [id, node] of Object.entries(nodes)) {
    if (node.type !== 'bot') continue;
    nodes[id] = {
      ...node,
      data: { ...node.data, token },
    };
  }
  return { ...document, nodes };
}

// Graph-native modules: src/modules/graph/manifests/*.js (registry in graph/registry.js).
// Legacy DSL modules (code strings) are not merged — migration required.

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function libFetch(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const requestUrl = API_URL + path;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['x-csrf-token'] = await getCsrfTokenForRequest(requestUrl);
  }
  return fetch(requestUrl, { credentials: 'include', ...opts, headers });
}


// ─────────────────────────────────────────────────────────────────────────────
// СТИЛИ
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(6px)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    background: "#111114",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 18,
    width: "100%",
    maxWidth: 860,
    maxHeight: "88vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
  },
  header: {
    padding: "20px 24px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  title: {
    fontFamily: "Syne, system-ui",
    fontSize: 18,
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.01em",
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  },
  closeBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.6)",
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  searchWrap: {
    padding: "12px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  searchInput: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "9px 14px",
    color: "#fff",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: 210,
    borderRight: "1px solid rgba(255,255,255,0.06)",
    overflowY: "auto",
    flexShrink: 0,
    padding: "10px 0",
  },
  catBtn: (active) => ({
    width: "100%",
    padding: "9px 16px",
    textAlign: "left",
    background: active ? "rgba(255,215,0,0.1)" : "transparent",
    border: "none",
    borderLeft: active ? "2px solid #ffd700" : "2px solid transparent",
    color: active ? "#ffd700" : "rgba(255,255,255,0.55)",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "Syne, system-ui",
    fontWeight: active ? 700 : 500,
    transition: "all 0.15s",
    lineHeight: 1.4,
  }),
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 20px",
  },
  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 10,
  },
  moduleCard: (selected) => ({
    background: selected ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${selected ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 12,
    padding: "13px 14px",
    cursor: "pointer",
    transition: "all 0.15s",
  }),
  moduleName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    fontFamily: "Syne, system-ui",
    marginBottom: 4,
  },
  moduleDesc: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    lineHeight: 1.5,
  },
  previewPanel: {
    borderTop: "1px solid rgba(255,255,255,0.07)",
    padding: "14px 20px",
    flexShrink: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
  },
  codePreview: {
    flex: 1,
    background: "#0d0d0f",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "10px 14px",
    fontFamily: "monospace",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    maxHeight: 110,
    overflowY: "auto",
    whiteSpace: "pre",
  },
  insertBtn: {
    background: "linear-gradient(135deg,#ffd700,#ffaa00)",
    border: "none",
    borderRadius: 10,
    padding: "12px 22px",
    color: "#111",
    fontWeight: 800,
    fontFamily: "Syne, system-ui",
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 16px rgba(255,215,0,0.35)",
    flexShrink: 0,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.2)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    padding: "14px 16px 6px",
    fontFamily: "Syne, system-ui",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    color: "rgba(255,255,255,0.25)",
    fontSize: 14,
    fontFamily: "Syne, system-ui",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// КОМПОНЕНТ МОДАЛЬНОЙ БИБЛИОТЕКИ
// ─────────────────────────────────────────────────────────────────────────────
function ModuleLibraryModal({ onClose, onComposeGraph, onUpgrade, currentUser, t = getConstructorStrings('ru'), lang = 'ru' }) {
  const [tab, setTab] = useState("builtin"); // "builtin" | "mine"
  const [activeCat, setActiveCat] = useState(BUILTIN_MODULE_CATEGORIES[0].category);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [catDropOpen, setCatDropOpen] = useState(false);

  // Personal libraries state
  const [libraries, setLibraries] = useState([]);
  const [libsLoading, setLibsLoading] = useState(false);
  const [expandedLib, setExpandedLib] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Create library modal
  const [showCreateLib, setShowCreateLib] = useState(false);
  const [newLibName, setNewLibName] = useState("");
  const [newLibDesc, setNewLibDesc] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Add snippet modal
  const [showAddSnippet, setShowAddSnippet] = useState(null); // libId
  const [snipName, setSnipName] = useState("");
  const [snipDesc, setSnipDesc] = useState("");
  const [snipCode, setSnipCode] = useState("");
  const [snipLoading, setSnipLoading] = useState(false);
  const [snipError, setSnipError] = useState("");
  const [insertionPreview, setInsertionPreview] = useState(null);
  const [composeLoading, setComposeLoading] = useState(false);
  const [pendingModuleIds, setPendingModuleIds] = useState([]);
  const [topologyOpen, setTopologyOpen] = useState(false);
  const [globalResolutions, setGlobalResolutions] = useState({});
  const categoryDropdownRef = useRef(null);
  const mobileTapGuardRef = useRef({
    startX: 0,
    startY: 0,
    moved: false,
    suppressUntil: 0,
  });

  const isPro = currentUser?.plan === 'pro' &&
    currentUser?.subscriptionExp && currentUser.subscriptionExp > Date.now();
  const LIMIT = 3;

  const builtinById = useMemo(
    () => builtinListToById(BUILTIN_MODULE_CATEGORIES),
    [],
  );

  const localizedBuiltin = useMemo(
    () =>
      BUILTIN_MODULE_CATEGORIES.map((cat) => ({
        categoryRu: cat.category,
        categoryDisplay: categoryLabelRuKey(cat.category, lang),
        items: cat.items.map((mod) => localizeBuiltinItem(mod, lang)),
      })),
    [lang],
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (!isMobile || tab !== "builtin" || search.trim()) {
      setCatDropOpen(false);
    }
  }, [isMobile, tab, search]);

  useEffect(() => {
    if (!catDropOpen) return undefined;
    const handleOutside = (event) => {
      if (categoryDropdownRef.current?.contains(event.target)) return;
      setCatDropOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside, true);
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("touchstart", handleOutside, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutside, true);
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
    };
  }, [catDropOpen]);

  const toggleCategoryDropdown = useCallback(() => {
    setCatDropOpen((open) => !open);
  }, []);

  const closeCategoryDropdown = useCallback(() => {
    setCatDropOpen(false);
  }, []);

  const selectBuiltinCategory = useCallback((categoryRu) => {
    setActiveCat(categoryRu);
    setSelected(null);
    setCatDropOpen(false);
  }, []);

  const beginMobileTapGesture = useCallback((event) => {
    if (!isMobile) return;
    const nativeEvent = event.nativeEvent || event;
    if (nativeEvent.pointerType && nativeEvent.pointerType !== "touch") return;
    const point = event.touches?.[0] || event.changedTouches?.[0] || event;
    mobileTapGuardRef.current = {
      startX: point.clientX || 0,
      startY: point.clientY || 0,
      moved: false,
      suppressUntil: 0,
    };
  }, [isMobile]);

  const trackMobileTapGesture = useCallback((event) => {
    if (!isMobile) return;
    const nativeEvent = event.nativeEvent || event;
    if (nativeEvent.pointerType && nativeEvent.pointerType !== "touch") return;
    const point = event.touches?.[0] || event.changedTouches?.[0] || event;
    const dx = Math.abs((point.clientX || 0) - mobileTapGuardRef.current.startX);
    const dy = Math.abs((point.clientY || 0) - mobileTapGuardRef.current.startY);
    if (dy > 8 || dx > 12) {
      mobileTapGuardRef.current.moved = true;
      mobileTapGuardRef.current.suppressUntil = Date.now() + 450;
    }
  }, [isMobile]);

  const endMobileTapGesture = useCallback(() => {
    if (!isMobile) return;
    if (mobileTapGuardRef.current.moved) {
      mobileTapGuardRef.current.suppressUntil = Date.now() + 450;
    }
  }, [isMobile]);

  const suppressMobileTapAfterScroll = useCallback((event) => {
    if (!isMobile) return false;
    const guard = mobileTapGuardRef.current;
    if (!guard.moved && Date.now() > guard.suppressUntil) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, [isMobile]);

  const handleMobileModuleClick = useCallback((event, mod, isSelected) => {
    if (suppressMobileTapAfterScroll(event)) return;
    setSelected(isSelected ? null : mod);
  }, [suppressMobileTapAfterScroll]);

  const handleMobileSnippetClick = useCallback((event, item, isSelected) => {
    if (suppressMobileTapAfterScroll(event)) return;
    setSelectedItem(isSelected ? null : { ...item });
  }, [suppressMobileTapAfterScroll]);

  const handleMobileLibraryHeaderClick = useCallback((event, libId, isOpen) => {
    if (suppressMobileTapAfterScroll(event)) return;
    setExpandedLib(isOpen ? null : libId);
  }, [suppressMobileTapAfterScroll]);

  const handleMobileCategoryClick = useCallback((event, categoryRu) => {
    if (suppressMobileTapAfterScroll(event)) return;
    selectBuiltinCategory(categoryRu);
  }, [selectBuiltinCategory, suppressMobileTapAfterScroll]);

  // Load personal libraries when switching to "mine" tab
  useEffect(() => {
    if (tab !== "mine" || !currentUser) return;
    setLibsLoading(true);
    libFetch("/libraries")
      .then(r => r.json())
      .then(d => { if (d.libraries) setLibraries(d.libraries); })
      .catch(() => {})
      .finally(() => setLibsLoading(false));
  }, [tab, currentUser]);

  const handleCreateLib = async () => {
    if (!newLibName.trim()) { setCreateError(t.libErrName); return; }
    setCreateLoading(true); setCreateError("");
    try {
      const r = await libFetch("/libraries", {
        method: "POST",
        body: JSON.stringify({ name: newLibName, description: newLibDesc }),
      });
      const d = await r.json();
      if (d.error) { setCreateError(d.error); return; }
      setLibraries(prev => [d.library, ...prev]);
      setExpandedLib(d.library.id);
      setShowCreateLib(false);
      setNewLibName(""); setNewLibDesc("");
    } catch (e) {
      setCreateError(t.libErrNetwork);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteLib = async (libId) => {
    const ok = await appConfirm({
      title: 'Удалить библиотеку?',
      message: t.libConfirmDeleteLibrary,
      confirmText: 'Удалить',
      cancelText: t.libCancel,
      variant: 'danger',
    });
    if (!ok) return;
    await libFetch(`/libraries/${libId}`, { method: "DELETE" });
    setLibraries(prev => prev.filter(l => l.id !== libId));
    if (expandedLib === libId) setExpandedLib(null);
  };

  const handleAddSnippet = async () => {
    if (!snipName.trim()) { setSnipError(t.libErrName); return; }
    if (!snipCode.trim()) { setSnipError(t.libErrCode); return; }
    setSnipLoading(true); setSnipError("");
    const lib = libraries.find(l => l.id === showAddSnippet);
    if (!lib) return;
    const newItem = {
      id: Date.now().toString(36),
      name: snipName.trim(),
      desc: snipDesc.trim(),
      code: snipCode.trim(),
    };
    const updatedItems = [...(lib.items || []), newItem];
    try {
      const r = await libFetch(`/libraries/${lib.id}`, {
        method: "PUT",
        body: JSON.stringify({ items: updatedItems }),
      });
      const d = await r.json();
      if (d.error) { setSnipError(d.error); return; }
      setLibraries(prev => prev.map(l => l.id === lib.id ? d.library : l));
      setShowAddSnippet(null);
      setSnipName(""); setSnipDesc(""); setSnipCode("");
    } catch { setSnipError(t.libErrNetwork); }
    finally { setSnipLoading(false); }
  };

  const handleDeleteSnippet = async (libId, itemId) => {
    const lib = libraries.find(l => l.id === libId);
    if (!lib) return;
    const updatedItems = lib.items.filter(it => it.id !== itemId);
    const r = await libFetch(`/libraries/${libId}`, {
      method: "PUT",
      body: JSON.stringify({ items: updatedItems }),
    });
    const d = await r.json();
    if (d.library) setLibraries(prev => prev.map(l => l.id === libId ? d.library : l));
    if (selectedItem?.id === itemId) setSelectedItem(null);
  };

  const filtered = search.trim()
    ? localizedBuiltin.map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (m) =>
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            (m.desc && m.desc.toLowerCase().includes(search.toLowerCase())),
        ),
      })).filter((cat) => cat.items.length > 0)
    : localizedBuiltin.filter((cat) => cat.categoryRu === activeCat);

  const selectedCatalog = useMemo(() => {
    const item = selectedItem || selected;
    if (!item?.id) return null;
    return classifyModule(item.id, GRAPH_MODULE_REGISTRY, { builtinById });
  }, [selected, selectedItem, builtinById]);

  const refreshComposePreview = useCallback((moduleIds) => {
    if (!moduleIds?.length) {
      setInsertionPreview(null);
      setPendingModuleIds([]);
      return;
    }
    setPendingModuleIds(moduleIds);
    setComposeLoading(true);
    try {
      const preview = runInsertionPreview(moduleIds, GRAPH_MODULE_REGISTRY, { strict: false });
      setInsertionPreview(preview);
    } finally {
      setComposeLoading(false);
    }
  }, []);

  useEffect(() => {
    const item = selectedItem || selected;
    if (!item?.id) {
      refreshComposePreview([]);
      setTopologyOpen(false);
      return;
    }
    const entry = classifyModule(item.id, GRAPH_MODULE_REGISTRY, { builtinById });
    if (entry.canInsert || entry.canCompose) {
      refreshComposePreview([item.id]);
    } else {
      setInsertionPreview(null);
      setPendingModuleIds([]);
    }
  }, [selected, selectedItem, refreshComposePreview]);

  const commitGraphDocument = useCallback((document, report, moduleIds) => {
    const doc = injectTokenIntoGraphDocument(document, currentUser);
    onComposeGraph?.({ moduleIds, report, document: doc });
    onClose();
  }, [onComposeGraph, onClose, currentUser]);

  const handleInsert = useCallback(async () => {
    const item = selectedItem || selected;
    if (!item?.id) return;
    setComposeLoading(true);
    try {
      const result = commitInsertion(
        withAutoDependencies([item.id], GRAPH_MODULE_REGISTRY),
        GRAPH_MODULE_REGISTRY,
        { strict: false, autoRepair: true, globalResolutions },
      );
      if (!result.ok || !result.document) {
        await appAlert({
          title: t.libComposeFailed || 'Не удалось собрать модуль',
          message: result.error || 'Сборка не удалась',
        });
        return;
      }
      commitGraphDocument(result.document, result.report, result.moduleIds);
    } finally {
      setComposeLoading(false);
    }
  }, [selected, selectedItem, globalResolutions, commitGraphDocument, t]);

  const handleAutoAddDependencies = useCallback((depId) => {
    const item = selectedItem || selected;
    if (!item?.id) return;
    const ids = withAutoDependencies([item.id, depId].filter(Boolean), GRAPH_MODULE_REGISTRY);
    refreshComposePreview(ids);
  }, [selected, selectedItem, refreshComposePreview]);

  const handleMigrateLegacy = useCallback(async () => {
    const item = selectedItem || selected;
    if (!item) return;
    setComposeLoading(true);
    try {
      const migrated = runLegacyMigration(item, GRAPH_MODULE_REGISTRY, { autoRepair: true });
      if (!migrated.ok) {
        await appAlert({
          title: 'Миграция',
          message: migrated.error || 'Не удалось конвертировать DSL в graph',
        });
        return;
      }
      commitGraphDocument(migrated.document, {
        fixes: migrated.fixes,
        topology: migrated.topology,
        source: migrated.source,
      }, [item.id]);
    } finally {
      setComposeLoading(false);
    }
  }, [selected, selectedItem, commitGraphDocument]);

  const handleInsertIsolated = useCallback(async () => {
    await handleMigrateLegacy();
  }, [handleMigrateLegacy]);

  const handlePreviewLegacy = useCallback(async () => {
    const item = selectedItem || selected;
    if (!item?.code) return;
    await appAlert({
      title: item.name || 'DSL Preview',
      message: item.code.slice(0, 1200) + (item.code.length > 1200 ? '\n…' : ''),
    });
  }, [selected, selectedItem]);

  const handleComposeSuite = useCallback(async () => {
    const ids = GRAPH_MODULE_SUITES.admin_suite;
    setComposeLoading(true);
    try {
      const result = commitInsertion(ids, GRAPH_MODULE_REGISTRY, { strict: false, autoRepair: true });
      if (!result.ok || !result.document) {
        await appAlert({
          title: t.libComposeFailed || 'Не удалось собрать',
          message: result.error || 'Compose failed',
        });
        return;
      }
      commitGraphDocument(result.document, result.report, result.moduleIds);
    } finally {
      setComposeLoading(false);
    }
  }, [commitGraphDocument, t]);

  const handleResolveGlobal = useCallback((conflict, choice) => {
    const name = conflict.message?.match(/"([^"]+)"/)?.[1] || 'global';
    setGlobalResolutions((prev) => ({ ...prev, [name]: choice }));
    if (pendingModuleIds.length) refreshComposePreview(pendingModuleIds);
  }, [pendingModuleIds, refreshComposePreview]);

  const totalModules = BUILTIN_MODULE_CATEGORIES.reduce((a, c) => a + c.items.length, 0);
  const totalSnippets = libraries.reduce((a, l) => a + (l.items?.length || 0), 0);

  return (
    <div
      className="neo-lib-overlay"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 11000,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        @keyframes neoLibIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .neo-lib-overlay {
          background:
            radial-gradient(circle at 20% 12%, rgba(37, 99, 235, 0.32), transparent 34%),
            radial-gradient(circle at 82% 18%, rgba(168, 85, 247, 0.34), transparent 35%),
            radial-gradient(circle at 52% 84%, rgba(14, 165, 233, 0.22), transparent 38%),
            rgba(5, 4, 18, 0.82) !important;
          backdrop-filter: blur(16px) saturate(130%) !important;
        }

        .neo-lib-shell {
          position: relative;
          isolation: isolate;
          background:
            linear-gradient(145deg, rgba(18, 14, 54, 0.9), rgba(13, 10, 37, 0.86) 48%, rgba(8, 8, 26, 0.94)),
            rgba(10, 8, 30, 0.92) !important;
          border: 1px solid rgba(123, 92, 255, 0.58) !important;
          border-radius: 24px !important;
          box-shadow:
            0 34px 120px rgba(0, 0, 0, 0.78),
            0 0 80px rgba(80, 70, 255, 0.28),
            inset 0 0 0 1px rgba(255, 255, 255, 0.05) !important;
          animation: neoLibIn 0.24s cubic-bezier(0.34, 1.25, 0.64, 1) both;
        }

        .neo-lib-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 25% 4%, rgba(45, 212, 191, 0.28), transparent 20%),
            radial-gradient(circle at 92% 0%, rgba(168, 85, 247, 0.34), transparent 24%),
            linear-gradient(90deg, rgba(34, 211, 238, 0.08), transparent 25%, rgba(168, 85, 247, 0.12));
        }

        .neo-lib-shell > * {
          position: relative;
          z-index: 1;
        }

        .neo-lib-header {
          background: linear-gradient(180deg, rgba(35, 22, 86, 0.72), rgba(17, 12, 48, 0.36)) !important;
          border-bottom: 1px solid rgba(121, 98, 255, 0.28) !important;
        }

        .neo-lib-close {
          width: 34px !important;
          height: 34px !important;
          border-radius: 12px !important;
          background: rgba(255, 255, 255, 0.06) !important;
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          color: rgba(255, 255, 255, 0.72) !important;
          box-shadow: inset 0 0 18px rgba(139, 92, 246, 0.12) !important;
        }

        .neo-lib-close:hover {
          border-color: rgba(248, 113, 113, 0.78) !important;
          color: #fecaca !important;
          background: rgba(248, 113, 113, 0.13) !important;
        }

        .neo-lib-tabs { gap: 8px !important; }

        .neo-lib-tab {
          min-height: 38px;
          border-radius: 12px !important;
          background: rgba(72, 48, 170, 0.28) !important;
          border: 1px solid rgba(99, 102, 241, 0.36) !important;
          color: rgba(235, 230, 255, 0.68) !important;
          box-shadow: inset 0 0 22px rgba(99, 102, 241, 0.11) !important;
        }

        .neo-lib-tab-active {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.18), rgba(168, 85, 247, 0.18)) !important;
          border-color: rgba(251, 191, 36, 0.75) !important;
          color: #ffe86a !important;
          box-shadow: 0 0 24px rgba(251, 191, 36, 0.2), inset 0 0 24px rgba(251, 191, 36, 0.08) !important;
        }

        .neo-lib-tab span {
          background: rgba(255, 255, 255, 0.13) !important;
        }

        .neo-lib-search-wrap,
        .neo-lib-toolbar {
          background: rgba(10, 8, 34, 0.28) !important;
          border-bottom: 1px solid rgba(111, 92, 255, 0.22) !important;
        }

        .neo-lib-search {
          min-height: 38px;
          border-radius: 12px !important;
          background: rgba(23, 16, 71, 0.58) !important;
          border: 1px solid rgba(99, 102, 241, 0.35) !important;
          box-shadow: inset 0 0 18px rgba(59, 130, 246, 0.14), 0 0 20px rgba(99, 102, 241, 0.08) !important;
        }

        .neo-lib-search:focus {
          border-color: rgba(96, 165, 250, 0.72) !important;
          box-shadow: inset 0 0 18px rgba(59, 130, 246, 0.18), 0 0 24px rgba(59, 130, 246, 0.22) !important;
        }

        .neo-lib-body {
          background:
            radial-gradient(circle at 78% 18%, rgba(168, 85, 247, 0.14), transparent 34%),
            radial-gradient(circle at 34% 12%, rgba(14, 165, 233, 0.12), transparent 32%) !important;
        }

        .neo-lib-sidebar {
          width: 220px !important;
          background: linear-gradient(180deg, rgba(18, 12, 54, 0.5), rgba(9, 8, 30, 0.32)) !important;
          border-right: 1px solid rgba(111, 92, 255, 0.24) !important;
        }

        .neo-lib-cat {
          border-left: 2px solid transparent !important;
          color: rgba(235, 230, 255, 0.64) !important;
        }

        .neo-lib-cat:hover {
          background: rgba(99, 102, 241, 0.1) !important;
          color: rgba(255, 255, 255, 0.86) !important;
        }

        .neo-lib-cat-active {
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.2), rgba(168, 85, 247, 0.08)) !important;
          border-left-color: #22d3ee !important;
          color: #e0f2fe !important;
          box-shadow: inset 10px 0 22px rgba(34, 211, 238, 0.08) !important;
        }

        .neo-lib-card,
        .neo-lib-library-card,
        .neo-lib-snippet-card {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, rgba(23, 17, 68, 0.74), rgba(25, 10, 58, 0.58)) !important;
          border: 1px solid rgba(90, 118, 255, 0.32) !important;
          border-radius: 14px !important;
          box-shadow: inset 0 0 22px rgba(59, 130, 246, 0.08), 0 10px 24px rgba(0, 0, 0, 0.18) !important;
        }

        .neo-lib-card::before,
        .neo-lib-snippet-card::before,
        .neo-lib-library-card::before {
          content: "";
          position: absolute;
          inset: 0 auto auto 0;
          width: 54%;
          height: 1px;
          background: linear-gradient(90deg, rgba(34, 211, 238, 0.9), transparent);
          opacity: 0.75;
        }

        .neo-lib-card:hover,
        .neo-lib-snippet-card:hover,
        .neo-lib-library-card:hover {
          transform: translateY(-1px);
          border-color: rgba(34, 211, 238, 0.55) !important;
          box-shadow: inset 0 0 26px rgba(59, 130, 246, 0.12), 0 0 28px rgba(59, 130, 246, 0.16) !important;
        }

        .neo-lib-card-selected {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.16), rgba(168, 85, 247, 0.22)) !important;
          border-color: rgba(251, 191, 36, 0.72) !important;
          box-shadow: inset 0 0 28px rgba(251, 191, 36, 0.1), 0 0 32px rgba(168, 85, 247, 0.22) !important;
        }

        .neo-lib-insert-bar {
          background: linear-gradient(180deg, rgba(11, 8, 33, 0.34), rgba(5, 4, 18, 0.66)) !important;
          border-top: 1px solid rgba(121, 98, 255, 0.3) !important;
        }

        .neo-lib-code-preview {
          background: rgba(4, 6, 22, 0.78) !important;
          border: 1px solid rgba(96, 165, 250, 0.24) !important;
          box-shadow: inset 0 0 22px rgba(34, 211, 238, 0.08) !important;
        }

        .neo-lib-primary-btn {
          box-shadow: 0 0 24px rgba(251, 191, 36, 0.32), inset 0 0 12px rgba(255, 255, 255, 0.18) !important;
        }

        .neo-lib-primary-btn:hover {
          transform: translateY(-1px);
          filter: saturate(1.15);
        }

        .neo-lib-sub-overlay {
          background: rgba(4, 3, 16, 0.78) !important;
          backdrop-filter: blur(14px) saturate(120%) !important;
        }

        .neo-lib-sub-shell {
          background: linear-gradient(145deg, rgba(18, 14, 54, 0.94), rgba(8, 8, 26, 0.96)) !important;
          border-color: rgba(123, 92, 255, 0.46) !important;
          box-shadow: 0 24px 80px rgba(0,0,0,0.72), 0 0 50px rgba(99,102,241,0.2) !important;
        }

        .neo-lib-sub-shell input,
        .neo-lib-sub-shell textarea {
          background: rgba(23, 16, 71, 0.58) !important;
          border-color: rgba(99, 102, 241, 0.35) !important;
        }

        .neo-lib-dropdown-btn {
          background: rgba(23, 16, 71, 0.58) !important;
          border-color: rgba(99, 102, 241, 0.4) !important;
          box-shadow: inset 0 0 18px rgba(59, 130, 246, 0.12) !important;
        }

        .neo-lib-dropdown-list {
          background: rgba(12, 9, 38, 0.96) !important;
          border-color: rgba(123, 92, 255, 0.45) !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 36px rgba(99,102,241,0.22) !important;
        }

        @media (max-width: 640px) {
          .neo-lib-shell {
            border-radius: 22px 22px 0 0 !important;
          }
          .neo-lib-sidebar { width: 100% !important; }
          .neo-lib-mobile-cats {
            position: relative !important;
            z-index: 3 !important;
            isolation: isolate;
            contain: layout style;
          }
          .neo-lib-body {
            position: relative;
            z-index: 1;
            isolation: isolate;
          }
          .neo-lib-dropdown-list {
            position: relative !important;
            left: auto !important;
            right: auto !important;
            top: auto !important;
            z-index: 1 !important;
            margin-top: 8px;
            max-height: 0;
            opacity: 0;
            overflow: hidden !important;
            pointer-events: none;
            visibility: hidden;
            transform: translateY(-4px) translateZ(0);
            transform-origin: top center;
            transition:
              max-height 240ms cubic-bezier(0.22, 1, 0.36, 1),
              opacity 160ms ease,
              transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
              visibility 0s linear 240ms;
            will-change: max-height, opacity, transform;
            contain: layout paint style;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }
          .neo-lib-dropdown-list-open {
            max-height: min(55vh, 430px);
            opacity: 1;
            overflow-y: auto !important;
            pointer-events: auto;
            visibility: visible;
            transform: translateY(0) translateZ(0);
            transition:
              max-height 260ms cubic-bezier(0.22, 1, 0.36, 1),
              opacity 180ms ease,
              transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
              visibility 0s;
            -webkit-overflow-scrolling: touch;
          }
          .neo-lib-dropdown-list-closed {
            max-height: 0 !important;
            opacity: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
            visibility: hidden !important;
            transform: translateY(-4px) translateZ(0) !important;
          }
          .neo-lib-dropdown-list button {
            transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }
          .neo-lib-mobile-scroll {
            touch-action: pan-y;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-y: contain;
          }
          .neo-lib-card,
          .neo-lib-snippet-card,
          .neo-lib-library-card,
          .neo-lib-dropdown-list button {
            touch-action: pan-y;
            -webkit-tap-highlight-color: transparent;
          }
          .neo-lib-primary-btn,
          .neo-lib-close,
          .neo-lib-tabs button {
            touch-action: manipulation;
          }
        }
      `}</style>

      <div className="neo-lib-shell" style={{
        background: "#111114",
        border: isMobile ? "none" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: isMobile ? "18px 18px 0 0" : 18,
        width: "100%",
        maxWidth: isMobile ? "100%" : 860,
        height: isMobile ? "92vh" : "auto",
        maxHeight: isMobile ? "92vh" : "88vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
      }}>

        {/* Header */}
        <div className="neo-lib-header" style={{
          padding: isMobile ? "14px 14px 10px" : "18px 24px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 10 }}>
            <div style={{ fontFamily:"Syne,system-ui", fontSize: isMobile ? 15 : 17, fontWeight:800, color:"#fff", letterSpacing:"-0.01em" }}>
              {t.libModalHeadline}
            </div>
            <button
              className="neo-lib-close"
              style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", borderRadius:8, width:30, height:30, cursor:"pointer", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
              onClick={onClose}
            >✕</button>
          </div>

          {/* Tab switcher */}
          <div className="neo-lib-tabs" style={{ display:"flex", gap:6 }}>
            {[
              { id:"builtin", label: t.libTabBuiltin, count: totalModules },
              { id:"mine",    label: t.libTabMine,     count: totalSnippets },
            ].map(tb => (
              <button
                key={tb.id}
                className={`neo-lib-tab ${tab === tb.id ? 'neo-lib-tab-active' : ''}`}
                onClick={() => { setTab(tb.id); setSelected(null); setSelectedItem(null); }}
                style={{
                  flex:1, padding: isMobile ? "8px 6px" : "8px 14px",
                  background: tab === tb.id ? "linear-gradient(135deg,rgba(255,215,0,0.18),rgba(255,170,0,0.1))" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${tab === tb.id ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.09)"}`,
                  borderRadius:10, color: tab === tb.id ? "#ffd700" : "rgba(255,255,255,0.5)",
                  fontSize: isMobile ? 12 : 13, fontFamily:"Syne,system-ui", fontWeight: tab === tb.id ? 700 : 500,
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  transition:"all 0.15s",
                }}
              >
                {tb.label}
                <span style={{
                  fontSize:10, minWidth:18, padding:"1px 5px", borderRadius:20, lineHeight:"16px",
                  background: tab === tb.id ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.1)",
                  color: tab === tb.id ? "#ffd700" : "rgba(255,255,255,0.45)",
                  fontWeight:700,
                }}>{tb.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search — only for builtin */}
        {tab === "builtin" && (
          <div className="neo-lib-search-wrap" style={{ padding: isMobile ? "10px 12px" : "12px 24px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
            <input
              className="neo-lib-search"
              style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"9px 14px", color:"#fff", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
              placeholder={t.libSearchPlaceholder}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
            />
          </div>
        )}

        {/* ═══════════════════ МОИ БИБЛИОТЕКИ ═══════════════════ */}
        {tab === "mine" && (
          <div className={isMobile ? "neo-lib-mobile-scroll" : undefined} style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>

            {/* Toolbar */}
            <div className="neo-lib-toolbar" style={{ padding: isMobile ? "10px 12px" : "12px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>
                {!isPro && (
                  <span>
                    <span style={{ color: libraries.length >= LIMIT ? "#f87171" : "#3ecf8e", fontWeight:700 }}>
                      {libraries.length}/{LIMIT}
                    </span>
                    {' '}{t.libTrialLibsSuffix}
                    {libraries.length >= LIMIT && <span style={{ color:"#f87171" }}>{t.libTrialLimitNote}</span>}
                  </span>
                )}
                {isPro && <span style={{ color:"#3ecf8e", fontWeight:600 }}>{t.libProUnlimited}</span>}
              </div>
              <button
                className="neo-lib-primary-btn"
                onClick={() => {
                  if (!currentUser) { void appAlert({ title: t.libAlertLogin, message: t.libAlertLogin, variant: 'info' }); return; }
                  if (!isPro && libraries.length >= LIMIT) {
                    if (typeof onUpgrade === "function") {
                      onUpgrade();
                    } else {
                      void appAlert({ title: t.libAlertTrialLimit(LIMIT), message: t.libAlertTrialLimit(LIMIT), variant: 'warning' });
                    }
                    return;
                  }
                  setShowCreateLib(true);
                }}
                style={{
                  padding:"8px 14px", borderRadius:10, fontSize:12, fontWeight:700,
                  fontFamily:"Syne,system-ui",
                  background: (!isPro && libraries.length >= LIMIT)
                    ? "rgba(255,255,255,0.05)"
                    : "linear-gradient(135deg,#3ecf8e,#0ea5e9)",
                  color: (!isPro && libraries.length >= LIMIT) ? "rgba(253,230,138,0.78)" : "#0a0a0a",
                  border: (!isPro && libraries.length >= LIMIT) ? "1px solid rgba(251,191,36,0.24)" : "none",
                  cursor:"pointer",
                  whiteSpace:"nowrap",
                  opacity: (!isPro && libraries.length >= LIMIT) ? 0.72 : 1,
                  filter: (!isPro && libraries.length >= LIMIT) ? "saturate(0.62)" : undefined,
                }}
              >{(!isPro && libraries.length >= LIMIT) ? `🔒 ${t.libCreateLibraryBtn.replace(/^\+\s*/, "")}` : t.libCreateLibraryBtn}</button>
            </div>

            {/* Libraries list */}
            <div
              className={isMobile ? "neo-lib-mobile-scroll" : undefined}
              onPointerDown={beginMobileTapGesture}
              onPointerMove={trackMobileTapGesture}
              onPointerUp={endMobileTapGesture}
              onPointerCancel={endMobileTapGesture}
              onTouchStart={beginMobileTapGesture}
              onTouchMove={trackMobileTapGesture}
              onTouchEnd={endMobileTapGesture}
              style={{ flex:1, overflowY:"auto", padding: isMobile ? "10px 12px" : "14px 20px" }}
            >
              {!currentUser && (
                <div style={{ textAlign:"center", padding:"50px 20px", color:"rgba(255,255,255,0.3)", fontSize:13, fontFamily:"Syne,system-ui" }}>
                  {t.libLoginWall}
                </div>
              )}
              {currentUser && libsLoading && (
                <div style={{ textAlign:"center", padding:"50px 20px", color:"rgba(255,255,255,0.3)", fontSize:13 }}>{t.libLoading}</div>
              )}
              {currentUser && !libsLoading && libraries.length === 0 && (
                <div style={{ textAlign:"center", padding:"50px 20px" }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>📂</div>
                  <div style={{ fontSize:14, color:"rgba(255,255,255,0.4)", fontFamily:"Syne,system-ui", fontWeight:600, marginBottom:6 }}>{t.libNoLibsTitle}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.25)" }}>{t.libNoLibsHint}</div>
                </div>
              )}
              {libraries.map((lib) => {
                const isOpen = expandedLib === lib.id;
                return (
                  <div key={lib.id} className="neo-lib-library-card" style={{ marginBottom:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, overflow:"hidden" }}>
                    {/* Library header */}
                    <div
                      style={{ padding: isMobile ? "12px 14px" : "13px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}
                      onClick={(e) => handleMobileLibraryHeaderClick(e, lib.id, isOpen)}
                    >
                      <span style={{ fontSize:14, transition:"transform 0.2s", display:"inline-block", transform: isOpen ? "rotate(90deg)" : "none", color:"rgba(255,255,255,0.4)" }}>▶</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#fff", fontFamily:"Syne,system-ui", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{lib.name}</div>
                        {lib.description && <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{lib.description}</div>}
                      </div>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", flexShrink:0, background:"rgba(255,255,255,0.06)", padding:"2px 8px", borderRadius:20 }}>{t.libSnippetShort((lib.items||[]).length)}</span>
                      <button onClick={(e)=>{e.stopPropagation(); handleDeleteLib(lib.id);}}
                        style={{ background:"transparent", border:"none", color:"rgba(248,113,113,0.5)", cursor:"pointer", fontSize:14, padding:"0 4px", flexShrink:0, lineHeight:1 }}
                        title={t.libDeleteLibraryHint}
                      >✕</button>
                    </div>

                    {/* Snippets */}
                    {isOpen && (
                      <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding: isMobile ? "10px 12px" : "12px 16px" }}>
                        {(lib.items||[]).length === 0 && (
                          <div style={{ fontSize:12, color:"rgba(255,255,255,0.25)", marginBottom:10 }}>{t.libNoSnippets}</div>
                        )}
                        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(220px,1fr))", gap:8, marginBottom:10 }}>
                          {(lib.items||[]).map(item => {
                            const sel = selectedItem?.id === item.id;
                            return (
                              <div key={item.id}
                                onClick={(e) => handleMobileSnippetClick(e, item, sel)}
                                className={`neo-lib-snippet-card ${sel ? 'neo-lib-card-selected' : ''}`}
                                style={{ background: sel ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)", border:`1px solid ${sel ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.07)"}`, borderRadius:10, padding:"10px 12px", cursor:"pointer", position:"relative" }}
                              >
                                <div style={{ fontSize:12, fontWeight:700, color:"#fff", fontFamily:"Syne,system-ui", marginBottom:3, paddingRight:20 }}>{item.name}</div>
                                {item.desc && <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>{item.desc}</div>}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteSnippet(lib.id, item.id); }}
                                  style={{ position:"absolute", top:6, right:6, background:"transparent", border:"none", color:"rgba(248,113,113,0.4)", cursor:"pointer", fontSize:12, lineHeight:1 }}
                                  title={t.libDeleteSnippetHint}
                                >✕</button>
                                {isMobile && sel && (
                                  <button className="neo-lib-primary-btn" onClick={(e) => {
                                    e.stopPropagation();
                                    if (suppressMobileTapAfterScroll(e)) return;
                                    appAlert({
                                      title: t.libLegacyModuleTitle || 'Legacy snippet',
                                      message: t.libLegacyModuleBody || 'Пользовательские сниппеты пока только DSL. Сохраните как graph JSON или используйте встроенные graph-модули.',
                                    });
                                  }}
                                    style={{ marginTop:8, width:"100%", padding:"9px", background:"linear-gradient(135deg,#ffd700,#ffaa00)", border:"none", borderRadius:8, color:"#111", fontWeight:800, fontFamily:"Syne,system-ui", fontSize:12, cursor:"pointer" }}
                                  >{t.libInsert}</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <button
                          className="neo-lib-primary-btn"
                          onClick={(e) => { e.stopPropagation(); setShowAddSnippet(lib.id); setSnipName(""); setSnipDesc(""); setSnipCode(""); setSnipError(""); }}
                          style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:600, fontFamily:"Syne,system-ui", background:"rgba(62,207,142,0.08)", color:"#3ecf8e", border:"1px solid rgba(62,207,142,0.2)", cursor:"pointer" }}
                        >{t.libAddSnippetBtn}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop insert bar */}
            {!isMobile && selectedItem && (
              <div className="neo-lib-insert-bar" style={{ borderTop:"1px solid rgba(255,255,255,0.07)", padding:"14px 20px", flexShrink:0, background:"rgba(0,0,0,0.3)", display:"flex", gap:12, alignItems:"flex-end" }}>
                <div className="neo-lib-code-preview" style={{ flex:1, background:"#0d0d0f", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 14px", fontFamily:"monospace", fontSize:11, color:"rgba(255,255,255,0.55)", maxHeight:110, overflowY:"auto", whiteSpace:"pre" }}>{selectedItem.code}</div>
                <button
                  className="neo-lib-primary-btn"
                  style={{ background:"linear-gradient(135deg,#ffd700,#ffaa00)", border:"none", borderRadius:10, padding:"12px 22px", color:"#111", fontWeight:800, fontFamily:"Syne,system-ui", fontSize:13, cursor:"pointer", whiteSpace:"nowrap", boxShadow:"0 4px 16px rgba(255,215,0,0.35)", flexShrink:0 }}
                  onClick={handleInsert}
                >{t.libInsertEditor}</button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ CREATE LIBRARY MODAL ═══════════════ */}
        {showCreateLib && (
          <div className="neo-lib-sub-overlay" style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
            onClick={() => setShowCreateLib(false)}>
            <div className="neo-lib-sub-shell" style={{ background:"#1a1d24", border:"1px solid rgba(255,215,0,0.2)", borderRadius:18, padding:"24px", width:"100%", maxWidth:400, boxShadow:"0 20px 60px rgba(0,0,0,0.8)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:15, fontWeight:800, color:"#fff", fontFamily:"Syne,system-ui", marginBottom:16 }}>{t.libNewLibraryTitle}</div>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6, fontFamily:"Syne,system-ui" }}>{t.libLabelNameReq}</label>
              <input value={newLibName} onChange={e=>setNewLibName(e.target.value)}
                style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, padding:"10px 14px", color:"#fff", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:12 }}
                placeholder={t.libPlaceholderLibName} autoFocus />
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6, fontFamily:"Syne,system-ui" }}>{t.libLabelDesc}</label>
              <input value={newLibDesc} onChange={e=>setNewLibDesc(e.target.value)}
                style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, padding:"10px 14px", color:"#fff", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom: createError ? 8 : 16 }}
                placeholder={t.libPlaceholderLibDesc} />
              {createError && <div style={{ fontSize:12, color:"#f87171", marginBottom:12 }}>⚠ {createError}</div>}
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setShowCreateLib(false)}
                  style={{ flex:1, padding:"10px", borderRadius:10, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.5)", border:"1px solid rgba(255,255,255,0.1)", cursor:"pointer", fontSize:13 }}>{t.libCancel}</button>
                <button onClick={handleCreateLib} disabled={createLoading || !newLibName.trim()}
                  className="neo-lib-primary-btn"
                  style={{ flex:2, padding:"10px", borderRadius:10, background: newLibName.trim() ? "linear-gradient(135deg,#3ecf8e,#0ea5e9)" : "rgba(255,255,255,0.05)", color: newLibName.trim() ? "#0a0a0a" : "rgba(255,255,255,0.3)", border:"none", cursor: newLibName.trim() ? "pointer" : "not-allowed", fontSize:13, fontWeight:700, fontFamily:"Syne,system-ui" }}>
                  {createLoading ? t.libCreating : t.libCreate}</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ ADD SNIPPET MODAL ═══════════════ */}
        {showAddSnippet && (
          <div className="neo-lib-sub-overlay" style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
            onClick={() => setShowAddSnippet(null)}>
            <div className="neo-lib-sub-shell" style={{ background:"#1a1d24", border:"1px solid rgba(62,207,142,0.2)", borderRadius:18, padding:"24px", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.8)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:15, fontWeight:800, color:"#fff", fontFamily:"Syne,system-ui", marginBottom:16 }}>{t.libNewSnippetTitle}</div>
              <div style={{marginBottom:12}}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6, fontFamily:"Syne,system-ui" }}>{t.libLabelSnippetName}</label>
                <input type="text" value={snipName} onChange={e=>setSnipName(e.target.value)}
                  style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, padding:"10px 14px", color:"#fff", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  placeholder={t.libPlaceholderSnippetName} />
              </div>
              <div style={{marginBottom:12}}>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6, fontFamily:"Syne,system-ui" }}>{t.libLabelSnippetDesc}</label>
                <input type="text" value={snipDesc} onChange={e=>setSnipDesc(e.target.value)}
                  style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, padding:"10px 14px", color:"#fff", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  placeholder={t.libPlaceholderSnippetDesc} />
              </div>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6, fontFamily:"Syne,system-ui" }}>{t.libLabelSnippetCode}</label>
              <textarea value={snipCode} onChange={e=>setSnipCode(e.target.value)}
                style={{ width:"100%", height:160, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, padding:"10px 14px", color:"#3ecf8e", fontSize:12, fontFamily:"monospace", outline:"none", boxSizing:"border-box", resize:"vertical", lineHeight:1.6 }}
                placeholder={t.libPlaceholderSnippetCode} />
              {snipError && <div style={{ fontSize:12, color:"#f87171", marginTop:8 }}>⚠ {snipError}</div>}
              <div style={{ display:"flex", gap:8, marginTop:14 }}>
                <button onClick={() => setShowAddSnippet(null)}
                  style={{ flex:1, padding:"10px", borderRadius:10, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.5)", border:"1px solid rgba(255,255,255,0.1)", cursor:"pointer", fontSize:13 }}>{t.libCancel}</button>
                <button onClick={handleAddSnippet} disabled={snipLoading || !snipName.trim() || !snipCode.trim()}
                  className="neo-lib-primary-btn"
                  style={{ flex:2, padding:"10px", borderRadius:10, background: (snipName.trim() && snipCode.trim()) ? "linear-gradient(135deg,#3ecf8e,#0ea5e9)" : "rgba(255,255,255,0.05)", color: (snipName.trim() && snipCode.trim()) ? "#0a0a0a" : "rgba(255,255,255,0.3)", border:"none", cursor: (snipName.trim() && snipCode.trim()) ? "pointer" : "not-allowed", fontSize:13, fontWeight:700, fontFamily:"Syne,system-ui" }}>
                  {snipLoading ? t.libSavingSnippet : t.libAddSnippet}</button>
              </div>
            </div>
          </div>
        )}

        {/* Categories — dropdown на мобиле, сайдбар на десктопе */}
        {tab === "builtin" && !search && isMobile && (
          <div
            ref={categoryDropdownRef}
            className="neo-lib-mobile-cats"
            style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0, position:"relative" }}
          >
            {/* Trigger button */}
            <button
              type="button"
              aria-expanded={catDropOpen}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={toggleCategoryDropdown}
              className="neo-lib-dropdown-btn"
              style={{
                width:"100%", padding:"11px 14px",
                background:"rgba(255,255,255,0.05)",
                border:`1px solid ${catDropOpen ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.12)"}`,
                borderRadius:12, color:"#fff",
                fontFamily:"Syne,system-ui", fontSize:13, fontWeight:600,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8,
                transition:"border-color 0.15s",
              }}
            >
              <span style={{ color:"#ffd700" }}>{categoryLabelRuKey(activeCat, lang)}</span>
              <span style={{
                fontSize:10, color:"rgba(255,255,255,0.4)",
                transform: catDropOpen ? "rotate(180deg)" : "none",
                transition:"transform 0.2s",
                display:"inline-block",
              }}>▼</span>
            </button>

            {/* Accordion list: keep mounted so Chrome does not ghost a stale composited layer. */}
              <div
                className={`neo-lib-dropdown-list neo-lib-mobile-scroll ${catDropOpen ? "neo-lib-dropdown-list-open" : "neo-lib-dropdown-list-closed"}`}
                aria-hidden={!catDropOpen}
                style={{
                background:"#1a1d24",
                border:"1px solid rgba(255,215,0,0.25)",
                borderRadius:14,
                boxShadow:"0 12px 40px rgba(0,0,0,0.85)",
              }}
                onPointerDown={(e) => { e.stopPropagation(); beginMobileTapGesture(e); }}
                onPointerMove={trackMobileTapGesture}
                onPointerUp={endMobileTapGesture}
                onPointerCancel={endMobileTapGesture}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => { e.stopPropagation(); beginMobileTapGesture(e); }}
                onTouchMove={trackMobileTapGesture}
                onTouchEnd={endMobileTapGesture}
              >
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    if (suppressMobileTapAfterScroll(e)) return;
                    closeCategoryDropdown();
                  }}
                  tabIndex={catDropOpen ? 0 : -1}
                  style={{
                    width:"100%",
                    padding:"11px 16px",
                    textAlign:"left",
                    background:"rgba(34,211,238,0.08)",
                    border:"none",
                    borderBottom:"1px solid rgba(34,211,238,0.16)",
                    color:"rgba(224,242,254,0.78)",
                    fontSize:12,
                    fontFamily:"Syne,system-ui",
                    fontWeight:700,
                    cursor:"pointer",
                  }}
                >
                  ▲ Свернуть список
                </button>
                {localizedBuiltin.map((cat, idx) => {
                  const active = activeCat === cat.categoryRu;
                  return (
                    <button
                      type="button"
                      key={cat.categoryRu}
                      tabIndex={catDropOpen ? 0 : -1}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleMobileCategoryClick(e, cat.categoryRu)}
                      style={{
                        width:"100%", padding:"13px 16px",
                        textAlign:"left",
                        background: active ? "rgba(255,215,0,0.1)" : "transparent",
                        borderBottom: idx < localizedBuiltin.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        border:"none",
                        color: active ? "#ffd700" : "rgba(255,255,255,0.7)",
                        fontSize:13, fontFamily:"Syne,system-ui",
                        fontWeight: active ? 700 : 500,
                        cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        transition:"background 0.1s",
                      }}
                    >
                      <span>{cat.categoryDisplay}</span>
                      {active && <span style={{ fontSize:14, color:"#ffd700" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
          </div>
        )}

        {/* ═══════════════ BUILTIN BODY ═══════════════ */}
        {tab === "builtin" && <div className="neo-lib-body" style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* Sidebar — только десктоп */}
          {!search && !isMobile && (
            <div className="neo-lib-sidebar" style={{ width:210, borderRight:"1px solid rgba(255,255,255,0.06)", overflowY:"auto", flexShrink:0, padding:"10px 0" }}>
              {localizedBuiltin.map((cat) => {
                const active = activeCat === cat.categoryRu;
                return (
                  <button
                    key={cat.categoryRu}
                    className={`neo-lib-cat ${active ? 'neo-lib-cat-active' : ''}`}
                    style={{
                      width:"100%", padding:"9px 16px", textAlign:"left",
                      background: active ? "rgba(255,215,0,0.1)" : "transparent",
                      border:"none", borderLeft: active ? "2px solid #ffd700" : "2px solid transparent",
                      color: active ? "#ffd700" : "rgba(255,255,255,0.55)",
                      cursor:"pointer", fontSize:12, fontFamily:"Syne,system-ui",
                      fontWeight: active ? 700 : 500, transition:"all 0.15s", lineHeight:1.4,
                    }}
                    onClick={() => { setActiveCat(cat.categoryRu); setSelected(null); }}
                  >{cat.categoryDisplay}</button>
                );
              })}
            </div>
          )}

          {/* Modules list */}
          <div
            className={isMobile ? "neo-lib-mobile-scroll" : undefined}
            onPointerDown={beginMobileTapGesture}
            onPointerMove={trackMobileTapGesture}
            onPointerUp={endMobileTapGesture}
            onPointerCancel={endMobileTapGesture}
            onTouchStart={beginMobileTapGesture}
            onTouchMove={trackMobileTapGesture}
            onTouchEnd={endMobileTapGesture}
            style={{ flex:1, overflowY:"auto", padding: isMobile ? "12px" : "14px 20px" }}
          >
            {filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:"rgba(255,255,255,0.25)", fontSize:14, fontFamily:"Syne,system-ui" }}>
                {t.libNothingFound(search)}
              </div>
            ) : (
              filtered.map((cat) => (
                <div key={cat.categoryRu}>
                  {search && (
                    <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.2)", textTransform:"uppercase", letterSpacing:"0.1em", padding:"14px 0 6px", fontFamily:"Syne,system-ui" }}>
                      {cat.categoryDisplay}
                    </div>
                  )}
                  <div style={{
                    display:"grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: isMobile ? 8 : 10,
                  }}>
                    {cat.items.map((mod) => {
                      const sel = selected?.id === mod.id;
                      return (
                        <div
                          key={mod.id}
                          onClick={(e) => handleMobileModuleClick(e, mod, sel)}
                          className={`neo-lib-card ${sel ? 'neo-lib-card-selected' : ''}`}
                          style={{
                            background: sel ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
                            border:`1px solid ${sel ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.08)"}`,
                            borderRadius:12, padding: isMobile ? "12px" : "13px 14px",
                            cursor:"pointer", transition:"all 0.15s",
                          }}
                        >
                          <div style={{ fontSize: isMobile ? 14 : 13, fontWeight:700, color:"#fff", fontFamily:"Syne,system-ui", marginBottom:4, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                            {mod.name}
                            {(classifyModule(mod.id, GRAPH_MODULE_REGISTRY, { builtinById }).badges || []).map((b) => (
                              <span
                                key={b.id}
                                style={{ fontSize:10, padding:'2px 6px', borderRadius:6, background:b.bg, color:b.color }}
                              >
                                {b.label}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", lineHeight:1.5 }}>
                            {mod.desc}
                          </div>
                          {/* На мобиле — кнопка вставки прямо в карточке при выборе */}
                          {isMobile && sel && (
                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {insertionPreview?.blockers?.map((b, i) => (
                                <div key={i} style={{ fontSize: 11, color: '#f87171' }}>{b.message}</div>
                              ))}
                              {selectedCatalog?.canInsert && (
                                <button
                                  className="neo-lib-primary-btn"
                                  disabled={composeLoading || !insertionPreview?.ok}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (suppressMobileTapAfterScroll(e)) return;
                                    handleInsert();
                                  }}
                                  style={{
                                    width: '100%', padding: '11px',
                                    background: insertionPreview?.ok
                                      ? 'linear-gradient(135deg,#ffd700,#ffaa00)'
                                      : 'rgba(255,255,255,0.12)',
                                    border: 'none', borderRadius: 10,
                                    color: insertionPreview?.ok ? '#111' : 'rgba(255,255,255,0.35)',
                                    fontWeight: 800, fontFamily: 'Syne,system-ui', fontSize: 13,
                                    cursor: composeLoading ? 'wait' : 'pointer',
                                  }}
                                >
                                  {t.libInsertEditor}
                                </button>
                              )}
                              {selectedCatalog?.canMigrate && (
                                <button
                                  type="button"
                                  disabled={composeLoading}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMigrateLegacy();
                                  }}
                                  style={{
                                    width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                                    background: 'linear-gradient(135deg,#38bdf8,#6366f1)',
                                    color: '#fff', fontWeight: 700, fontSize: 13,
                                  }}
                                >
                                  Конвертировать в Graph
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>}

        {/* Preview & Insert — только десктоп, builtin */}
        {tab === "builtin" && !isMobile && selected && (
          <div className="neo-lib-insert-bar" style={{
            borderTop:"1px solid rgba(255,255,255,0.07)",
            padding:"14px 20px", flexShrink:0,
            background:"rgba(0,0,0,0.3)",
            display:"flex", flexDirection:"column", gap:10,
          }}>
            <div style={{ display:"flex", gap:12, alignItems:"flex-end" }}>
              <div className="neo-lib-code-preview" style={{
                flex:1, background:"#0d0d0f",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:10, padding:"10px 14px",
                fontFamily:"monospace", fontSize:11,
                color:"rgba(255,255,255,0.55)",
                maxHeight:110, overflowY:"auto", whiteSpace:"pre",
              }}>
                {selectedCatalog?.graphNative
                  ? (t.libGraphPreview || `Graph · ${insertionPreview?.topology?.nodeCount ?? '…'} узлов`)
                  : (t.libLegacyPreview || 'Legacy DSL — конвертируйте в Graph')}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
                <button
                  className="neo-lib-primary-btn"
                  disabled={composeLoading || !(insertionPreview?.ok && selectedCatalog?.canInsert)}
                  title={insertionPreview?.blockers?.[0]?.message || ''}
                  style={{
                    background: (insertionPreview?.ok && selectedCatalog?.canInsert)
                      ? "linear-gradient(135deg,#ffd700,#ffaa00)"
                      : "rgba(255,255,255,0.12)",
                    border:"none", borderRadius:10, padding:"12px 22px",
                    color: (insertionPreview?.ok && selectedCatalog?.canInsert) ? "#111" : "rgba(255,255,255,0.35)",
                    fontWeight:800, fontFamily:"Syne,system-ui",
                    fontSize:13, cursor: composeLoading ? "wait" : "pointer", whiteSpace:"nowrap",
                    boxShadow: (insertionPreview?.ok && selectedCatalog?.canInsert) ? "0 4px 16px rgba(255,215,0,0.35)" : "none",
                  }}
                  onClick={handleInsert}
                >{composeLoading ? '…' : t.libInsertEditor}</button>
                {selectedCatalog?.canMigrate && (
                  <button type="button" onClick={handleMigrateLegacy} disabled={composeLoading}
                    style={{ padding:'8px 12px', borderRadius:8, border:'1px solid rgba(56,189,248,0.4)', background:'rgba(56,189,248,0.12)', color:'#38bdf8', fontSize:11, cursor:'pointer' }}>
                    Мигрировать в Graph
                  </button>
                )}
              </div>
            </div>
            {insertionPreview?.blockers?.map((b, i) => (
              <div key={i} style={{ fontSize:12, color:'#f87171' }}>{b.message}</div>
            ))}
            <ModuleCompositionPanel
              report={{
                conflicts: insertionPreview?.conflicts,
                fixes: insertionPreview?.fixes,
                resolvedDependencies: insertionPreview?.resolvedDependencies,
                ok: insertionPreview?.ok,
              }}
              selectedIds={pendingModuleIds}
              lang={lang}
              onComposeSuite={handleComposeSuite}
              t={t}
              globalConflicts={insertionPreview?.conflicts?.filter((c) => c.kind === 'global')}
              onResolveGlobal={handleResolveGlobal}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ModuleLibraryButton → onComposeGraph(document) via importComposedGraph in App.jsx
export function ModuleLibraryButton({ onComposeGraph, onUpgrade, currentUser, t = getConstructorStrings('ru'), lang = 'ru', dataTour, compact = false }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="tb-btn tb-btn-ghost"
        data-tour={dataTour || undefined}
        onClick={() => setOpen(true)}
        title={t.libButtonTooltip}
        aria-label={t.moduleLibrary}
      >
        {compact ? '▰' : t.moduleLibrary}
      </button>

      {open && (
        <ModuleLibraryModal
          t={t}
          lang={lang}
          currentUser={currentUser}
          onClose={() => setOpen(false)}
          onUpgrade={() => {
            setOpen(false);
            onUpgrade?.();
          }}
          onComposeGraph={onComposeGraph}
        />
      )}
    </>
  );
}

export { ModuleLibraryModal };
export default ModuleLibraryModal;
