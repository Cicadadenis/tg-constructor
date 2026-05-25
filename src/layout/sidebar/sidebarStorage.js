const FAVORITES_KEY = 'cicada_flow_favorites';
const RECENT_KEY = 'cicada_flow_recent';
const COMPACT_KEY = 'cicada_sidebar_compact';
const GROUPS_KEY = 'cicada_sidebar_groups_collapsed';
const ARCHIVED_KEY = 'cicada_flow_archived';

/** @returns {Set<string>} */
export function loadFavoriteFlowIds() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

/** @param {Set<string>|string[]} ids */
export function saveFavoriteFlowIds(ids) {
  try {
    const arr = ids instanceof Set ? [...ids] : ids;
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

/** @param {string} id */
export function toggleFavoriteFlowId(id) {
  if (!id || id === '__draft__') return loadFavoriteFlowIds();
  const set = loadFavoriteFlowIds();
  if (set.has(id)) set.delete(id);
  else set.add(id);
  saveFavoriteFlowIds(set);
  return set;
}

/** @returns {{ id: string; at: number }[]} */
export function loadRecentFlows() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => x?.id) : [];
  } catch {
    return [];
  }
}

/** @param {string} id */
export function pushRecentFlow(id) {
  if (!id || id === '__draft__') return;
  const list = loadRecentFlows().filter((x) => x.id !== id);
  list.unshift({ id, at: Date.now() });
  const trimmed = list.slice(0, 12);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

export function readSidebarCompact() {
  try {
    return localStorage.getItem(COMPACT_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSidebarCompact(compact) {
  try {
    localStorage.setItem(COMPACT_KEY, compact ? '1' : '0');
  } catch { /* ignore */ }
}

/** @returns {Record<string, boolean>} groupId -> collapsed */
export function loadCollapsedGroups() {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, boolean>} state */
export function saveCollapsedGroups(state) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

/** @returns {Set<string>} */
export function loadArchivedFlowIds() {
  try {
    const raw = localStorage.getItem(ARCHIVED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

/** @param {Set<string>|string[]} ids */
export function saveArchivedFlowIds(ids) {
  try {
    const arr = ids instanceof Set ? [...ids] : ids;
    localStorage.setItem(ARCHIVED_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

/** @param {string} id */
export function archiveFlowId(id) {
  if (!id || id === '__draft__') return loadArchivedFlowIds();
  const set = loadArchivedFlowIds();
  set.add(id);
  saveArchivedFlowIds(set);
  return set;
}
