import React, { useEffect, useMemo, useState } from 'react';
import { APP_SECTIONS, sectionLabel } from './appSections.js';
import { useAppLayout } from './AppLayoutContext.jsx';
import {
  SECTION_PANEL_CONFIG,
  filterLabel,
  itemMatchesFilter,
  listTitleForSection,
} from './controlPanelConfig.js';
import EmptyState from '../ui/EmptyState.jsx';
import { SkeletonList } from '../ui/Skeleton.jsx';

/**
 * SaaS-style left control panel: global actions, sections, searchable lists, bulk actions.
 */
export default function LeftPanel({
  lang = 'ru',
  sectionListItems = {},
  activeListId = null,
  onSelectListItem,
  onCreateFlow,
  onBulkDelete,
  onOpenModuleLibrary,
  onOpenEsphome,
  onGoToAutomation,
  listLoading = false,
  palette = null,
}) {
  const {
    section,
    setSection,
    listSearch,
    setListSearch,
    listFilter,
    setListFilter,
    bulkSelectedIds,
    setBulkSelectedIds,
    toggleBulkId,
    clearBulkSelection,
  } = useAppLayout();

  const listItems = sectionListItems[section] || [];
  const panelConfig = SECTION_PANEL_CONFIG[section] || SECTION_PANEL_CONFIG.automation;
  const filterKeys = panelConfig.filterKeys;

  useEffect(() => {
    setListFilter('all');
    clearBulkSelection();
  }, [section, setListFilter, clearBulkSelection]);

  const filteredItems = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return listItems.filter((item) => {
      if (q && !String(item.name || '').toLowerCase().includes(q)) return false;
      return itemMatchesFilter(item, listFilter, section);
    });
  }, [listItems, listSearch, listFilter, section]);

  const visibleIds = useMemo(
    () => filteredItems.map((i) => i.id).filter(Boolean),
    [filteredItems],
  );

  const allVisibleSelected = visibleIds.length > 0
    && visibleIds.every((id) => bulkSelectedIds.has(id));

  const bulkCount = bulkSelectedIds.size;

  const searchPh = lang === 'en' ? 'Search…' : lang === 'uk' ? 'Пошук…' : 'Поиск…';
  const listTitle = listTitleForSection(lang, section);
  const selectAllLabel = lang === 'en' ? 'Select all' : lang === 'uk' ? 'Вибрати все' : 'Выбрать все';
  const clearLabel = lang === 'en' ? 'Clear' : lang === 'uk' ? 'Скинути' : 'Сбросить';
  const deleteLabel = lang === 'en' ? 'Delete' : lang === 'uk' ? 'Видалити' : 'Удалить';
  const bulkLabel = lang === 'en'
    ? `${bulkCount} selected`
    : lang === 'uk'
      ? `Обрано: ${bulkCount}`
      : `Выбрано: ${bulkCount}`;

  const showPalette = section === 'automation' && palette;
  const canBulkDelete = section === 'automation' && Boolean(onBulkDelete);
  const [automationRailTab, setAutomationRailTab] = useState('blocks');

  useEffect(() => {
    if (section === 'automation') setAutomationRailTab('blocks');
  }, [section]);

  const blocksTabLabel = lang === 'en' ? 'Blocks' : lang === 'uk' ? 'Блоки' : 'Блоки';
  const flowsTabLabel = lang === 'en' ? 'Scenarios' : lang === 'uk' ? 'Сценарії' : 'Сценарии';
  const showBlocksRail = showPalette && automationRailTab === 'blocks';
  const showFlowsRail = section !== 'automation' || automationRailTab === 'flows';

  const emptyCopy = useMemo(() => {
    if (section === 'automation') {
      return {
        icon: '⚡',
        title: lang === 'en' ? 'Your flows will appear here' : lang === 'uk' ? 'Тут з’являться сценарії' : 'Здесь появятся сценарии',
        hint: lang === 'en'
          ? 'Open the Blocks tab, drag items to the canvas, or pick a template.'
          : lang === 'uk'
            ? 'Відкрийте вкладку «Блоки», перетягніть їх на полотно або оберіть шаблон.'
            : 'Откройте вкладку «Блоки», перетащите их на холст или выберите шаблон.',
        primary: lang === 'en' ? 'Create Flow' : lang === 'uk' ? 'Створити flow' : 'Создать сценарий',
      };
    }
    if (section === 'broadcasts') {
      return {
        icon: '📢',
        title: lang === 'en' ? 'Plan your first broadcast' : 'Запланируйте первую рассылку',
        hint: lang === 'en'
          ? 'Build an automation on the canvas first, then schedule campaigns here.'
          : 'Сначала соберите сценарий на холсте, затем настройте рассылку.',
        primary: lang === 'en' ? 'Open Automation' : 'Открыть автоматизацию',
        action: 'automation',
      };
    }
    if (section === 'audience') {
      return {
        icon: '👥',
        title: lang === 'en' ? 'Grow your audience' : 'Соберите аудиторию',
        hint: lang === 'en'
          ? 'Run your bot from a flow, then subscribers and segments will show up here.'
          : 'Запустите бота из сценария — подписчики появятся в этом разделе.',
        primary: lang === 'en' ? 'Open Automation' : 'Открыть автоматизацию',
        action: 'automation',
      };
    }
    return {
      icon: '⚙',
      title: lang === 'en' ? 'Workspace settings' : 'Настройки рабочей области',
      hint: lang === 'en' ? 'Open the module library or bot profile below.' : 'Откройте библиотеку модулей или профиль бота ниже.',
      primary: lang === 'en' ? 'Module library' : 'Библиотека модулей',
      action: 'modules',
    };
  }, [section, lang]);

  const handleSelectAll = () => {
    if (allVisibleSelected) {
      const next = new Set(bulkSelectedIds);
      visibleIds.forEach((id) => next.delete(id));
      setBulkSelectedIds(next);
    } else {
      const next = new Set(bulkSelectedIds);
      visibleIds.forEach((id) => next.add(id));
      setBulkSelectedIds(next);
    }
  };

  const handleBulkDelete = () => {
    const ids = [...bulkSelectedIds].filter((id) => id && id !== '__draft__');
    if (!ids.length || !onBulkDelete) return;
    onBulkDelete(ids);
    clearBulkSelection();
  };

  const handleEmptyPrimary = () => {
    if (emptyCopy.action === 'automation') {
      setSection('automation');
      onGoToAutomation?.();
      return;
    }
    if (emptyCopy.action === 'modules') {
      onOpenModuleLibrary?.();
      return;
    }
    onCreateFlow?.();
  };

  const renderListBody = () => {
    if (listLoading) {
      return <SkeletonList rows={5} />;
    }
    if (filteredItems.length === 0) {
      const isSearch = Boolean(listSearch.trim());
      if (section === 'automation' && !isSearch) {
        return (
          <p className="control-panel__flows-hint">
            {lang === 'en'
              ? 'Saved scenarios will appear here after you publish.'
              : lang === 'uk'
                ? 'Збережені сценарії з’являться тут після публікації.'
                : 'Сохранённые сценарии появятся здесь после публикации.'}
          </p>
        );
      }
      return (
        <EmptyState
          icon={emptyCopy.icon}
          title={isSearch
            ? (lang === 'en' ? 'No results for this search' : lang === 'uk' ? 'Немає результатів' : 'Нет результатов поиска')
            : emptyCopy.title}
          hint={isSearch
            ? (lang === 'en' ? 'Clear the search or try another filter.' : 'Сбросьте поиск или смените фильтр.')
            : emptyCopy.hint}
          actions={!isSearch && emptyCopy.primary ? (
            <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" onClick={handleEmptyPrimary}>
              {emptyCopy.primary}
            </button>
          ) : null}
        />
      );
    }
    return filteredItems.map((item) => {
      const selected = bulkSelectedIds.has(item.id);
      const active = activeListId === item.id;
      return (
        <div
          key={item.id}
          className={`control-panel__row${active ? ' control-panel__row--active' : ''}`}
        >
          <input
            type="checkbox"
            className="control-panel__row-check"
            checked={selected}
            onChange={() => toggleBulkId(item.id)}
            aria-label={item.name || item.id}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className={`control-panel__row-btn${active ? ' active' : ''}`}
            onClick={() => onSelectListItem?.(item.id)}
          >
            <span className="control-panel__row-name">{item.name || item.id}</span>
            {item.subtitle && (
              <span className="app-left__list-item-meta">{item.subtitle}</span>
            )}
            {item.updatedAt && (
              <span className="app-left__list-item-meta">{item.updatedAt}</span>
            )}
            {item.status && item.status !== 'active' && (
              <span className={`control-panel__status control-panel__status--${item.status}`}>
                {filterLabel(lang, section, item.status) || item.status}
              </span>
            )}
          </button>
        </div>
      );
    });
  };

  return (
    <div className="control-panel app-zone app-zone--left" data-zone="left">

      <nav className="app-nav control-panel__nav" aria-label="Main navigation">
        {APP_SECTIONS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`app-nav__item${section === entry.id ? ' active' : ''}`}
            onClick={() => setSection(entry.id)}
          >
            <span className="app-nav__icon" aria-hidden>{entry.icon}</span>
            {sectionLabel(lang, entry.id)}
          </button>
        ))}
      </nav>

      {section === 'automation' && showPalette && (
        <div className="control-panel__rail-tabs" role="tablist" aria-label={lang === 'en' ? 'Automation panel' : 'Панель автоматизации'}>
          <button
            type="button"
            role="tab"
            aria-selected={automationRailTab === 'blocks'}
            className={`control-panel__rail-tab${automationRailTab === 'blocks' ? ' active' : ''}`}
            onClick={() => setAutomationRailTab('blocks')}
          >
            🧱 {blocksTabLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={automationRailTab === 'flows'}
            className={`control-panel__rail-tab${automationRailTab === 'flows' ? ' active' : ''}`}
            onClick={() => setAutomationRailTab('flows')}
          >
            ⚡ {flowsTabLabel}
          </button>
        </div>
      )}

      {showBlocksRail && (
        <div className="app-left__palette control-panel__palette" data-tour="block-palette">
          <div className="app-zone__scroll control-panel__palette-scroll">
            {palette}
          </div>
        </div>
      )}

      {showFlowsRail && (
        <div className={`control-panel__flows${section === 'automation' ? ' control-panel__flows--rail' : ''}`}>
          <div className="control-panel__tools app-left__tools">
            <input
              type="search"
              className="app-left__search"
              placeholder={searchPh}
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              aria-label={searchPh}
            />
            <div className="app-left__filters" role="group" aria-label="List filters">
              {filterKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`app-left__filter-chip${listFilter === key ? ' active' : ''}`}
                  onClick={() => setListFilter(key)}
                >
                  {filterLabel(lang, section, key)}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length > 0 && (
            <div className="control-panel__bulk" role="toolbar" aria-label="Bulk actions">
              <label className="control-panel__bulk-check">
                <input
                  type="checkbox"
                  checked={allVisibleSelected && visibleIds.length > 0}
                  onChange={handleSelectAll}
                  disabled={visibleIds.length === 0 || listLoading}
                />
                <span>{selectAllLabel}</span>
              </label>
              {bulkCount > 0 && (
                <>
                  <span className="control-panel__bulk-count">{bulkLabel}</span>
                  <button type="button" className="control-panel__bulk-btn" onClick={clearBulkSelection}>
                    {clearLabel}
                  </button>
                  {canBulkDelete && (
                    <button
                      type="button"
                      className="control-panel__bulk-btn control-panel__bulk-btn--danger"
                      onClick={handleBulkDelete}
                    >
                      {deleteLabel}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <div className="app-zone__header control-panel__list-header">
            <div className="app-zone__title">
              <span aria-hidden>{APP_SECTIONS.find((s) => s.id === section)?.icon}</span>
              {listTitle}
            </div>
          </div>

          <div className="control-panel__list app-left__list">
            {renderListBody()}
          </div>
        </div>
      )}

      {section === 'automation' && (onOpenModuleLibrary || onOpenEsphome) && (
        <div className="control-panel__section-actions">
          {onOpenModuleLibrary && (
            <button type="button" className="app-left__cta app-left__cta--secondary" onClick={onOpenModuleLibrary}>
              📚 {lang === 'en' ? 'Module library' : 'Библиотека модулей'}
            </button>
          )}
          {onOpenEsphome && (
            <button type="button" className="app-left__cta app-left__cta--secondary" onClick={onOpenEsphome}>
              ⚡ ESPHome
            </button>
          )}
        </div>
      )}
    </div>
  );
}
