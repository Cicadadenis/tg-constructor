import React, { useEffect, useMemo, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { getFlowStarterTemplates } from '../../builder/flowTemplates.js';
import { SECTION_PANEL_CONFIG, filterLabel, itemMatchesFilter } from '../controlPanelConfig.js';
import { sortFlowItems } from '../flowCardModel.js';
import EmptyState from '../../ui/EmptyState.jsx';
import { MotionSkeletonList } from '../../motion/MotionSkeleton.jsx';
import McCollapsibleGroup from './McCollapsibleGroup.jsx';
import McFlowCard from './McFlowCard.jsx';
import { SidebarIcons } from './sidebarIcons.jsx';

export default function McSidebarFlowsPanel({
  lang = 'ru',
  section = 'flows',
  items = [],
  activeListId = null,
  listSearch = '',
  listFilter = 'all',
  favoriteIds,
  archivedIds,
  recentIds = [],
  collapsedGroups = {},
  onToggleGroup,
  listLoading = false,
  bulkSelectedIds,
  onToggleBulkId,
  onSelectListItem,
  onToggleFavorite,
  onDuplicateFlow,
  onTestFlow,
  onExportFlow,
  onArchiveFlow,
  onCreateFlow,
  onApplyTemplate,
  onOpenAi,
  setListSearch,
  setListFilter,
  filterKeys: filterKeysProp,
  activeFlowName = '',
}) {
  const panelConfig = SECTION_PANEL_CONFIG[section] || SECTION_PANEL_CONFIG.flows;
  const filterKeys = filterKeysProp ?? panelConfig.filterKeys;
  const [sortBy, setSortBy] = useState('updated');
  const [sortDir, setSortDir] = useState('desc');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [browseFlows, setBrowseFlows] = useState(!activeListId);

  const starterTemplates = useMemo(() => getFlowStarterTemplates(lang), [lang]);

  const filteredAll = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    const base = items.filter((item) => {
      if (q) {
        const hay = `${item.name || ''} ${item.triggerLabel || ''} ${item.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return itemMatchesFilter(item, listFilter, section, favoriteIds, archivedIds);
    });
    return sortFlowItems(base, sortBy, sortDir);
  }, [items, listSearch, listFilter, section, favoriteIds, archivedIds, sortBy, sortDir]);

  const favoriteItems = useMemo(
    () => filteredAll.filter((i) => favoriteIds?.has(i.id)),
    [filteredAll, favoriteIds],
  );

  const recentItems = useMemo(() => {
    const order = recentIds.map((r) => r.id);
    return order
      .map((id) => filteredAll.find((i) => i.id === id))
      .filter(Boolean)
      .slice(0, 6);
  }, [filteredAll, recentIds]);

  const allItems = useMemo(() => {
    if (listFilter === 'favorites') return favoriteItems;
    return filteredAll;
  }, [filteredAll, favoriteItems, listFilter]);

  const bulkCount = bulkSelectedIds?.size ?? 0;
  const searchPh = lang === 'en' ? 'Search flows…' : lang === 'uk' ? 'Пошук…' : 'Поиск сценариев…';
  const sortLabel = lang === 'en' ? 'Sort' : lang === 'uk' ? 'Сортування' : 'Сортировка';

  const createLabel = lang === 'en' ? 'New flow' : lang === 'uk' ? 'Новий flow' : 'Новый сценарий';
  const templateLabel = lang === 'en' ? 'From template' : 'Из шаблона';
  const aiLabel = lang === 'en' ? 'AI generate' : 'Через AI';
  const editingLabel = lang === 'en' ? 'Editing on canvas' : 'Редактирование на холсте';
  const browseLabel = lang === 'en' ? 'All flows' : 'Все сценарии';
  const canvasHint = lang === 'en'
    ? 'Build automation on the main canvas. Open the list to switch flows.'
    : 'Собирайте автоматизацию на главном холсте. Откройте список для переключения.';

  useEffect(() => {
    setBrowseFlows(!activeListId);
  }, [activeListId]);

  const renderCards = (list) => list.map((item) => (
    <McFlowCard
      key={item.id}
      item={item}
      lang={lang}
      active={activeListId === item.id}
      favorite={favoriteIds?.has(item.id)}
      selected={bulkSelectedIds?.has(item.id)}
      showCheckbox={bulkCount > 0}
      onSelect={onSelectListItem}
      onToggleSelect={onToggleBulkId}
      onToggleFavorite={onToggleFavorite}
      onTest={onTestFlow}
      onDuplicate={onDuplicateFlow}
      onExport={onExportFlow}
      onArchive={onArchiveFlow}
      onQuickEdit={onSelectListItem}
    />
  ));

  const emptyTitle = lang === 'en' ? 'No flows yet' : lang === 'uk' ? 'Ще немає сценаріїв' : 'Пока нет сценариев';

  return (
    <div className="mc-sidebar-panel mc-sidebar-panel--flows">
      {activeListId && !browseFlows && (
        <div className="mc-flows-panel__editor-mode">
          <div className="mc-flows-panel__editor-mode-head">
            <span className="mc-flows-panel__editor-mode-label">{editingLabel}</span>
            <strong className="mc-flows-panel__editor-mode-name">{activeFlowName || '…'}</strong>
          </div>
          <p className="mc-flows-panel__editor-mode-hint">{canvasHint}</p>
          <button
            type="button"
            className="mc-flows-panel__editor-mode-btn"
            onClick={() => setBrowseFlows(true)}
          >
            {browseLabel}
          </button>
        </div>
      )}

      {(browseFlows || !activeListId) && (
      <>
      <div className="mc-flows-panel__create-strip">
        <button type="button" className="mc-flows-panel__create-primary" onClick={onCreateFlow}>
          {SidebarIcons.plus}
          {createLabel}
        </button>
        <div className="mc-flows-panel__create-row">
          <DropdownMenu.Root open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="mc-flows-panel__create-secondary">
                📋 {templateLabel}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="mc-flow-card__dropdown" sideOffset={6} align="start">
                <div className="mc-flows-panel__templates-pop">
                  {starterTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="mc-flows-panel__template-opt"
                      onClick={() => {
                        setTemplatesOpen(false);
                        onApplyTemplate?.(tpl.id);
                      }}
                    >
                      <span className="mc-flows-panel__template-opt-icon">{tpl.icon}</span>
                      <span className="mc-flows-panel__template-opt-text">
                        <strong>{tpl.name}</strong>
                        <span>{tpl.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button
            type="button"
            className="mc-flows-panel__create-secondary mc-flows-panel__create-secondary--ai"
            onClick={onOpenAi}
          >
            ✨ {aiLabel}
          </button>
        </div>
      </div>

      <div className="mc-sidebar-panel__toolbar">
        <div className="mc-sidebar-search">
          {SidebarIcons.search}
          <input
            type="search"
            className="mc-sidebar-search__input"
            placeholder={searchPh}
            value={listSearch}
            onChange={(e) => setListSearch?.(e.target.value)}
            aria-label={searchPh}
          />
        </div>
      </div>

      <div className="mc-flows-panel__sort">
        <span className="mc-flows-panel__sort-label">{sortLabel}</span>
        <select
          className="mc-flows-panel__sort-select"
          value={`${sortBy}-${sortDir}`}
          onChange={(e) => {
            const [by, dir] = e.target.value.split('-');
            setSortBy(by);
            setSortDir(dir);
          }}
          aria-label={sortLabel}
        >
          <option value="updated-desc">{lang === 'en' ? 'Recently updated' : 'По обновлению'}</option>
          <option value="updated-asc">{lang === 'en' ? 'Oldest first' : 'Старые'}</option>
          <option value="name-asc">{lang === 'en' ? 'Name A–Z' : 'Имя А–Я'}</option>
          <option value="name-desc">{lang === 'en' ? 'Name Z–A' : 'Имя Я–А'}</option>
          <option value="status-asc">{lang === 'en' ? 'Status' : 'По статусу'}</option>
        </select>
      </div>

      {filterKeys.length > 0 && (
        <div className="mc-sidebar-filters" role="group" aria-label="Filters">
          {filterKeys.map((key) => (
            <button
              key={key}
              type="button"
              className={`mc-sidebar-filter${listFilter === key ? ' mc-sidebar-filter--active' : ''}`}
              onClick={() => setListFilter?.(key)}
            >
              {key === 'favorites' ? '★ ' : ''}
              {filterLabel(lang, section, key)}
            </button>
          ))}
        </div>
      )}

      <div className="mc-sidebar-panel__scroll mc-sidebar-panel__scroll--cards">
        {listLoading ? (
          <MotionSkeletonList rows={3} />
        ) : (
          <>
            {listFilter !== 'favorites' && favoriteItems.length > 0 && (
              <McCollapsibleGroup
                id="favorites"
                title={lang === 'en' ? 'Favorites' : 'Избранное'}
                count={favoriteItems.length}
                collapsed={collapsedGroups.favorites}
                onToggle={() => onToggleGroup?.('favorites')}
              >
                {renderCards(favoriteItems)}
              </McCollapsibleGroup>
            )}

            {listFilter === 'all' && recentItems.length > 0 && (
              <McCollapsibleGroup
                id="recent"
                title={lang === 'en' ? 'Recent' : 'Недавние'}
                count={recentItems.length}
                collapsed={collapsedGroups.recent}
                onToggle={() => onToggleGroup?.('recent')}
              >
                {renderCards(recentItems)}
              </McCollapsibleGroup>
            )}

            <McCollapsibleGroup
              id="all"
              title={section === 'automations'
                ? (lang === 'en' ? 'Active automations' : 'Активные')
                : (lang === 'en' ? 'All flows' : 'Все сценарии')}
              count={allItems.length}
              collapsed={collapsedGroups.all}
              onToggle={() => onToggleGroup?.('all')}
            >
              {allItems.length === 0 ? (
                <EmptyState
                  icon="⚡"
                  title={emptyTitle}
                  hint={lang === 'en' ? 'Create from scratch, template, or AI.' : 'Создайте с нуля, из шаблона или через AI.'}
                  actions={(
                    <button type="button" className="mc-flows-panel__create-primary" onClick={onCreateFlow}>
                      {createLabel}
                    </button>
                  )}
                />
              ) : (
                renderCards(allItems)
              )}
            </McCollapsibleGroup>
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
}
