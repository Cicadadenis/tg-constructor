import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

/** @typedef {'canvas' | 'left' | 'right'} MobileZone */

const AppLayoutContext = createContext(null);

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {boolean} [props.isMobile]
 * @param {string} [props.section]
 * @param {(s: string) => void} [props.setSection]
 * @param {MobileZone} [props.mobileZone]
 * @param {(z: MobileZone) => void} [props.setMobileZone]
 * @param {string} [props.listSearch]
 * @param {(q: string) => void} [props.setListSearch]
 * @param {string} [props.listFilter]
 * @param {(f: string) => void} [props.setListFilter]
 */
export function AppLayoutProvider({
  children,
  isMobile = false,
  section: controlledSection,
  setSection: controlledSetSection,
  mobileZone: controlledMobileZone,
  setMobileZone: controlledSetMobileZone,
  listSearch: controlledListSearch,
  setListSearch: controlledSetListSearch,
  listFilter: controlledListFilter,
  setListFilter: controlledSetListFilter,
}) {
  const [sectionState, setSectionState] = useState('automation');
  const [mobileZoneState, setMobileZoneState] = useState('canvas');
  const [listSearchState, setListSearchState] = useState('');
  const [listFilterState, setListFilterState] = useState('all');
  const [bulkSelectedIdsState, setBulkSelectedIdsState] = useState(() => new Set());
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const section = controlledSection ?? sectionState;
  const setSection = controlledSetSection ?? setSectionState;
  const mobileZone = controlledMobileZone ?? mobileZoneState;
  const setMobileZone = controlledSetMobileZone ?? setMobileZoneState;
  const listSearch = controlledListSearch ?? listSearchState;
  const setListSearch = controlledSetListSearch ?? setListSearchState;
  const listFilter = controlledListFilter ?? listFilterState;
  const setListFilter = controlledSetListFilter ?? setListFilterState;
  const bulkSelectedIds = bulkSelectedIdsState;

  const setBulkSelectedIds = useMemo(() => (ids) => {
    setBulkSelectedIdsState(new Set(ids));
  }, []);

  const toggleBulkId = useMemo(() => (id) => {
    setBulkSelectedIdsState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearBulkSelection = useMemo(() => () => {
    setBulkSelectedIdsState(new Set());
  }, []);

  const toggleLeftRail = useCallback(() => setLeftRailOpen((v) => !v), []);
  const toggleInspector = useCallback(() => {
    setInspectorOpen((v) => {
      if (!v) setInspectorCollapsed(false);
      return !v;
    });
  }, []);
  const toggleInspectorCollapsed = useCallback(() => setInspectorCollapsed((v) => !v), []);
  const toggleFocusMode = useCallback(() => setFocusMode((v) => !v), []);

  const value = useMemo(
    () => ({
      section,
      setSection,
      mobileZone,
      setMobileZone,
      isMobile,
      listSearch,
      setListSearch,
      listFilter,
      setListFilter,
      bulkSelectedIds,
      setBulkSelectedIds,
      toggleBulkId,
      clearBulkSelection,
      leftRailOpen,
      setLeftRailOpen,
      inspectorOpen,
      setInspectorOpen,
      inspectorCollapsed,
      setInspectorCollapsed,
      focusMode,
      setFocusMode,
      toggleLeftRail,
      toggleInspector,
      toggleInspectorCollapsed,
      toggleFocusMode,
    }),
    [
      section,
      setSection,
      mobileZone,
      setMobileZone,
      isMobile,
      listSearch,
      setListSearch,
      listFilter,
      setListFilter,
      bulkSelectedIds,
      setBulkSelectedIds,
      toggleBulkId,
      clearBulkSelection,
      leftRailOpen,
      inspectorOpen,
      inspectorCollapsed,
      focusMode,
      toggleLeftRail,
      toggleInspector,
      toggleInspectorCollapsed,
      toggleFocusMode,
    ],
  );

  return (
    <AppLayoutContext.Provider value={value}>
      {children}
    </AppLayoutContext.Provider>
  );
}

export function useAppLayout() {
  const ctx = useContext(AppLayoutContext);
  if (!ctx) {
    throw new Error('useAppLayout must be used within AppLayoutProvider');
  }
  return ctx;
}

export function useAppLayoutOptional() {
  return useContext(AppLayoutContext);
}
