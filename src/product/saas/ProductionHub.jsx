import React, { useCallback, useMemo, useState } from 'react';
import { useProductionStore } from '../../stores/productionStore.js';
import { usePersistenceStore } from '../../stores/persistenceStore.js';
import { useUiStore } from '../../stores/uiStore.js';
import { getProductionLabels } from './productionLabels.js';
import { listFlowVersions, pushFlowVersion, getFlowVersion } from './versionHistory.js';
import { getOrCreateCollabRoom, buildInviteLink } from './collaborationPrep.js';
import { downloadFlowJson, pickFlowImportFile, parseFlowImportFile } from './flowIo.js';
import {
  SHARED_COMPONENTS,
  SHARED_COMPONENT_CATEGORIES,
  getSharedComponentInsertProps,
} from './sharedComponents.js';
import { getFlowStarterTemplates } from '../../builder/flowTemplates.js';
import './production-hub.css';

const TAB_IDS = ['overview', 'versions', 'templates', 'modules', 'components', 'io', 'collab'];

/**
 * Production SaaS workspace — versions, templates, modules, I/O, collaboration prep.
 */
export default function ProductionHub({
  open,
  onClose,
  lang = 'ru',
  projectId = '__draft__',
  graph,
  graphRevision = 0,
  onRestoreVersion,
  onApplyTemplate,
  onOpenModuleLibrary,
  onInsertSharedComponent,
  onImportDocument,
  canUndo = false,
  canRedo = false,
  onOpenHistory,
}) {
  const tab = useProductionStore((s) => s.hubTab);
  const versionTick = useProductionStore((s) => s.versionTick);
  const setTab = (id) => useProductionStore.getState().setHubTab(id);
  const labels = useMemo(() => getProductionLabels(lang), [lang]);
  const l = labels;

  const isSaving = usePersistenceStore((s) => s.isSaving);
  const lastPersistedAt = usePersistenceStore((s) => s.lastPersistedAt);
  const lastPublishedAt = useUiStore((s) => s.lastPublishedAt);
  const publishSuccess = useUiStore((s) => s.publishSuccess);

  const [linkCopied, setLinkCopied] = useState(false);

  const versions = useMemo(
    () => listFlowVersions(projectId),
    [projectId, versionTick, graphRevision],
  );

  const templates = useMemo(() => getFlowStarterTemplates(lang), [lang]);
  const collabRoom = useMemo(() => getOrCreateCollabRoom(projectId), [projectId]);

  const isDraft = !lastPublishedAt || (lastPersistedAt && lastPersistedAt > lastPublishedAt);

  const handleSnapshot = useCallback(() => {
    const doc = graph?.getGraphDocument?.();
    if (!doc) return;
    pushFlowVersion(projectId, doc, { kind: 'manual', label: lang === 'en' ? 'Manual snapshot' : 'Снимок' });
    useProductionStore.getState().bumpVersions();
  }, [graph, projectId, lang]);

  const handleRestore = useCallback((versionId) => {
    const v = getFlowVersion(projectId, versionId);
    if (!v?.snapshot) return;
    onRestoreVersion?.(v.snapshot);
    useProductionStore.getState().bumpVersions();
  }, [projectId, onRestoreVersion]);

  const handleExport = useCallback(() => {
    try {
      downloadFlowJson(graph.getGraphDocument(), `flow-${projectId}.json`);
    } catch (e) {
      console.error(e);
    }
  }, [graph, projectId]);

  const handleImport = useCallback(async () => {
    const file = await pickFlowImportFile();
    if (!file) return;
    try {
      const doc = await parseFlowImportFile(file);
      onImportDocument?.(doc);
    } catch (e) {
      console.error(e);
    }
  }, [onImportDocument]);

  const handleCopyInvite = useCallback(async () => {
    const link = buildInviteLink(projectId);
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* */ }
  }, [projectId]);

  if (!open) return null;

  return (
    <div className="prod-hub-backdrop" onClick={onClose} role="presentation">
      <aside
        className="prod-hub"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="prod-hub-title"
        aria-modal="true"
      >
        <header className="prod-hub__head">
          <h2 id="prod-hub-title" className="prod-hub__title">{l.hubTitle}</h2>
          <button type="button" className="prod-hub__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <nav className="prod-hub__tabs" role="tablist" aria-label={l.hubTitle}>
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`prod-hub__tab ${tab === id ? 'is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {l.tabs[id]}
            </button>
          ))}
        </nav>

        <div className="prod-hub__body">
          {tab === 'overview' && (
            <div className="prod-hub__overview">
              <div className="prod-hub__card">
                <span className={`prod-hub__status prod-hub__status--${isDraft ? 'draft' : 'live'}`}>
                  {isDraft ? l.overview.draft : l.overview.published}
                </span>
                <p className="prod-hub__hint">{l.overview.draftHint}</p>
              </div>
              <div className="prod-hub__card">
                <strong>{l.overview.autosave}</strong>
                <p className="prod-hub__hint">
                  {isSaving ? (lang === 'en' ? 'Saving…' : 'Сохранение…') : l.overview.autosaveHint}
                </p>
              </div>
              <div className="prod-hub__card prod-hub__card--row">
                <div>
                  <strong>{l.overview.undo}</strong>
                  <p className="prod-hub__hint">{l.overview.undoHint}</p>
                </div>
                <div className="prod-hub__mini-actions">
                  <button type="button" className="prod-hub__btn" disabled={!canUndo} onClick={onOpenHistory} title="History">
                    ↶
                  </button>
                  <button type="button" className="prod-hub__btn" disabled={!canRedo} title="Redo">
                    ↷
                  </button>
                </div>
              </div>
              {publishSuccess && (
                <p className="prod-hub__success" role="status">
                  ✓ {l.overview.published}
                </p>
              )}
            </div>
          )}

          {tab === 'versions' && (
            <div className="prod-hub__versions">
              <button type="button" className="prod-hub__btn prod-hub__btn--primary" onClick={handleSnapshot}>
                {l.versions.snapshot}
              </button>
              {versions.length === 0 ? (
                <p className="prod-hub__empty">{l.versions.empty}</p>
              ) : (
                <ul className="prod-hub__version-list">
                  {versions.map((v) => (
                    <li key={v.id} className="prod-hub__version-item">
                      <div>
                        <strong>{v.label}</strong>
                        <span className="prod-hub__meta">
                          {new Date(v.ts).toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')}
                          {' · '}
                          {v.nodeCount} {lang === 'en' ? 'steps' : 'шагов'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="prod-hub__btn prod-hub__btn--ghost"
                        onClick={() => handleRestore(v.id)}
                      >
                        {l.versions.restore}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'templates' && (
            <ul className="prod-hub__template-grid">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="prod-hub__template-card"
                    onClick={() => onApplyTemplate?.(t.id)}
                  >
                    <span className="prod-hub__template-icon" aria-hidden>{t.icon}</span>
                    <strong>{t.name}</strong>
                    <span>{t.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {tab === 'modules' && (
            <div className="prod-hub__modules">
              <p className="prod-hub__hint">
                {lang === 'en'
                  ? 'Reusable graph modules — payments, CRM, webhooks.'
                  : 'Переиспользуемые модули — оплаты, CRM, webhooks.'}
              </p>
              <button
                type="button"
                className="prod-hub__btn prod-hub__btn--primary"
                onClick={() => {
                  onOpenModuleLibrary?.();
                  onClose?.();
                }}
              >
                {l.modules.open}
              </button>
            </div>
          )}

          {tab === 'components' && (
            <div className="prod-hub__components">
              {SHARED_COMPONENT_CATEGORIES.map((cat) => (
                <section key={cat.id} className="prod-hub__comp-section">
                  <h3>{cat.icon} {l.tabs.components}</h3>
                  <ul>
                    {SHARED_COMPONENTS.filter((c) => c.category === cat.id).map((c) => {
                      const insert = getSharedComponentInsertProps(c.id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="prod-hub__comp-btn"
                            onClick={() => insert && onInsertSharedComponent?.(insert)}
                          >
                            <code>{insert?.type}</code>
                            <span>{l.components.insert}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {tab === 'io' && (
            <div className="prod-hub__io">
              <p className="prod-hub__hint">{l.io.exportHint}</p>
              <button type="button" className="prod-hub__btn prod-hub__btn--primary" onClick={handleExport}>
                {l.io.export}
              </button>
              <button type="button" className="prod-hub__btn" onClick={handleImport}>
                {l.io.import}
              </button>
            </div>
          )}

          {tab === 'collab' && (
            <div className="prod-hub__collab">
              <p className="prod-hub__hint">{l.collab.coming}</p>
              <div className="prod-hub__card">
                <span className="prod-hub__label">{l.collab.room}</span>
                <code className="prod-hub__code">{collabRoom.roomId}</code>
              </div>
              <button type="button" className="prod-hub__btn" onClick={handleCopyInvite}>
                {linkCopied ? l.collab.copied : l.collab.copyLink}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
