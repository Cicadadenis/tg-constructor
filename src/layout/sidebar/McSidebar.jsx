import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getProductUiLabels } from '../../copy/productCopy.js';
import { MC_SPRING } from '../../motion/index.js';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useAppLayout } from '../AppLayoutContext.jsx';
import { normalizeAppSection, sectionLabel } from '../appSections.js';
import { SECTION_PANEL_CONFIG } from '../controlPanelConfig.js';
import EmptyState from '../../ui/EmptyState.jsx';
import ContextualHint from '../../polish/ContextualHint.jsx';
import McSidebarNav from './McSidebarNav.jsx';
import McSidebarFlowsPanel from './McSidebarFlowsPanel.jsx';
import { SidebarIcons } from './sidebarIcons.jsx';
import {
  archiveFlowId,
  loadArchivedFlowIds,
  loadCollapsedGroups,
  loadFavoriteFlowIds,
  loadRecentFlows,
  pushRecentFlow,
  saveCollapsedGroups,
  toggleFavoriteFlowId,
  writeSidebarCompact,
} from './sidebarStorage.js';
import FlowSwitcher from '../canvas-first/FlowSwitcher.jsx';
import FlowsDrawer from '../canvas-first/FlowsDrawer.jsx';
import AnalyticsWorkspace from '../../analytics/AnalyticsWorkspace.jsx';
import cicadaLogo from '../../cicada-logo_1778117072446.jpeg';
import '../../analytics/analytics-workspace.css';
import '../canvas-first/canvas-first.css';
import './mc-sidebar.css';

/**
 * ManyChat-style left sidebar — navigation-first, compact mode, flow lists.
 * @param {boolean} [canvasFirst] — blocks rail + flow switcher; full list in drawer
 */
export default function McSidebar({
  canvasFirst = false,
  lang = 'ru',
  sectionListItems = {},
  activeListId = null,
  onSelectListItem,
  onCreateFlow,
  onBulkDelete,
  onOpenModuleLibrary,
  onOpenEsphome,
  onGoToAutomation,
  onDuplicateFlow,
  onTestFlow,
  onExportFlow,
  onArchiveFlow,
  onApplyTemplate,
  onOpenAi,
  onOpenAnalytics,
  analyticsFlowId = null,
  analyticsNodeIds = [],
  getGraphDocument = null,
  onHighlightNodes = null,
  lastTraceId = null,
  onAnalyticsPopout = null,
  listLoading = false,
  palette = null,
  navCounts = {},
  activeFlowName = '',
}) {
  const {
    isMobile,
    section: rawSection,
    setSection,
    listSearch,
    setListSearch,
    listFilter,
    setListFilter,
    bulkSelectedIds,
    toggleBulkId,
    clearBulkSelection,
    sidebarCompact,
    setSidebarCompact,
    sidebarPinned,
    setSidebarPinned,
  } = useAppLayout();

  const section = normalizeAppSection(rawSection);
  const p = getProductUiLabels(lang);
  const [favoriteIds, setFavoriteIds] = useState(() => loadFavoriteFlowIds());
  const [archivedIds, setArchivedIds] = useState(() => loadArchivedFlowIds());
  const [recentFlows, setRecentFlows] = useState(() => loadRecentFlows());
  const [collapsedGroups, setCollapsedGroups] = useState(() => loadCollapsedGroups());
  const [flowsDrawerOpen, setFlowsDrawerOpen] = useState(false);

  const listItems = sectionListItems[section] ?? sectionListItems.flows ?? [];
  const flowListItems = sectionListItems.flows ?? sectionListItems.automations ?? [];
  const compactMode = !isMobile && sidebarCompact;
  const showContent = isMobile || !sidebarCompact || sidebarPinned;
  const mobileBlocksMode = isMobile && canvasFirst;

  useEffect(() => {
    setListFilter(section === 'automations' ? 'active' : 'all');
    clearBulkSelection();
  }, [section, setListFilter, clearBulkSelection]);

  useEffect(() => {
    writeSidebarCompact(sidebarCompact);
  }, [sidebarCompact]);

  const handleSectionChange = useCallback((id) => {
    setSection(id);
    if (sidebarCompact) {
      setSidebarPinned(true);
    }
  }, [setSection, sidebarCompact, setSidebarPinned]);

  const handleToggleGroup = useCallback((groupId) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      saveCollapsedGroups(next);
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback((id) => {
    const next = toggleFavoriteFlowId(id);
    setFavoriteIds(new Set(next));
  }, []);

  const handleArchive = useCallback((id) => {
    const next = archiveFlowId(id);
    setArchivedIds(new Set(next));
    onArchiveFlow?.(id);
  }, [onArchiveFlow]);

  const handleSelectFlow = useCallback((id) => {
    if (id) {
      pushRecentFlow(id);
      setRecentFlows(loadRecentFlows());
    }
    onSelectListItem?.(id);
  }, [onSelectListItem]);

  const filterKeys = SECTION_PANEL_CONFIG[section]?.filterKeys ?? [];

  const blocksHintKey = 'cicada_hint_templates_v1';
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return localStorage.getItem(blocksHintKey) === '1';
    } catch {
      return false;
    }
  });

  const panelTitle = sectionLabel(lang, section);
  const brandTitle = 'Cicada';
  const brandSubtitle = lang === 'en'
    ? 'Bot Workspace'
    : lang === 'uk'
      ? 'Робочий простір'
      : 'Bot Workspace';

  const isEditorSection = section === 'flows' || section === 'automations' || section === 'templates';

  const showBlockPalette = Boolean(
    palette
    && (mobileBlocksMode || (canvasFirst
      ? isEditorSection
      : (section === 'templates'
        || ((section === 'flows' || section === 'automations') && activeListId)))),
  );

  const showFlowsListInline = (section === 'flows' || section === 'automations') && !canvasFirst;
  const showCanvasFirstFlows = !mobileBlocksMode && canvasFirst && (section === 'flows' || section === 'automations');

  const genericEmpty = useMemo(() => {
    if (section === 'broadcasts') {
      return {
        icon: '📢',
        title: lang === 'en' ? 'Broadcasts' : 'Рассылки',
        hint: lang === 'en' ? 'Schedule campaigns from your flows.' : 'Планируйте рассылки из сценариев.',
        action: () => { setSection('flows'); onGoToAutomation?.(); },
        actionLabel: lang === 'en' ? 'Open flows' : 'К сценариям',
      };
    }
    if (section === 'audience') {
      return {
        icon: '👥',
        title: lang === 'en' ? 'Audience' : 'Аудитория',
        hint: lang === 'en' ? 'Subscribers appear when the bot runs.' : 'Подписчики появятся после запуска бота.',
        action: () => { setSection('flows'); onGoToAutomation?.(); },
        actionLabel: lang === 'en' ? 'Open flows' : 'К сценариям',
      };
    }
    return null;
  }, [section, lang, setSection, onGoToAutomation]);

  return (
    <div
      className={[
        'mc-sidebar tw-flex tw-h-full tw-min-h-0 tw-overflow-hidden',
        canvasFirst ? 'mc-sidebar--canvas-first' : '',
        compactMode ? 'mc-sidebar--compact' : '',
        showContent ? 'mc-sidebar--expanded' : '',
      ].filter(Boolean).join(' ')}
      data-zone="left"
      data-tour="sidebar-desktop"
    >
      <McSidebarNav
        lang={lang}
        section={section}
        onSectionChange={handleSectionChange}
        compact={compactMode && !sidebarPinned}
        counts={navCounts}
      />

      <AnimatePresence>
        {showContent && (
          <motion.div
            key="sidebar-main"
            className="mc-sidebar__main"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={MC_SPRING.panel}
          >
            <div className="mc-sidebar__brand">
              <div className="mc-sidebar__brand-mark">
                <img src={cicadaLogo} alt="" className="mc-sidebar__brand-logo" />
              </div>
              <div className="mc-sidebar__brand-copy">
                <strong className="mc-sidebar__brand-title">{brandTitle}</strong>
                <span className="mc-sidebar__brand-subtitle">{brandSubtitle}</span>
              </div>
            </div>

            {section !== 'analytics' && (
            <header className="mc-sidebar__head">
              <h2 className="mc-sidebar__title">
                {canvasFirst && isEditorSection
                  ? p.blocksPalette
                  : panelTitle}
              </h2>
              {(section === 'flows' || section === 'automations') && (
                <span className="mc-sidebar__section-badge">
                  {listItems.length || 0}
                </span>
              )}
              <div className="mc-sidebar__head-actions">
                <Tooltip.Provider delayDuration={200}>
                  {!isMobile && (
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          type="button"
                          className="mc-sidebar-icon-btn"
                          aria-pressed={sidebarCompact}
                          onClick={() => {
                            setSidebarCompact(!sidebarCompact);
                            if (sidebarCompact) setSidebarPinned(true);
                          }}
                        >
                          {SidebarIcons.panel}
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content side="bottom" className="mc-sidebar-tooltip">
                          {lang === 'en' ? 'Compact sidebar' : 'Компактная панель'}
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  )}
                </Tooltip.Provider>
              </div>
            </header>
            )}

            {showCanvasFirstFlows && (
              <FlowSwitcher
                lang={lang}
                items={flowListItems}
                activeListId={activeListId}
                activeFlowName={activeFlowName}
                onSelectListItem={handleSelectFlow}
                onCreateFlow={onCreateFlow}
                onOpenFlowsDrawer={() => setFlowsDrawerOpen(true)}
              />
            )}

            {showFlowsListInline && (
              <McSidebarFlowsPanel
                lang={lang}
                section={section}
                items={listItems}
                activeListId={activeListId}
                activeFlowName={activeFlowName}
                listSearch={listSearch}
                listFilter={listFilter}
                favoriteIds={favoriteIds}
                archivedIds={archivedIds}
                recentIds={recentFlows}
                collapsedGroups={collapsedGroups}
                onToggleGroup={handleToggleGroup}
                listLoading={listLoading}
                bulkSelectedIds={bulkSelectedIds}
                onToggleBulkId={toggleBulkId}
                onSelectListItem={handleSelectFlow}
                onToggleFavorite={handleToggleFavorite}
                onDuplicateFlow={onDuplicateFlow}
                onTestFlow={onTestFlow}
                onExportFlow={onExportFlow}
                onArchiveFlow={handleArchive}
                onApplyTemplate={onApplyTemplate}
                onOpenAi={onOpenAi}
                onCreateFlow={onCreateFlow}
                setListSearch={setListSearch}
                setListFilter={setListFilter}
                filterKeys={filterKeys}
              />
            )}

            {showBlockPalette && (
              <div
                className={[
                  'mc-sidebar-panel mc-sidebar-panel--templates mc-sidebar-panel--blocks',
                  canvasFirst ? 'mc-sidebar-panel--blocks-only' : '',
                ].filter(Boolean).join(' ')}
                data-tour="block-palette"
              >
                {!mobileBlocksMode && !hintDismissed && section === 'templates' && (
                  <div className="mc-sidebar-hint">
                    <ContextualHint
                      icon="📋"
                      title={lang === 'en' ? 'Templates' : 'Шаблоны'}
                      text={p.dragStepHint}
                      actions={[{
                        id: 'ok',
                        label: lang === 'en' ? 'Got it' : 'Понятно',
                        onClick: () => {
                          setHintDismissed(true);
                          try { localStorage.setItem(blocksHintKey, '1'); } catch { /* */ }
                        },
                      }]}
                      onDismiss={() => {
                        setHintDismissed(true);
                        try { localStorage.setItem(blocksHintKey, '1'); } catch { /* */ }
                      }}
                    />
                  </div>
                )}
                {!mobileBlocksMode && (section === 'flows' || section === 'automations') && activeListId && (
                  <div className="mc-sidebar-blocks-label">
                    {p.blocksPalette}
                  </div>
                )}
                <div className="mc-sidebar-panel__scroll mc-sidebar-panel__scroll--palette">
                  {palette}
                </div>
              </div>
            )}

            {section === 'analytics' && (
              <div className="mc-sidebar-panel mc-sidebar-panel--analytics">
                <AnalyticsWorkspace
                  flowId={analyticsFlowId}
                  nodeIds={analyticsNodeIds}
                  lang={lang}
                  getGraphDocument={getGraphDocument}
                  onHighlightNodes={onHighlightNodes}
                  lastTraceId={lastTraceId}
                  onPopout={onAnalyticsPopout}
                />
              </div>
            )}

            {(section === 'settings' || section === 'broadcasts' || section === 'audience') && (
              <div className="mc-sidebar-panel">
                {section === 'settings' && listItems.length > 0 ? (
                  <div className="mc-sidebar-panel__scroll">
                    {listItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mc-sidebar-settings-row"
                        onClick={() => onSelectListItem?.(item.id)}
                      >
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                ) : genericEmpty ? (
                  <EmptyState
                    icon={genericEmpty.icon}
                    title={genericEmpty.title}
                    hint={genericEmpty.hint}
                    actions={genericEmpty.action ? (
                      <button
                        type="button"
                        className="mc-sidebar-btn mc-sidebar-btn--primary"
                        onClick={genericEmpty.action}
                      >
                        {genericEmpty.actionLabel}
                      </button>
                    ) : null}
                  />
                ) : null}
                {section === 'settings' && (onOpenModuleLibrary || onOpenEsphome) && (
                  <footer className="mc-sidebar-footer">
                    {onOpenModuleLibrary && (
                      <button type="button" className="mc-sidebar-footer__link" onClick={onOpenModuleLibrary}>
                        {lang === 'en' ? 'Module library' : 'Библиотека модулей'}
                      </button>
                    )}
                    {onOpenEsphome && (
                      <button type="button" className="mc-sidebar-footer__link" onClick={onOpenEsphome}>
                        ESPHome
                      </button>
                    )}
                  </footer>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {canvasFirst && (
        <FlowsDrawer
          open={flowsDrawerOpen}
          onClose={() => setFlowsDrawerOpen(false)}
          lang={lang}
          section={section === 'automations' ? 'automations' : 'flows'}
          items={flowListItems}
          activeListId={activeListId}
          activeFlowName={activeFlowName}
          listSearch={listSearch}
          listFilter={listFilter}
          favoriteIds={favoriteIds}
          archivedIds={archivedIds}
          recentIds={recentFlows}
          collapsedGroups={collapsedGroups}
          onToggleGroup={handleToggleGroup}
          listLoading={listLoading}
          bulkSelectedIds={bulkSelectedIds}
          onToggleBulkId={toggleBulkId}
          onSelectListItem={handleSelectFlow}
          onToggleFavorite={handleToggleFavorite}
          onDuplicateFlow={onDuplicateFlow}
          onTestFlow={onTestFlow}
          onExportFlow={onExportFlow}
          onArchiveFlow={handleArchive}
          onApplyTemplate={onApplyTemplate}
          onOpenAi={onOpenAi}
          onCreateFlow={onCreateFlow}
          setListSearch={setListSearch}
          setListFilter={setListFilter}
          filterKeys={filterKeys}
        />
      )}
    </div>
  );
}
