import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MC_SPRING, slideInLeft } from '../../motion/index.js';
import McSidebarFlowsPanel from '../sidebar/McSidebarFlowsPanel.jsx';

/**
 * Slide-over flows library — keeps center canvas visible (canvas-first).
 */
export default function FlowsDrawer({
  open = false,
  onClose,
  lang = 'ru',
  section = 'flows',
  items = [],
  activeListId = null,
  activeFlowName = '',
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
  onApplyTemplate,
  onOpenAi,
  onCreateFlow,
  setListSearch,
  setListFilter,
  filterKeys,
}) {
  const title = lang === 'en' ? 'Flows' : lang === 'uk' ? 'Сценарії' : 'Сценарии';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="cf-flows-drawer__backdrop"
            aria-label={lang === 'en' ? 'Close' : 'Закрыть'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="cf-flows-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={slideInLeft.initial}
            animate={slideInLeft.animate}
            exit={slideInLeft.exit}
            transition={MC_SPRING.overlay}
          >
            <header className="cf-flows-drawer__head">
              <h2 className="cf-flows-drawer__title">{title}</h2>
              <button type="button" className="cf-flows-drawer__close" onClick={onClose} aria-label="×">
                ×
              </button>
            </header>
            <McSidebarFlowsPanel
              lang={lang}
              section={section}
              items={items}
              activeListId={activeListId}
              activeFlowName={activeFlowName}
              listSearch={listSearch}
              listFilter={listFilter}
              favoriteIds={favoriteIds}
              archivedIds={archivedIds}
              recentIds={recentIds}
              collapsedGroups={collapsedGroups}
              onToggleGroup={onToggleGroup}
              listLoading={listLoading}
              bulkSelectedIds={bulkSelectedIds}
              onToggleBulkId={onToggleBulkId}
              onSelectListItem={(id) => {
                onSelectListItem?.(id);
                onClose?.();
              }}
              onToggleFavorite={onToggleFavorite}
              onDuplicateFlow={onDuplicateFlow}
              onTestFlow={onTestFlow}
              onExportFlow={onExportFlow}
              onArchiveFlow={onArchiveFlow}
              onApplyTemplate={onApplyTemplate}
              onOpenAi={onOpenAi}
              onCreateFlow={onCreateFlow}
              setListSearch={setListSearch}
              setListFilter={setListFilter}
              filterKeys={filterKeys}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
