/**
 * Unified module catalog — graph registry + builtin DSL with badges and actions.
 */

/** @type {Record<string, object>|null} */
let defaultBuiltinById = null;

export function setDefaultBuiltinCatalog(byId) {
  defaultBuiltinById = byId && typeof byId === 'object' ? byId : null;
}

function resolveBuiltinById(moduleId, options = {}) {
  const map = options.builtinById || defaultBuiltinById;
  return map?.[moduleId] || null;
}

export function builtinListToById(categories = []) {
  return Object.fromEntries(
    categories.flatMap((c) => c.items || []).map((m) => [m.id, m]),
  );
}
import { GRAPH_MODULE_REGISTRY, isGraphNativeModule } from '../graph/registry.js';

export const MODULE_KIND = Object.freeze({
  GRAPH: 'graph',
  LEGACY_DSL: 'legacy_dsl',
  MIGRATED_ALIAS: 'migrated_alias',
  NEEDS_MIGRATION: 'needs_migration',
  BROKEN: 'broken',
  REQUIRES_DEPS: 'requires_deps',
});

export const MODULE_BADGE = Object.freeze({
  graph: { id: 'graph', label: 'Graph', color: '#3ecf8e', bg: 'rgba(62,207,142,0.15)' },
  legacy: { id: 'legacy', label: 'Legacy', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  migration: { id: 'migration', label: 'Needs migration', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  migrated: { id: 'migrated', label: 'Migrated', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  experimental: { id: 'experimental', label: 'Experimental', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  deps: { id: 'deps', label: 'Dependencies', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  broken: { id: 'broken', label: 'Broken', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
});

/**
 * @param {string} moduleId
 * @param {Record<string, import('../composition/types.js').GraphModuleManifest>} [registry]
 */
export function classifyModule(moduleId, registry = GRAPH_MODULE_REGISTRY, options = {}) {
  const builtin = resolveBuiltinById(moduleId, options);
  const manifest = registry[moduleId];

  if (manifest) {
    const deps = manifest.dependencies || [];
    return {
      id: moduleId,
      kind: MODULE_KIND.GRAPH,
      badges: [
        MODULE_BADGE.graph,
        ...(deps.length ? [MODULE_BADGE.deps] : []),
      ],
      graphNative: true,
      manifest,
      dependencies: deps,
      canInsert: true,
      canMigrate: false,
      canPreview: true,
      canCompose: true,
      displayName: manifest.name || moduleDisplayName(moduleId),
      description: builtin?.desc || '',
    };
  }

  if (!builtin) {
    return {
      id: moduleId,
      kind: MODULE_KIND.BROKEN,
      badges: [MODULE_BADGE.broken],
      graphNative: false,
      canInsert: false,
      canMigrate: false,
      canPreview: false,
      displayName: moduleId,
      incompatibilityReason: 'Модуль не найден в каталоге',
    };
  }

  const hasCode = Boolean(String(builtin.code || '').trim());
  if (!hasCode) {
    return {
      id: moduleId,
      kind: MODULE_KIND.BROKEN,
      badges: [MODULE_BADGE.broken, MODULE_BADGE.legacy],
      graphNative: false,
      builtin,
      canInsert: false,
      canMigrate: false,
      canPreview: false,
      displayName: builtin.name,
      incompatibilityReason: 'Пустой DSL-код модуля',
    };
  }

  return {
    id: moduleId,
    kind: MODULE_KIND.LEGACY_DSL,
    badges: [MODULE_BADGE.legacy, MODULE_BADGE.migration],
    graphNative: false,
    builtin,
    canInsert: false,
    canMigrate: true,
    canPreview: true,
    canCompose: false,
    canInsertIsolated: true,
    displayName: builtin.name,
    description: builtin.desc || '',
    legacyNotice: 'Этот модуль использует старую DSL-архитектуру (текстовый сценарий).',
  };
}

/**
 * @param {Record<string, import('../composition/types.js').GraphModuleManifest>} [registry]
 */
export function buildModuleCatalog(registry = GRAPH_MODULE_REGISTRY, options = {}) {
  const entries = new Map();
  const builtinById = options.builtinById || defaultBuiltinById || {};

  for (const id of Object.keys(registry)) {
    entries.set(id, classifyModule(id, registry, { builtinById }));
  }

  for (const mod of Object.values(builtinById)) {
    if (!entries.has(mod.id)) {
      entries.set(mod.id, classifyModule(mod.id, registry, { builtinById }));
    }
  }

  return entries;
}

/**
 * Categories for library UI (builtin categories + graph-only entries).
 */
export function buildLibraryCategories(builtinCategories, registry = GRAPH_MODULE_REGISTRY, lang = 'ru') {
  const builtinById = builtinListToById(builtinCategories);
  const catalog = buildModuleCatalog(registry, { builtinById });
  return (builtinCategories || []).map((cat) => ({
    categoryRu: cat.category,
    categoryDisplay: cat.category,
    items: cat.items.map((mod) => {
      const entry = catalog.get(mod.id) || classifyModule(mod.id, registry, { builtinById });
      return {
        ...mod,
        catalog: entry,
      };
    }),
  }));
}

export function getModuleBadges(moduleId, registry = GRAPH_MODULE_REGISTRY, options = {}) {
  return classifyModule(moduleId, registry, options).badges || [];
}

export function moduleDisplayName(id, options = {}) {
  return GRAPH_MODULE_REGISTRY[id]?.name
    || resolveBuiltinById(id, options)?.name
    || id;
}

export { isGraphNativeModule };
